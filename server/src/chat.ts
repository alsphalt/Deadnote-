// ============================================================
// DARKNOTE chat service — REST + Socket.IO. Server-authoritative:
// message send/read/typing/presence with watermark-based unread
// counts and clientId idempotency.
// ============================================================

import { Router } from 'express';
import type { Server as SocketServer, Socket } from 'socket.io';
import { store, parseAuth, uid, Message } from './store.js';

export const chatRouter = Router();

function lastMessageFor(chatId: string): Message | undefined {
  const list = store.chatMessages(chatId, undefined, 1);
  return list[list.length - 1];
}

// ---- REST ----

chatRouter.get('/chats', (req, res) => {
  const auth = parseAuth(req);
  if (!auth.userId) return res.status(401).json({ error: 'unauthorized' });
  const chats = Object.values(store.data.chats)
    .filter((c) => c.memberIds.includes(auth.userId!))
    .sort((a, b) => (a.lastActivityAt < b.lastActivityAt ? 1 : -1))
    .map((c) => {
      const other = c.type === 'direct' ? c.memberIds.find((m) => m !== auth.userId) : null;
      const last = lastMessageFor(c.id);
      return {
        id: c.id,
        type: c.type,
        name: c.type === 'group' ? c.name : other ? store.publicProfile(other)?.displayName : 'DARKNOTE',
        otherUserId: other,
        other: other ? store.publicProfile(other) : null,
        members: c.memberIds,
        lastMessage: last ? { text: last.text, type: last.type, senderId: last.senderId, createdAt: last.createdAt, status: last.status } : null,
        unread: store.unreadFor(c.id, auth.userId!),
        pinned: !!c.pinnedBy[auth.userId!],
        muted: !!c.mutedBy[auth.userId!],
        createdAt: c.createdAt,
        lastActivityAt: c.lastActivityAt,
      };
    });
  res.json({ chats });
});

chatRouter.get('/chats/:id/messages', (req, res) => {
  const auth = parseAuth(req);
  if (!auth.userId) return res.status(401).json({ error: 'unauthorized' });
  const chat = store.getChat(req.params.id);
  if (!chat || !chat.memberIds.includes(auth.userId)) return res.status(404).json({ error: 'not_found' });
  const before = req.query.before as string | undefined;
  const messages = store.chatMessages(chat.id, before, 60);
  res.json({ messages, readBy: chat.readBy });
});

// direct chat lookup/create by other user id
chatRouter.post('/chats/direct', (req, res) => {
  const auth = parseAuth(req);
  if (!auth.userId) return res.status(401).json({ error: 'unauthorized' });
  const otherId = String(req.body?.userId || '');
  if (!store.getUser(otherId)) return res.status(404).json({ error: 'not_found' });
  if (otherId === auth.userId) return res.status(400).json({ error: 'self' });
  const existing = Object.values(store.data.chats).find(
    (c) => c.type === 'direct' && c.memberIds.includes(auth.userId!) && c.memberIds.includes(otherId)
  );
  const chat = existing ?? store.createChat({ type: 'direct', memberIds: [auth.userId!, otherId] });
  res.json({ chat: { id: chat.id, type: chat.type, name: store.publicProfile(otherId)?.displayName, otherUserId: otherId } });
});

// group creation (light v1)
chatRouter.post('/groups', (req, res) => {
  const auth = parseAuth(req);
  if (!auth.userId) return res.status(401).json({ error: 'unauthorized' });
  const name = String(req.body?.name || 'Group').slice(0, 50);
  const memberIds: string[] = Array.from(new Set([auth.userId, ...(req.body?.memberIds || []).map(String)]));
  const chat = store.createChat({ type: 'group', name, memberIds });
  res.json({ chat: { id: chat.id, type: 'group', name } });
});

// ---- Socket.IO handlers ----

export function registerChatSocket(io: SocketServer, socket: Socket, userId: string): void {
  // presence
  socket.join('presence');
  io.to('presence').emit('presence:update', { userId, online: true });
  socket.data.userId = userId;

  socket.on('chat:join', (chatId: string) => {
    const chat = store.getChat(String(chatId));
    if (chat && chat.memberIds.includes(userId)) socket.join(`chat:${chat.id}`);
  });

  socket.on('message:send', (payload: any, ack?: (r: any) => void) => {
    try {
      const chatId = String(payload?.chatId || '');
      const clientId = String(payload?.clientId || uid());
      const chat = store.getChat(chatId);
      if (!chat || !chat.memberIds.includes(userId)) {
        ack?.({ ok: false, error: 'forbidden' });
        return;
      }
      // idempotency: same clientId twice → return existing
      const dup = Object.values(store.data.messages).find((m) => m.clientId === clientId && m.chatId === chatId);
      if (dup) {
        ack?.({ ok: true, message: dup });
        return;
      }
      const msg = store.addMessage({
        clientId,
        chatId,
        senderId: userId,
        type: (payload?.type as any) || 'text',
        text: String(payload?.text || '').slice(0, 4000),
        meta: payload?.meta,
        replyToId: payload?.replyToId ? String(payload.replyToId) : null,
      });
      io.to(`chat:${chatId}`).emit('message:new', { message: msg });
      ack?.({ ok: true, message: msg });
    } catch (e) {
      ack?.({ ok: false, error: 'internal' });
    }
  });

  socket.on('message:read', (payload: any) => {
    const chatId = String(payload?.chatId || '');
    const upTo = String(payload?.upTo || '');
    const chat = store.getChat(chatId);
    if (!chat || !chat.memberIds.includes(userId)) return;
    store.markRead(chatId, userId, upTo);
    // notify senders that their messages were read
    io.to(`chat:${chatId}`).emit('message:read-receipt', { chatId, userId, upTo });
  });

  socket.on('typing', (payload: any) => {
    const chatId = String(payload?.chatId || '');
    const chat = store.getChat(chatId);
    if (!chat || !chat.memberIds.includes(userId)) return;
    socket.to(`chat:${chatId}`).emit('typing', { chatId, userId, isTyping: !!payload?.isTyping });
  });

  socket.on('chat:create-group', (payload: any, ack?: (r: any) => void) => {
    const name = String(payload?.name || 'Group').slice(0, 50);
    const memberIds: string[] = Array.from(new Set([userId, ...(payload?.memberIds || []).map(String)]));
    const chat = store.createChat({ type: 'group', name, memberIds });
    for (const m of memberIds) {
      io.emit('chat:added', { chatId: chat.id, userId: m });
    }
    ack?.({ ok: true, chat: { id: chat.id, type: 'group', name } });
  });

  socket.on('disconnect', () => {
    io.to('presence').emit('presence:update', { userId, online: false });
  });
}

export function userSocketIds(io: SocketServer, userId: string): string[] {
  const ids: string[] = [];
  for (const [id, s] of io.sockets.sockets) {
    if ((s as any).data?.userId === userId) ids.push(id);
  }
  return ids;
}
