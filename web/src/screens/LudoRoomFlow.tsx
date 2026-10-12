// ============================================================
// DARKNOTE Ludo rooms — create (board theme picker), join,
// waiting room with host controls, then hands off to the board.
// ============================================================

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../store';
import { useSocket } from '../socket';
import { Avatar, Modal } from '../components/ui';
import { LudoGame } from './LudoGame';

const THEMES = [
  { id: 'classic', name: 'Classic', desc: 'Felt & wood', ico: '🌳' },
  { id: 'neon', name: 'Neon', desc: 'Electric glow', ico: '⚡' },
  { id: 'royal', name: 'Royal', desc: 'Gold & purple', ico: '👑' },
  { id: 'galaxy', name: 'Galaxy', desc: 'Stardust', ico: '🌌' },
  { id: 'darknote', name: 'DARKNOTE', desc: 'Signature', ico: '💜' },
  { id: '3d-table', name: '3D Table', desc: 'Physical feel', ico: '🎲' },
];

export function LudoRoomFlow() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { user } = useApp();
  const { socket, emit, connected } = useSocket();

  const [view, setView] = useState<'menu' | 'create' | 'join' | 'waiting' | 'playing'>(params.get('join') ? 'join' : 'menu');
  const [players, setPlayers] = useState<2 | 3 | 4>(4);
  const [theme, setTheme] = useState('darknote');
  const [code, setCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [room, setRoom] = useState<any>(null);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  const joinCode = (c: string) => {
    if (!socket) return;
    emit('room:join', { code: c }, (r: any) => {
      if (!r?.ok) {
        setErr(r?.error === 'full' ? 'Room is full' : r?.error === 'not_found' ? 'Room not found' : 'Cannot join');
        return;
      }
      setCode(c);
      setView('waiting');
    });
  };

  const createRoom = () => {
    if (!socket) return;
    emit('room:create', { players, theme }, (r: any) => {
      if (r?.ok) {
        setCode(r.code);
        setView('waiting');
      }
    });
  };

  const hostStart = (withAvailable = true) => {
    if (code) emit('room:start', { code });
  };

  const copyCode = () => {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const onState = useCallback((payload: any) => {
    setRoom(payload);
    if (payload.status === 'playing' || payload.status === 'finished') {
      setView('playing');
    }
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('room:state', onState);
    socket.on('room:countdown', () => {});
    return () => {
      socket.off('room:state', onState);
      socket.off('room:countdown', () => {});
    };
  }, [socket, onState]);

  const me = user?.id;
  const isHost = room?.hostUserId === me;
  const humans = room?.players?.filter((p: any) => p.profile) || [];
  const full = humans.length >= (room?.configPlayers || 4);
  const canStart = isHost && room?.status === 'waiting' && humans.length >= 2 && (full || humans.length >= 2);

  if (view === 'playing') {
    return <LudoGame mode="room" code={code} />;
  }

  return (
    <div className="screen">
      <div className="topbar" style={{ position: 'static', margin: '-16px -16px 16px' }}>
        <button className="icon-btn" onClick={() => nav('/app/games/ludo')}>←</button>
        <span style={{ fontWeight: 700 }}>LUDO ROOM</span>
        {code && <span className="chip">{code}</span>}
        <span className="spacer" />
        {connected ? <span className="pill ok">● Connected</span> : <span className="pill warn">Connecting…</span>}
      </div>

      {view === 'menu' && (
        <>
          <h1 style={{ fontSize: 22, marginBottom: 16 }}>Multiplayer</h1>
          <button className="btn primary block" style={{ marginBottom: 12, padding: '16px' }} onClick={() => setView('create')}>🛠 CREATE ROOM</button>
          <button className="btn block" style={{ padding: '16px' }} onClick={() => setView('join')}>🔗 JOIN ROOM</button>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 14, textAlign: 'center' }}>
            Multiplayer is realtime and server-validated. Open two browsers to play together.
          </p>
        </>
      )}

      {view === 'create' && (
        <>
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>Create room</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>Choose player count and a board theme — the theme is locked for everyone in the room.</p>

          <div className="section-title">Players</div>
          <div className="grid2" style={{ marginBottom: 16 }}>
            {([2, 3, 4] as const).map((n) => (
              <button key={n} className={`chip${players === n ? ' active' : ''}`} style={{ padding: '14px', fontSize: 15 }} onClick={() => setPlayers(n)}>{n} players</button>
            ))}
          </div>

          <div className="section-title">Choose game board</div>
          <div className="grid2" style={{ marginBottom: 20 }}>
            {THEMES.map((t) => (
              <div key={t.id} className={`ludo-tile${theme === t.id ? ' turn-glow' : ''}`} style={{ padding: 14 }} onClick={() => setTheme(t.id)}>
                <div style={{ fontSize: 30 }}>{t.ico}</div>
                <div style={{ fontWeight: 700 }}>{t.name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{t.desc}</div>
                <div style={{ width: '100%', height: 8, borderRadius: 4, background: t.id === 'darknote' ? 'var(--accent-grad)' : t.id === 'classic' ? 'linear-gradient(90deg,#2F7D4F,#8B5E3C)' : t.id === 'neon' ? 'linear-gradient(90deg,#00F5FF,#FF00E5)' : t.id === 'royal' ? 'linear-gradient(90deg,#6B21A8,#D4AF37)' : t.id === 'galaxy' ? 'linear-gradient(90deg,#1B1464,#7F00FF)' : 'linear-gradient(90deg,#4B3621,#C9A227)' }} />
              </div>
            ))}
          </div>

          <button className="btn primary block" onClick={createRoom}>CREATE ROOM</button>
        </>
      )}

      {view === 'join' && (
        <>
          <h1 style={{ fontSize: 22, marginBottom: 16 }}>Join room</h1>
          <div className="field">
            <label>Enter room code</label>
            <input
              className="input"
              style={{ fontFamily: 'var(--font-mono)', fontSize: 22, letterSpacing: '0.2em', textTransform: 'uppercase' }}
              placeholder="8K4P21"
              maxLength={6}
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && inputCode.length === 6 && joinCode(inputCode)}
            />
          </div>
          {err && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{err}</p>}
          <button className="btn primary block" disabled={inputCode.length !== 6} onClick={() => joinCode(inputCode)}>JOIN</button>
        </>
      )}

      {view === 'waiting' && room && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 700, letterSpacing: '0.12em', background: 'var(--accent-grad)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{code}</div>
              <span className="spacer" />
              <button className="btn" style={{ padding: '8px 14px', minHeight: 36 }} onClick={copyCode}>{copied ? '✓ Copied' : 'COPY CODE'}</button>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12.5, marginTop: 8 }}>
              Share this code with friends. Players: {humans.length} / {room.configPlayers}
            </p>
          </div>

          <div className="section-title">Players</div>
          {room.players.map((p: any) => (
            <div className="row" key={p.seat}>
              <div className="avatar" style={{ background: p.color, borderColor: 'rgba(255,255,255,0.3)' }} />
              <div className="body">
                <div className="name">
                  {p.profile ? (p.profile.id === me ? `You` : `@${p.profile.username}`) : 'Waiting…'}
                  {p.isHost && <span className="chip active">Host</span>}
                </div>
                <div className="sub">{p.connected ? 'Connected' : 'Disconnected'}</div>
              </div>
              {p.profile?.id === me && <span className="chip active">YOU</span>}
            </div>
          ))}

          {isHost && room.status === 'waiting' && (
            <>
              <div className="card" style={{ marginTop: 16 }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 10 }}>
                  {humans.length >= 2 ? (full ? 'Room is full — start the game.' : `${humans.length} of ${room.configPlayers} joined — you may start with the available players.`) : 'Waiting for at least 2 players…'}
                </p>
                <button className="btn primary block" disabled={humans.length < 2} onClick={() => hostStart()}>
                  {full ? 'START GAME' : `START WITH ${humans.length}`}
                </button>
                {!full && humans.length >= 2 && (
                  <button className="btn ghost block" style={{ marginTop: 8 }}>WAIT FOR MORE</button>
                )}
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: 11.5, marginTop: 10, textAlign: 'center' }}>
                A 3-second countdown starts when the game begins. 2-player rooms auto-start when full.
              </p>
            </>
          )}
          {!isHost && room.status === 'waiting' && (
            <p className="empty">Waiting for the host to start the game…</p>
          )}
        </>
      )}
    </div>
  );
}
