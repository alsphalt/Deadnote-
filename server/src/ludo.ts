// ============================================================
// DARKNOTE Ludo room service — server-authoritative multiplayer.
// Clients send intents (roll / move token); the server validates
// every action against the shared engine and broadcasts snapshots.
// ============================================================

import type { Server as SocketServer, Socket } from 'socket.io';
import { store } from './store.js';
import {
  createGame, setDice, legalMoves, applyMove, nextTurn, toSnapshot,
  rollDiceValue, SEAT_COLORS, PlayerColor, GameState, LegalMove, fromSnapshot,
} from '../../shared/ludo-engine.js';

export const BOARD_THEMES = ['classic', 'neon', 'royal', 'galaxy', 'darknote', '3d-table'];

interface RoomPlayer {
  userId: string | null;   // null = empty seat
  seat: number;
  color: PlayerColor;
  connected: boolean;
  socketId?: string;
  isHost: boolean;
  disconnectAt?: number;
}

interface Room {
  code: string;
  hostUserId: string;
  configPlayers: 2 | 3 | 4;
  theme: string;
  status: 'waiting' | 'countdown' | 'playing' | 'finished';
  players: RoomPlayer[];
  game: GameState | null;
  chat: { userId: string; text: string; at: string }[];
  countdown?: number;
  turnTimer?: NodeJS.Timeout;
  createdAt: Date;
}

const rooms = new Map<string, Room>();
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const TURN_TIMEOUT_MS = 60_000;
const DISCONNECT_GRACE_MS = 60_000;

function genCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

function broadcastRoom(io: SocketServer, room: Room): void {
  const payload = roomPayload(room);
  io.to(`room:${room.code}`).emit('room:state', payload);
}

function roomPayload(room: Room): any {
  return {
    code: room.code,
    hostUserId: room.hostUserId,
    configPlayers: room.configPlayers,
    theme: room.theme,
    status: room.status,
    players: room.players.map((p) => ({
      seat: p.seat,
      color: p.color,
      connected: p.connected,
      isHost: p.isHost,
      profile: p.userId ? store.publicProfile(p.userId) : null,
    })),
    game: room.game ? toSnapshot(room.game) : null,
    chat: room.chat.slice(-50),
    countdown: room.countdown ?? null,
  };
}

function clearTurnTimer(room: Room): void {
  if (room.turnTimer) clearTimeout(room.turnTimer);
  room.turnTimer = undefined;
}

function scheduleTurnTimeout(io: SocketServer, room: Room): void {
  clearTurnTimer(room);
  if (room.status !== 'playing' || !room.game) return;
  const cur = room.game.players[room.game.turn];
  const seat = room.players.find((p) => p.userId === cur.id);
  if (!seat || !seat.connected) {
    // disconnected player: pass automatically after a short grace
    room.turnTimer = setTimeout(() => {
      if (room.status === 'playing' && room.game) {
        nextTurn(room.game);
        broadcastRoom(io, room);
        scheduleTurnTimeout(io, room);
      }
    }, 10_000);
    return;
  }
  room.turnTimer = setTimeout(() => {
    if (room.status === 'playing' && room.game) {
      nextTurn(room.game);
      broadcastRoom(io, room);
      scheduleTurnTimeout(io, room);
    }
  }, TURN_TIMEOUT_MS);
}

function startGame(io: SocketServer, room: Room): void {
  const humans = room.players.filter((p) => p.userId);
  const colors = SEAT_COLORS[room.configPlayers];
  const enginePlayers = humans.map((p) => ({ id: p.userId!, color: p.color }));
  room.game = createGame(enginePlayers);
  room.status = 'playing';
  clearTurnTimer(room);
  broadcastRoom(io, room);
  scheduleTurnTimeout(io, room);
}

function broadcastCountdown(io: SocketServer, room: Room, n: number): void {
  room.status = 'countdown';
  room.countdown = n;
  io.to(`room:${room.code}`).emit('room:countdown', { code: room.code, n });
  if (n > 0) {
    setTimeout(() => broadcastCountdown(io, room, n - 1), 1000);
  } else {
    room.countdown = undefined;
    startGame(io, room);
  }
}

/** After a human move, check finish and advance; called for room games. */
function advanceAfterMove(io: SocketServer, room: Room): void {
  const g = room.game!;
  if (g.phase === 'finished') {
    room.status = 'finished';
    clearTurnTimer(room);
    // XP for humans
    const winnerSeat = room.players.find((p) => p.userId === g.winnerId);
    for (const p of room.players) {
      if (p.userId) {
        const won = p.userId === g.winnerId;
        store.recordGame(p.userId, won, won ? 250 : 50);
      }
    }
    broadcastRoom(io, room);
    return;
  }
  if (g.dice === 6 && g.sixesInRow < 3) {
    // same player rolls again
    g.phase = 'idle';
  } else {
    nextTurn(g);
  }
  broadcastRoom(io, room);
  scheduleTurnTimeout(io, room);
}

export function registerLudoSocket(io: SocketServer, socket: Socket, userId: string): void {
  socket.data.userId = userId;

  socket.on('room:create', (payload: any, ack?: (r: any) => void) => {
    const configPlayers = ([2, 3, 4].includes(Number(payload?.players)) ? Number(payload?.players) : 4) as 2 | 3 | 4;
    const theme = BOARD_THEMES.includes(String(payload?.theme)) ? String(payload.theme) : 'darknote';
    let code = genCode();
    while (rooms.has(code)) code = genCode();
    const colors = SEAT_COLORS[configPlayers];
    const room: Room = {
      code,
      hostUserId: userId,
      configPlayers,
      theme,
      status: 'waiting',
      players: colors.map((color, seat) => ({
        userId: seat === 0 ? userId : null,
        seat, color, connected: seat === 0, socketId: seat === 0 ? socket.id : undefined, isHost: seat === 0,
      })),
      game: null,
      chat: [],
      createdAt: new Date(),
    };
    rooms.set(code, room);
    socket.join(`room:${code}`);
    broadcastRoom(io, room);
    ack?.({ ok: true, code, theme });
  });

  socket.on('room:join', (payload: any, ack?: (r: any) => void) => {
    const code = String(payload?.code || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) return ack?.({ ok: false, error: 'not_found' });
    if (room.status === 'finished') return ack?.({ ok: false, error: 'finished' });
    // reconnect path
    const existing = room.players.find((p) => p.userId === userId);
    if (existing) {
      existing.connected = true;
      existing.socketId = socket.id;
      existing.disconnectAt = undefined;
      socket.join(`room:${code}`);
      broadcastRoom(io, room);
      return ack?.({ ok: true, code, reconnected: true });
    }
    if (room.status !== 'waiting') return ack?.({ ok: false, error: 'not_accepting' });
    const seat = room.players.find((p) => p.userId === null);
    if (!seat) return ack?.({ ok: false, error: 'full' });
    seat.userId = userId;
    seat.connected = true;
    seat.socketId = socket.id;
    socket.join(`room:${code}`);
    broadcastRoom(io, room);
    // 2-player rooms auto-start when full
    if (room.configPlayers === 2 && room.players.every((p) => p.userId)) {
      broadcastCountdown(io, room, 3);
    }
    ack?.({ ok: true, code });
  });

  socket.on('room:leave', (payload: any) => {
    const code = String(payload?.code || '').toUpperCase();
    const room = rooms.get(code);
    if (!room) return;
    const p = room.players.find((x) => x.userId === userId);
    if (p) {
      p.connected = false;
      p.disconnectAt = Date.now();
    }
    socket.leave(`room:${code}`);
    broadcastRoom(io, room);
  });

  socket.on('room:start', (payload: any) => {
    const code = String(payload?.code || '').toUpperCase();
    const room = rooms.get(code);
    if (!room || room.hostUserId !== userId || room.status !== 'waiting') return;
    const humans = room.players.filter((p) => p.userId);
    if (humans.length < 2 || humans.length > room.configPlayers) return;
    // host may start with 2 when room allows 3/4 (spec: host controls)
    broadcastCountdown(io, room, 3);
  });

  socket.on('game:roll', (payload: any) => {
    const room = rooms.get(String(payload?.code || '').toUpperCase());
    if (!room || room.status !== 'playing' || !room.game) return;
    const g = room.game;
    const cur = g.players[g.turn];
    if (cur.id !== userId) return;
    if (g.phase !== 'idle' && g.phase !== 'selecting') return;
    if (g.phase === 'selecting' && g.dice) return; // already rolled
    const dice = rollDiceValue();
    const moves = setDice(g, g.turn, dice);
    broadcastRoom(io, room);
    if (moves.length === 0) {
      // passed / forfeited — broadcast already done; schedule next
      scheduleTurnTimeout(io, room);
      return;
    }
    scheduleTurnTimeout(io, room);
  });

  socket.on('game:move', (payload: any, ack?: (r: any) => void) => {
    const room = rooms.get(String(payload?.code || '').toUpperCase());
    if (!room || room.status !== 'playing' || !room.game) return ack?.({ ok: false, error: 'no_game' });
    const g = room.game;
    const cur = g.players[g.turn];
    if (cur.id !== userId) return ack?.({ ok: false, error: 'not_your_turn' });
    if (g.phase !== 'selecting' || g.dice == null) return ack?.({ ok: false, error: 'not_selecting' });
    const token = Number(payload?.token);
    const moves = legalMoves(g, g.turn, g.dice);
    const mv = moves.find((m) => m.token === token);
    if (!mv) return ack?.({ ok: false, error: 'illegal_move' });
    applyMove(g, g.turn, mv);
    advanceAfterMove(io, room);
    ack?.({ ok: true });
  });

  socket.on('game:chat', (payload: any) => {
    const code = String(payload?.code || '').toUpperCase();
    const room = rooms.get(code);
    if (!room) return;
    const text = String(payload?.text || '').slice(0, 200);
    if (!text.trim()) return;
    room.chat.push({ userId, text: text.trim(), at: new Date().toISOString() });
    io.to(`room:${code}`).emit('game:chat', { userId, text: text.trim(), at: room.chat[room.chat.length - 1].at });
  });

  socket.on('game:react', (payload: any) => {
    const code = String(payload?.code || '').toUpperCase();
    const room = rooms.get(code);
    if (!room) return;
    const emoji = String(payload?.emoji || '').slice(0, 8);
    io.to(`room:${code}`).emit('game:chat', { userId, text: emoji, at: new Date().toISOString(), react: true });
  });

  socket.on('disconnect', () => {
    // mark any room seat disconnected
    for (const room of rooms.values()) {
      const p = room.players.find((x) => x.socketId === socket.id);
      if (p && p.userId) {
        p.connected = false;
        p.disconnectAt = Date.now();
        if (room.status === 'playing') scheduleTurnTimeout(io, room);
        broadcastRoom(io, room);
      }
    }
  });
}

// periodic cleanup of stale rooms
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    const stale = room.status === 'finished'
      || (room.status === 'waiting' && room.players.every((p) => !p.connected) && now - room.createdAt.getTime() > 3600_000);
    if (stale) {
      clearTurnTimer(room);
      rooms.delete(code);
    }
  }
}, 60_000);


