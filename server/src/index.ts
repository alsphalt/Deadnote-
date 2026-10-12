// ============================================================
// DARKNOTE server entry — Express (REST) + Socket.IO (realtime)
// ============================================================

import http from 'node:http';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { Server as SocketServer } from 'socket.io';
import { store, parseAuth } from './store.js';
import { authRouter } from './auth.js';
import { chatRouter, registerChatSocket, userSocketIds } from './chat.js';
import { registerLudoSocket, BOARD_THEMES } from './ludo.js';

const PORT = Number(process.env.PORT || 4000);
const app = express();
const server = http.createServer(app);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'darknote', time: new Date().toISOString() }));

app.use('/api/v1/auth', authRouter);
app.use('/api/v1', chatRouter);

// ---- updates ----
app.get('/api/v1/updates', (req, res) => {
  const auth = parseAuth(req);
  if (!auth.userId) return res.status(401).json({ error: 'unauthorized' });
  const contactIds = Object.values(store.data.chats)
    .filter((c) => c.memberIds.includes(auth.userId!))
    .flatMap((c) => c.memberIds)
    .filter((m) => m !== auth.userId);
  res.json({ updates: store.liveUpdates(auth.userId, contactIds) });
});

app.post('/api/v1/updates', (req, res) => {
  const auth = parseAuth(req);
  if (!auth.userId) return res.status(401).json({ error: 'unauthorized' });
  const u = store.addUpdate({
    userId: auth.userId,
    type: (['text', 'image', 'video'].includes(req.body?.type) ? req.body.type : 'text') as 'text' | 'image' | 'video',
    text: String(req.body?.text || '').slice(0, 280),
    mediaEmoji: String(req.body?.mediaEmoji || '').slice(0, 8),
    privacy: String(req.body?.privacy || 'contacts'),
  });
  res.status(201).json({ update: u });
});

app.post('/api/v1/updates/:id/view', (req, res) => {
  const auth = parseAuth(req);
  if (!auth.userId) return res.status(401).json({ error: 'unauthorized' });
  store.viewUpdate(req.params.id, auth.userId);
  res.status(204).end();
});

app.delete('/api/v1/updates/:id', (req, res) => {
  const auth = parseAuth(req);
  if (!auth.userId) return res.status(401).json({ error: 'unauthorized' });
  const u = store.data.updates[req.params.id];
  if (!u || u.userId !== auth.userId) return res.status(404).json({ error: 'not_found' });
  delete store.data.updates[req.params.id];
  store.save();
  res.status(204).end();
});

// ---- calls history ----
app.get('/api/v1/calls', (req, res) => {
  const auth = parseAuth(req);
  if (!auth.userId) return res.status(401).json({ error: 'unauthorized' });
  const calls = store.callsFor(auth.userId).map((c) => ({
    ...c,
    otherUserId: c.aUserId === auth.userId ? c.bUserId : c.aUserId,
    direction: c.aUserId === auth.userId ? 'outgoing' : 'incoming',
    other: store.publicProfile(c.aUserId === auth.userId ? c.bUserId : c.aUserId),
  }));
  res.json({ calls });
});

// ---- contacts / people ----
app.get('/api/v1/people', (req, res) => {
  const auth = parseAuth(req);
  if (!auth.userId) return res.status(401).json({ error: 'unauthorized' });
  const q = String(req.query.q || '').toLowerCase().trim();
  const list = Object.values(store.data.profiles)
    .filter((p) => p.userId !== auth.userId)
    .filter((p) => !q || p.username.includes(q) || p.displayName.toLowerCase().includes(q))
    .slice(0, 30)
    .map((p) => store.publicProfile(p.userId));
  res.json({ people: list });
});

// ---- search ----
app.get('/api/v1/search', (req, res) => {
  const auth = parseAuth(req);
  if (!auth.userId) return res.status(401).json({ error: 'unauthorized' });
  const q = String(req.query.q || '').toLowerCase().trim();
  if (!q) return res.json({ chats: [], people: [], messages: [] });
  const chats = Object.values(store.data.chats)
    .filter((c) => c.memberIds.includes(auth.userId!))
    .filter((c) => {
      if (c.type === 'group') return (c.name || '').toLowerCase().includes(q);
      const other = c.memberIds.find((m) => m !== auth.userId);
      const p = other ? store.publicProfile(other) : null;
      return p && (p.username.includes(q) || p.displayName.toLowerCase().includes(q));
    })
    .map((c) => ({ id: c.id, type: c.type, name: c.type === 'group' ? c.name : store.publicProfile(c.memberIds.find((m) => m !== auth.userId)!)?.displayName }));
  const people = Object.values(store.data.profiles)
    .filter((p) => p.userId !== auth.userId && (p.username.includes(q) || p.displayName.toLowerCase().includes(q)))
    .slice(0, 10)
    .map((p) => store.publicProfile(p.userId));
  const messages = Object.values(store.data.messages)
    .filter((m) => m.text.toLowerCase().includes(q))
    .filter((m) => {
      const c = store.getChat(m.chatId);
      return c && c.memberIds.includes(auth.userId!);
    })
    .slice(-20)
    .map((m) => ({ id: m.id, chatId: m.chatId, text: m.text, senderId: m.senderId, createdAt: m.createdAt }));
  res.json({ chats, people, messages });
});

// ---- games hub ----
app.get('/api/v1/games/ludo/themes', (_req, res) => res.json({ themes: BOARD_THEMES }));

// ---- static web (production) ----
const webDist = path.resolve(process.cwd(), 'web', 'dist');
app.use(express.static(webDist));

// ---- Socket.IO ----
const io = new SocketServer(server, { cors: { origin: true, credentials: true } });

const online = new Map<string, boolean>();

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  const session = token ? store.getSession(String(token)) : undefined;
  if (!session) return next(new Error('unauthorized'));
  socket.data.userId = session.userId;
  next();
});

io.on('connection', (socket) => {
  const userId = socket.data.userId as string;
  if (!userId) return;
  online.set(userId, true);

  registerChatSocket(io, socket, userId);
  registerLudoSocket(io, socket, userId);

  // ---- calls signaling (WebRTC) ----
  socket.on('call:invite', (payload: any) => {
    const targetId = String(payload?.to || '');
    const kind = payload?.kind === 'video' ? 'video' : 'voice';
    if (!store.getUser(targetId)) return;
    const call = store.addCall({ aUserId: userId, bUserId: targetId, kind, state: 'ringing' });
    for (const sid of userSocketIds(io, targetId)) {
      io.to(sid).emit('call:incoming', {
        callId: call.id,
        from: store.publicProfile(userId),
        kind,
      });
    }
  });

  socket.on('call:accept', (payload: any) => {
    const callId = String(payload?.callId || '');
    const call = store.data.calls[callId];
    if (!call || call.bUserId !== userId) return;
    store.updateCall(callId, { state: 'ongoing' });
    for (const sid of userSocketIds(io, call.aUserId)) io.to(sid).emit('call:accepted', { callId });
  });

  socket.on('call:reject', (payload: any) => {
    const callId = String(payload?.callId || '');
    const call = store.data.calls[callId];
    if (!call || call.bUserId !== userId) return;
    store.updateCall(callId, { state: 'declined', endedAt: new Date().toISOString() });
    for (const sid of userSocketIds(io, call.aUserId)) io.to(sid).emit('call:rejected', { callId });
  });

  socket.on('call:end', (payload: any) => {
    const callId = String(payload?.callId || '');
    const call = store.data.calls[callId];
    if (!call) return;
    if (call.state === 'ringing') {
      // caller cancelled before answer
      store.updateCall(callId, { state: 'declined', endedAt: new Date().toISOString() });
    } else {
      store.updateCall(callId, { state: 'ended', endedAt: new Date().toISOString() });
    }
    const others = [call.aUserId, call.bUserId].filter((u) => u !== userId);
    for (const o of others) for (const sid of userSocketIds(io, o)) io.to(sid).emit('call:ended', { callId });
  });

  // WebRTC signaling relay
  socket.on('rtc:signal', (payload: any) => {
    const targetId = String(payload?.to || '');
    for (const sid of userSocketIds(io, targetId)) {
      io.to(sid).emit('rtc:signal', { from: userId, signal: payload?.signal });
    }
  });

  socket.on('disconnect', () => {
    online.delete(userId);
  });
});

// presence snapshot endpoint for clients
app.get('/api/v1/presence', (req, res) => {
  const auth = parseAuth(req);
  if (!auth.userId) return res.status(401).json({ error: 'unauthorized' });
  const ids: string[] = [];
  for (const s of io.sockets.sockets.values()) {
    if ((s as any).data?.userId) ids.push((s as any).data.userId);
  }
  res.json({ online: Array.from(new Set(ids)) });
});

server.listen(PORT, () => {
  console.log(`[DARKNOTE] server listening on http://localhost:${PORT}`);
  console.log(`[DARKNOTE] dev verification codes are logged to console (no SMS gateway configured)`);
});
