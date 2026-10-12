// ============================================================
// DARKNOTE LUDO ENGINE — authoritative rules, pure TS, no I/O
// One engine powers 2/3/4-player, multiplayer, bot mode, and
// every AI difficulty. Tokens are tracked by PROGRESS (steps
// travelled), never by screen coordinates.
// ============================================================

export type PlayerColor = 'red' | 'green' | 'yellow' | 'blue';
export type AiMode = 'trainer' | 'beginner' | 'professional' | 'pro' | 'wise';

export const PLAYER_COLORS: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];

export const LOOP = 52;                 // main track cells
export const START_CELL: Record<PlayerColor, number> = { red: 0, green: 13, yellow: 26, blue: 39 };
export const SAFE_CELLS = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
export const HOME_COLUMN_LEN = 5;       // colored cells before center
export const TOTAL_PROGRESS = 57;       // 57 = finished (center)

export const SEAT_COLORS: Record<2 | 3 | 4, PlayerColor[]> = {
  2: ['red', 'yellow'],
  3: ['red', 'green', 'yellow'],
  4: ['red', 'green', 'yellow', 'blue'],
};

/** Map progress → loop cell index (valid for progress 1..51). */
export function loopCell(color: PlayerColor, progress: number): number {
  return (START_CELL[color] + progress - 1 + LOOP) % LOOP;
}

export interface EnginePlayer {
  id: string;
  color: PlayerColor;
  aiMode?: AiMode | null;
}

export interface TokenView {
  index: number;
  progress: number;
}

export interface PlayerView {
  id: string;
  color: PlayerColor;
  aiMode: AiMode | null;
  tokens: TokenView[];          // exactly 4
  finishedCount: number;
}

export type GamePhase = 'idle' | 'rolling' | 'selecting' | 'finished';

export interface GameEvent {
  type: 'roll' | 'move' | 'capture' | 'home' | 'finish' | 'pass' | 'forfeit' | 'win';
  playerId: string;
  data?: any;
}

export interface GameState {
  players: PlayerView[];
  turn: number;                 // index into players[]
  dice: number | null;
  sixesInRow: number;
  phase: GamePhase;
  winnerId: string | null;
  events: GameEvent[];
  version: number;
}

export interface LegalMove {
  token: number;                // token index
  from: number;                 // progress before
  to: number;                   // progress after
}

export interface MoveResult {
  events: GameEvent[];
  capturedTokens: { playerId: string; token: number }[];
}

// ---------- creation ----------

export function createGame(players: EnginePlayer[]): GameState {
  return {
    players: players.map((p) => ({
      id: p.id,
      color: p.color,
      aiMode: p.aiMode ?? null,
      tokens: [0, 1, 2, 3].map((i) => ({ index: i, progress: 0 })),
      finishedCount: 0,
    })),
    turn: 0,
    dice: null,
    sixesInRow: 0,
    phase: 'idle',
    winnerId: null,
    events: [],
    version: 1,
  };
}

export function playerFinished(p: PlayerView): boolean {
  return p.tokens.every((t) => t.progress === TOTAL_PROGRESS);
}

// ---------- dice (CSPRNG, works in node + browser) ----------

export function rollDiceValue(): number {
  const buf = new Uint32Array(1);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(buf);
  } else if (typeof globalThis !== 'undefined' && (globalThis as any).crypto) {
    (globalThis as any).crypto.getRandomValues(buf);
  } else {
    // fallback (never used in production paths)
    buf[0] = Math.floor(Math.random() * 0xffffffff);
  }
  return (buf[0] % 6) + 1;
}

// ---------- legal moves ----------

export function legalMoves(state: GameState, playerIdx: number, dice: number): LegalMove[] {
  const p = state.players[playerIdx];
  if (!p) return [];
  const moves: LegalMove[] = [];
  for (const t of p.tokens) {
    if (t.progress === TOTAL_PROGRESS) continue;          // finished
    if (t.progress === 0) {
      if (dice === 6) moves.push({ token: t.index, from: 0, to: 1 });
      continue;
    }
    const to = t.progress + dice;
    if (to > TOTAL_PROGRESS) continue;                    // exact finish required
    moves.push({ token: t.index, from: t.progress, to });
  }
  return moves;
}

/** Tokens of the same player sharing a cell form a stack; moving one moves the stack. */
export function stackedTokens(state: GameState, playerIdx: number, progress: number): number[] {
  return state.players[playerIdx].tokens.filter((t) => t.progress === progress).map((t) => t.index);
}

/** Apply a validated move. `events` are appended; version bumped. Returns capture info. */
export function applyMove(state: GameState, playerIdx: number, m: LegalMove): MoveResult {
  const p = state.players[playerIdx];
  const events: GameEvent[] = [];
  const capturedTokens: { playerId: string; token: number }[] = [];

  // move the stack (all same-color tokens at `from`) — but tokens in the home
  // yard move individually; only in-play blocks move together
  const stack = m.from === 0 ? [m.token] : stackedTokens(state, playerIdx, m.from);
  for (const ti of stack) {
    const t = p.tokens.find((x) => x.index === ti)!;
    t.progress = m.to;
  }

  // capture resolution (only on the loop, non-safe cells, single opponent token)
  if (m.to >= 1 && m.to <= LOOP) {
    const cell = loopCell(p.color, m.to);
    if (!SAFE_CELLS.has(cell)) {
      for (const other of state.players) {
        if (other.id === p.id) continue;
        const occupants = other.tokens.filter((t) => t.progress >= 1 && t.progress <= LOOP && loopCell(other.color, t.progress) === cell);
        if (occupants.length === 1) {
          const t = occupants[0];
          const victimProgress = t.progress;
          t.progress = 0;
          capturedTokens.push({ playerId: other.id, token: t.index });
          events.push({ type: 'capture', playerId: p.id, data: { victim: other.id, token: t.index, victimProgress } });
        }
      }
    }
  }

  // home column entry / finish
  if (m.to >= LOOP + 1 && m.to <= TOTAL_PROGRESS - 1) {
    events.push({ type: 'home', playerId: p.id, data: { to: m.to } });
  }
  if (m.to === TOTAL_PROGRESS) {
    events.push({ type: 'finish', playerId: p.id, data: { token: m.token } });
    p.finishedCount = p.tokens.filter((t) => t.progress === TOTAL_PROGRESS).length;
    if (p.finishedCount === 4) {
      state.winnerId = p.id;
      state.phase = 'finished';
      events.push({ type: 'win', playerId: p.id });
    }
  }

  events.unshift({ type: 'move', playerId: p.id, data: { token: m.token, from: m.from, to: m.to } });
  state.events.push(...events);
  state.version += 1;
  return { events, capturedTokens };
}

/** Advance to the next player who still has tokens in play; returns new turn index. */
export function nextTurn(state: GameState): number {
  const n = state.players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (state.turn + i) % n;
    if (!playerFinished(state.players[idx])) {
      state.turn = idx;
      state.phase = 'idle';
      state.dice = null;
      return idx;
    }
  }
  return state.turn;
}

/** Set the dice for a player's turn. Returns moves (may be empty → auto-pass). */
export function setDice(state: GameState, playerIdx: number, dice: number): LegalMove[] {
  const p = state.players[playerIdx];
  state.dice = dice;
  state.sixesInRow = dice === 6 ? state.sixesInRow + 1 : 0;
  state.events.push({ type: 'roll', playerId: p.id, data: { dice } });
  state.version += 1;

  if (state.sixesInRow >= 3) {
    state.events.push({ type: 'forfeit', playerId: p.id, data: { reason: 'three sixes' } });
    nextTurn(state);
    return [];
  }

  const moves = legalMoves(state, playerIdx, dice);
  if (moves.length === 0) {
    state.events.push({ type: 'pass', playerId: p.id });
    nextTurn(state);
    return [];
  }
  state.phase = 'selecting';
  return moves;
}

/** Complete a move; if dice was 6 (and not forfeited) the same player rolls again. */
export function completeMove(state: GameState, playerIdx: number, m: LegalMove): boolean {
  applyMove(state, playerIdx, m);
  if (state.phase === 'finished') return false;
  if (state.dice === 6 && state.sixesInRow < 3) {
    state.phase = 'idle';          // same player rolls again
    return true;
  }
  nextTurn(state);
  return false;
}

/** Wire-safe snapshot (plain JSON). */
export function toSnapshot(state: GameState): any {
  return {
    players: state.players.map((p) => ({
      id: p.id, color: p.color, aiMode: p.aiMode,
      tokens: p.tokens.map((t) => ({ index: t.index, progress: t.progress })),
      finishedCount: p.finishedCount,
    })),
    turn: state.turn,
    dice: state.dice,
    sixesInRow: state.sixesInRow,
    phase: state.phase,
    winnerId: state.winnerId,
    version: state.version,
  };
}

export function fromSnapshot(s: any): GameState {
  return {
    players: s.players.map((p: any) => ({
      id: p.id, color: p.color, aiMode: p.aiMode ?? null,
      tokens: p.tokens.map((t: any) => ({ index: t.index, progress: t.progress })),
      finishedCount: p.finishedCount,
    })),
    turn: s.turn, dice: s.dice, sixesInRow: s.sixesInRow,
    phase: s.phase, winnerId: s.winnerId, events: [], version: s.version,
  };
}
