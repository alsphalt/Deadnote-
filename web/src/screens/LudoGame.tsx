// ============================================================
// DARKNOTE Ludo game — single screen powers VS Computer (local,
// authoritative shared engine) and multiplayer rooms (server-
// authoritative snapshots rendered + intents sent).
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useApp } from '../store';
import { useSocket } from '../socket';
import { LudoBoard, BoardToken } from '../components/Board';
import { Modal } from '../components/ui';
import {
  createGame, setDice, legalMoves, applyMove, completeMove, nextTurn,
  rollDiceValue, fromSnapshot, toSnapshot, GameState, LegalMove,
  SEAT_COLORS, EnginePlayer, PlayerColor, TOTAL_PROGRESS,
} from '@shared/ludo-engine';
import { chooseAiMove, AI_THINK_DELAY_MS, AI_MODE_LABEL } from '@shared/ludo-ai';
import type { AiMode } from '@shared/ludo-ai';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const THEMES = ['classic', 'neon', 'royal', 'galaxy', 'darknote', '3d-table'];

interface Effect { id: number; msg: string; kind: string }

export function LudoGame({ mode, code: propCode }: { mode: 'local' | 'room'; code?: string }) {
  const nav = useNavigate();
  const { code: routeCode } = useParams();
  const code = propCode || routeCode;
  const [params] = useSearchParams();
  const { user } = useApp();
  const { socket, emit, connected } = useSocket();

  // ---- local config ----
  const localPlayers = Number(params.get('players')) || 2;
  const localModes = (params.get('modes') || 'professional').split(',').filter(Boolean);
  const [theme, setTheme] = useState<string>(params.get('theme') || 'darknote');

  // ---- engine + visual state ----
  const engineRef = useRef<GameState | null>(null);
  const [, setTick] = useState(0);
  const [tokens, setTokens] = useState<Record<string, number[]>>({});
  const [dice, setDiceVal] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const [legal, setLegal] = useState<LegalMove[]>([]);
  const [myTurn, setMyTurn] = useState(false);
  const [effects, setEffects] = useState<Effect[]>([]);
  const [winner, setWinner] = useState<string | null>(null);
  const [statusLine, setStatusLine] = useState('Get ready…');
  const [room, setRoom] = useState<any>(null);
  const [chat, setChat] = useState<{ userId: string; text: string; at: string }[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showChatBtn, setShowChatBtn] = useState(false);
  const myIdRef = useRef<string>(user?.id || '');
  myIdRef.current = user?.id || '';
  const effectId = useRef(0);

  const pushEffect = useCallback((msg: string, kind: string) => {
    const id = ++effectId.current;
    setEffects((prev) => [...prev, { id, msg, kind }]);
    setTimeout(() => setEffects((prev) => prev.filter((e) => e.id !== id)), 1600);
  }, []);

  // ---- token animation (cell-by-cell hops) ----
  const animateTokens = useCallback(async (from: Record<string, number[]>, to: Record<string, number[]>) => {
    const cur: Record<string, number[]> = {};
    for (const k of Object.keys(to)) cur[k] = [...(from[k] || to[k])];
    setTokens({ ...cur });
    const finished = () => Object.keys(to).every((k) => cur[k].every((v, i) => v === to[k][i]));
    while (!finished()) {
      await delay(90);
      for (const k of Object.keys(to)) {
        for (let i = 0; i < to[k].length; i++) {
          const tgt = to[k][i];
          if (tgt === 0) continue; // captured tokens snap home (handled by caller effect)
          if (cur[k][i] < tgt) cur[k][i]++;
          else if (cur[k][i] > tgt && tgt > 0) cur[k][i]--;
        }
      }
      setTokens({ ...cur });
    }
  }, []);

  const snapshotTokens = useCallback((g: GameState): Record<string, number[]> => {
    const out: Record<string, number[]> = {};
    for (const p of g.players) out[p.id] = p.tokens.map((t) => t.progress);
    return out;
  }, []);

  // ---- local game loop ----
  const playLocalTurn = useCallback(async (state: GameState, prevTokens: Record<string, number[]>) => {
    const cur = state.players[state.turn];
    if (state.phase === 'finished') {
      setWinner(cur.id);
      setStatusLine(`${cur.aiMode ? AI_MODE_LABEL[cur.aiMode] : 'You'} wins! 🏆`);
      pushEffect('🏆 WINNER!', 'win');
      return;
    }
    if (cur.aiMode) {
      setStatusLine(`${AI_MODE_LABEL[cur.aiMode]} is thinking…`);
      await delay(AI_THINK_DELAY_MS[cur.aiMode as AiMode]);
      if (engineRef.current !== state) return;
      const diceVal = rollDiceValue();
      setDiceVal(diceVal);
      setRolling(true);
      await delay(650);
      setRolling(false);
      const moves = setDice(state, state.turn, diceVal);
      setTick((t) => t + 1);
      if (moves.length === 0) {
        setStatusLine(`${AI_MODE_LABEL[cur.aiMode]} has no moves`);
        await delay(500);
        await animateTokens(prevTokens, snapshotTokens(state));
        playLocalTurn(state, snapshotTokens(state));
        return;
      }
      const pick = chooseAiMove(state, state.turn, moves, cur.aiMode as AiMode);
      if (!pick) {
        nextTurn(state);
        setTick((t) => t + 1);
        await animateTokens(prevTokens, snapshotTokens(state));
        playLocalTurn(state, snapshotTokens(state));
        return;
      }
      setStatusLine(`${AI_MODE_LABEL[cur.aiMode]} rolled ${diceVal}`);
      await delay(600);
      const before = snapshotTokens(state);
      for (const ev of state.events.filter((e) => e.playerId === cur.id && e.type === 'capture')) {
        pushEffect('💥 CAPTURE!', 'capture');
      }
      applyMove(state, state.turn, pick);
      for (const ev of state.events.slice(-4)) {
        if (ev.type === 'home') pushEffect('✨ HOME!', 'home');
        if (ev.type === 'finish') pushEffect('✨ HOME!', 'home');
      }
      const after = snapshotTokens(state);
      const fromAnim: Record<string, number[]> = {};
      const toAnim: Record<string, number[]> = {};
      for (const p of state.players) {
        fromAnim[p.id] = before[p.id].map((v, i) => (after[p.id][i] === 0 && v !== 0 ? 0 : v));
        toAnim[p.id] = after[p.id];
      }
      setTokens({ ...fromAnim });
      await animateTokens(fromAnim, toAnim);
      completeMove(state, state.turn, pick);
      setTick((t) => t + 1);
      playLocalTurn(state, snapshotTokens(state));
      return;
    }
    // human turn
    setMyTurn(true);
    setStatusLine('YOUR TURN — roll the dice');
    setTick((t) => t + 1);
  }, [animateTokens, snapshotTokens, pushEffect]);

  // start local game (guarded against StrictMode double-invoke in dev)
  const startedRef = useRef(false);
  useEffect(() => {
    if (mode !== 'local' || startedRef.current) return;
    startedRef.current = true;
    const colors = SEAT_COLORS[localPlayers as 2 | 3 | 4];
    const players: EnginePlayer[] = colors.map((color, i) =>
      i === 0
        ? { id: 'human', color, aiMode: null }
        : { id: `bot${i}`, color, aiMode: (localModes[i - 1] as AiMode) || 'professional' }
    );
    const g = createGame(players);
    engineRef.current = g;
    setTokens(snapshotTokens(g));
    setTick((t) => t + 1);
    playLocalTurn(g, snapshotTokens(g));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const humanRoll = () => {
    const g = engineRef.current;
    if (!g || mode !== 'local') return;
    const cur = g.players[g.turn];
    if (cur.aiMode) return;
    if (g.phase === 'selecting') return;
    if (g.phase === 'finished') return;
    const diceVal = rollDiceValue();
    setDiceVal(diceVal);
    setRolling(true);
    setStatusLine('ROLLING…');
    setTimeout(async () => {
      setRolling(false);
      const moves = setDice(g, g.turn, diceVal);
      setTick((t) => t + 1);
      if (moves.length === 0) {
        setStatusLine('No legal moves — turn passes');
        await delay(700);
        setMyTurn(false);
        playLocalTurn(g, snapshotTokens(g));
        return;
      }
      setLegal(moves);
      setStatusLine(`You rolled ${diceVal} — tap a glowing token`);
    }, 700);
  };

  const humanMove = async (color: PlayerColor, token: number) => {
    const g = engineRef.current;
    if (!g || mode !== 'local') return;
    const cur = g.players[g.turn];
    if (cur.aiMode) return;
    const mv = legal.find((m) => m.token === token);
    if (!mv) return;
    setLegal([]);
    const before = snapshotTokens(g);
    applyMove(g, g.turn, mv);
    for (const ev of g.events.slice(-3)) {
      if (ev.type === 'capture') pushEffect('💥 CAPTURE!', 'capture');
      if (ev.type === 'home') pushEffect('✨ HOME!', 'home');
    }
    const after = snapshotTokens(g);
    const fromAnim: Record<string, number[]> = {};
    const toAnim: Record<string, number[]> = {};
    for (const p of g.players) {
      fromAnim[p.id] = before[p.id].map((v, i) => (after[p.id][i] === 0 && v !== 0 ? 0 : v));
      toAnim[p.id] = after[p.id];
    }
    setTokens({ ...fromAnim });
    await animateTokens(fromAnim, toAnim);
    const sameTurn = completeMove(g, g.turn, mv);
    setTick((t) => t + 1);
    if (g.phase === 'finished') {
      setWinner('human');
      setStatusLine('YOU WIN! 🏆');
      pushEffect('🏆 YOU WIN!', 'win');
      return;
    }
    if (sameTurn) {
      setStatusLine('Six! Roll again');
    } else {
      setMyTurn(false);
      playLocalTurn(g, snapshotTokens(g));
    }
  };

  // ---- room mode ----
  useEffect(() => {
    if (mode !== 'room' || !routeCode || !socket) return;
    emit('room:join', { code: routeCode }, (r: any) => {
      if (!r?.ok) nav('/app/games/ludo/room');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, routeCode, socket, connected]);

  const applyRoomSnapshot = useCallback(async (payload: any) => {
    setRoom(payload);
    if (payload.chat) setChat(payload.chat);
    if (payload.countdown != null) setCountdown(payload.countdown);
    if (payload.status === 'waiting') {
      setStatusLine('Waiting for players…');
      return;
    }
    if (payload.status === 'finished') {
      setWinner(payload.game?.winnerId || null);
      return;
    }
    const g = fromSnapshot(payload.game);
    engineRef.current = g;
    const prev = tokensRef.current;
    const next = snapshotTokens(g);
    const prevCount = Object.keys(prev).length;
    if (prevCount > 0 && Object.keys(next).length > 0) {
      const changed = Object.keys(next).some((k) => prev[k] && prev[k].some((v, i) => v !== next[k][i]));
      if (changed) await animateTokens(prev, next);
    } else {
      setTokens(next);
    }
    tokensRef.current = next;
    setDiceVal(g.dice);
    const me = payload.players?.find((p: any) => p.profile?.id === myIdRef.current);
    const cur = g.players[g.turn];
    setMyTurn(!!me && cur.id === myIdRef.current);
    if (cur.id === myIdRef.current) {
      setStatusLine(g.phase === 'selecting' ? 'YOUR TURN — tap a glowing token' : 'YOUR TURN — roll the dice');
      setLegal(g.phase === 'selecting' && g.dice ? legalMoves(g, g.turn, g.dice) : []);
    } else {
      setStatusLine(`Waiting for ${payload.players?.find((p: any) => p.profile?.id === cur.id)?.profile?.displayName || 'player'}…`);
      setLegal([]);
    }
    setTick((t) => t + 1);
  }, [animateTokens, snapshotTokens]);

  const tokensRef = useRef<Record<string, number[]>>({});

  useEffect(() => {
    if (mode !== 'room' || !socket) return;
    const onState = (payload: any) => applyRoomSnapshot(payload);
    const onCountdown = (p: { n: number }) => setCountdown(p.n);
    const onChat = (p: { userId: string; text: string; at: string }) => setChat((c) => [...c.slice(-49), p]);
    socket.on('room:state', onState);
    socket.on('room:countdown', onCountdown);
    socket.on('game:chat', onChat);
    return () => {
      socket.off('room:state', onState);
      socket.off('room:countdown', onCountdown);
      socket.off('game:chat', onChat);
    };
  }, [mode, socket, applyRoomSnapshot]);

  const roomRoll = () => {
    if (!routeCode) return;
    emit('game:roll', { code: routeCode });
  };

  const roomMove = (color: PlayerColor, token: number) => {
    if (!routeCode) return;
    emit('game:move', { code: routeCode, token });
  };

  const sendChat = () => {
    const t = chatText.trim();
    if (!t || !routeCode) return;
    emit('game:chat', { code: routeCode, text: t });
    setChatText('');
  };

  const quickReact = (emoji: string) => {
    if (!routeCode) return;
    emit('game:react', { code: routeCode, emoji });
  };

  // ---- derived render data ----
  const boardTokens: BoardToken[] = [];
  if (engineRef.current) {
    for (const p of engineRef.current.players) {
      const progs = tokens[p.id] || p.tokens.map((t) => t.progress);
      for (let i = 0; i < 4; i++) {
        boardTokens.push({
          color: p.color,
          token: i,
          progress: progs[i] ?? 0,
          selectable: mode === 'local' ? legal.some((m) => m.token === i) : legal.some((m) => m.token === i),
        });
      }
    }
  }

  const isLocalHumanWinner = mode === 'local' && winner === 'human';
  const isAiWinner = mode === 'local' && winner && winner !== 'human';
  const roomWinnerName = mode === 'room' && winner
    ? room?.players?.find((p: any) => p.profile?.id === winner)?.profile?.displayName || 'Player'
    : null;
  const selecting = engineRef.current?.phase === 'selecting';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="topbar">
        <button className="icon-btn" onClick={() => nav('/app/games/ludo')}>←</button>
        <span style={{ fontWeight: 700 }}>DARKNOTE LUDO</span>
        {routeCode && <span className="chip" style={{ marginLeft: 6 }}>Room: {routeCode}</span>}
        <span className="spacer" />
        <select className="chip" value={theme} onChange={(e) => setTheme(e.target.value)} style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', padding: '6px 8px' }}>
          {THEMES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button className="icon-btn" onClick={() => setChatOpen((v) => !v)} title="Game chat">💬</button>
      </div>

      {countdown != null && countdown > 0 && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(11,14,20,0.72)', fontSize: 72, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
          {countdown}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div style={{ width: '100%', maxWidth: 680 }}>
          <LudoBoard
            tokens={boardTokens}
            theme={theme}
            dice={dice}
            rolling={rolling}
            onTokenClick={mode === 'local' ? humanMove : roomMove}
            onRollClick={mode === 'local' ? humanRoll : roomRoll}
            rollEnabled={myTurn && !rolling && !selecting}
            turnLabel={myTurn ? (mode === 'local' ? 'YOUR TURN' : 'YOUR TURN') : undefined}
            myTurn={myTurn}
            statusLine={statusLine}
          />
        </div>
        {mode === 'room' && (
          <div style={{ display: 'flex', gap: 8 }}>
            {['😂', '🔥', '😱', '👏', 'GG', 'Nice!'].map((r) => (
              <button key={r} className="chip" onClick={() => quickReact(r)}>{r}</button>
            ))}
          </div>
        )}
      </div>

      {/* effects overlay */}
      {effects.map((e) => (
        <div key={e.id} className="toast" style={{ bottom: 140, animation: 'none', fontSize: 16, fontWeight: 700 }}>
          {e.msg}
        </div>
      ))}

      {/* room chat panel */}
      {chatOpen && mode === 'room' && (
        <div className="sheet" style={{ maxHeight: '45dvh' }}>
          <h3 style={{ marginBottom: 10 }}>GAME CHAT</h3>
          <div style={{ maxHeight: '26dvh', overflowY: 'auto', marginBottom: 10 }}>
            {chat.map((c, i) => (
              <div key={i} style={{ padding: '4px 0', fontSize: 13 }}>
                <strong>{c.userId === user?.id ? 'You' : 'Player'}:</strong> {c.text}
              </div>
            ))}
            {chat.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Say something…</p>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" placeholder="Type message…" value={chatText} onChange={(e) => setChatText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendChat()} />
            <button className="icon-btn game-btn" onClick={sendChat}>➤</button>
          </div>
        </div>
      )}

      {/* result modal */}
      {(isLocalHumanWinner || isAiWinner || roomWinnerName) && (
        <Modal title="" onClose={() => { setWinner(null); nav('/app/games/ludo'); }}>
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 56, marginBottom: 8 }}>🏆</div>
            <h2 style={{ marginBottom: 6 }}>
              {mode === 'local'
                ? isLocalHumanWinner ? 'YOU WON!' : `${AI_MODE_LABEL[(engineRef.current?.players.find((p) => p.id === winner)?.aiMode as AiMode) || 'professional']} won`
                : `${roomWinnerName} WON!`}
            </h2>            <p style={{ color: 'var(--text-secondary)', marginBottom: 18 }}>+250 XP · Level up your DARKNOTE game profile</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn primary" style={{ flex: 1 }} onClick={() => window.location.reload()}>PLAY AGAIN</button>
              <button className="btn" style={{ flex: 1 }} onClick={() => nav('/app/games/ludo')}>EXIT</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
