// ============================================================
// DARKNOTE server — JSON-file store (dev). Production: swap for
// PostgreSQL/Redis without changing the API surface.
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export interface User {
  id: string;
  phone?: string;
  email?: string;
  onboarded: boolean;
  createdAt: string;
}

export interface Profile {
  userId: string;
  username: string;     // unique, lowercased
  displayName: string;
  about: string;
  avatarEmoji: string;  // v1 avatar: emoji/initial glyph
}

export interface Session {
  token: string;
  userId: string;
  deviceName: string;
  createdAt: string;
  lastActiveAt: string;
}

export interface Verification {
  id: string;
  identifier: string;
  channel: 'sms' | 'email';
  codeHash: string;
  salt: string;
  attempts: number;
  expiresAt: string;
  consumedAt: string | null;
}

export type MsgType = 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'poll' | 'game-invite' | 'system';
export type MsgStatus = 'sent' | 'delivered' | 'read';

export interface Message {
  id: string;
  clientId: string;         // idempotency key
  chatId: string;
  senderId: string;
  type: MsgType;
  text: string;
  meta?: any;               // media info, poll, invite payload
  status: MsgStatus;
  createdAt: string;
  deliveredAt?: string;
  readAt?: string;
  replyToId?: string | null;
}

export interface Chat {
  id: string;
  type: 'direct' | 'group';
  name?: string;            // group name
  memberIds: string[];
  pinnedBy: Record<string, boolean>;
  mutedBy: Record<string, boolean>;
  readBy: Record<string, string>;   // userId -> lastReadMessageId
  createdAt: string;
  lastActivityAt: string;
}

export interface Update {
  id: string;
  userId: string;
  type: 'text' | 'image' | 'video';
  text: string;
  mediaEmoji: string;
  privacy: string;
  viewerIds: string[];
  createdAt: string;
  expiresAt: string;
}

export interface CallRecord {
  id: string;
  aUserId: string;
  bUserId: string;
  kind: 'voice' | 'video';
  state: 'ringing' | 'ongoing' | 'ended' | 'missed' | 'declined';
  startedAt: string;
  endedAt?: string;
}

export interface GameProfile {
  userId: string;
  played: number;
  won: number;
  xp: number;
  level: number;
}

export interface DB {
  users: Record<string, User>;
  profiles: Record<string, Profile>;
  sessions: Record<string, Session>;
  verifications: Record<string, Verification>;
  chats: Record<string, Chat>;
  messages: Record<string, Message>;
  updates: Record<string, Update>;
  calls: Record<string, CallRecord>;
  gameProfiles: Record<string, GameProfile>;
}

export const CODE_TTL_MS = 5 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
export const RATE_WINDOW_MS = 60 * 1000;
export const RATE_DAILY_MAX = 10;

export function uid(): string {
  return crypto.randomUUID();
}

export function newToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

const CODE_SECRET = process.env.DARKNOTE_CODE_SECRET || 'dev-secret-change-me';

export function hashCode(code: string, salt: string): string {
  return crypto.createHmac('sha256', CODE_SECRET).update(salt + '|' + code).digest('hex');
}

export function genCode(): string {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

export class Store {
  private db: DB;
  private file: string;

  constructor(dir: string) {
    this.file = path.join(dir, 'db.json');
    fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(this.file)) {
      this.db = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
    } else {
      this.db = { users: {}, profiles: {}, sessions: {}, verifications: {}, chats: {}, messages: {}, updates: {}, calls: {}, gameProfiles: {} };
      this.save();
    }
  }

  save(): void {
    fs.writeFileSync(this.file, JSON.stringify(this.db, null, 2));
  }

  get data(): DB {
    return this.db;
  }

  // ---- users / profiles ----
  findUserByIdentifier(kind: 'phone' | 'email', value: string): User | undefined {
    const v = value.toLowerCase();
    return Object.values(this.db.users).find((u) =>
      kind === 'phone' ? u.phone === v : u.email === v
    );
  }

  createUser(partial: Partial<User>): User {
    const u: User = { id: uid(), onboarded: false, createdAt: new Date().toISOString(), ...partial };
    this.db.users[u.id] = u;
    this.save();
    return u;
  }

  getUser(id: string): User | undefined {
    return this.db.users[id];
  }

  updateUser(id: string, patch: Partial<User>): User {
    this.db.users[id] = { ...this.db.users[id], ...patch };
    this.save();
    return this.db.users[id];
  }

  getProfile(userId: string): Profile | undefined {
    return this.db.profiles[userId];
  }

  getProfileByUsername(username: string): Profile | undefined {
    const u = username.toLowerCase();
    return Object.values(this.db.profiles).find((p) => p.username === u);
  }

  setProfile(userId: string, p: Omit<Profile, 'userId'>): Profile {
    const prof: Profile = { userId, ...p };
    this.db.profiles[userId] = prof;
    this.save();
    return prof;
  }

  publicProfile(userId: string): any {
    const u = this.getUser(userId);
    const p = this.getProfile(userId);
    if (!u) return null;
    return {
      id: userId,
      username: p?.username ?? u.phone ?? u.email,
      displayName: p?.displayName ?? p?.username ?? 'DARKNOTE user',
      about: p?.about ?? '',
      avatarEmoji: p?.avatarEmoji ?? '👤',
    };
  }

  // ---- sessions ----
  createSession(userId: string, deviceName: string): Session {
    const s: Session = { token: newToken(), userId, deviceName, createdAt: new Date().toISOString(), lastActiveAt: new Date().toISOString() };
    this.db.sessions[s.token] = s;
    this.save();
    return s;
  }

  getSession(token: string): Session | undefined {
    const s = this.db.sessions[token];
    if (s) {
      s.lastActiveAt = new Date().toISOString();
    }
    return s;
  }

  deleteSession(token: string): void {
    delete this.db.sessions[token];
    this.save();
  }

  deleteUserSessions(userId: string): void {
    for (const k of Object.keys(this.db.sessions)) {
      if (this.db.sessions[k].userId === userId) delete this.db.sessions[k];
    }
    this.save();
  }

  // ---- verification ----
  createVerification(identifier: string, channel: 'sms' | 'email'): { id: string; devCode: string } {
    const code = genCode();
    const salt = crypto.randomBytes(8).toString('hex');
    const v: Verification = {
      id: uid(), identifier: identifier.toLowerCase(), channel,
      codeHash: hashCode(code, salt), salt,
      attempts: 0,
      expiresAt: new Date(Date.now() + CODE_TTL_MS).toISOString(),
      consumedAt: null,
    };
    this.db.verifications[v.id] = v;
    this.save();
    return { id: v.id, devCode: code };
  }

  checkVerification(identifier: string, code: string): { ok: boolean; reason?: string } {
    const id = identifier.toLowerCase();
    const candidates = Object.values(this.db.verifications)
      .filter((v) => v.identifier === id && v.consumedAt === null)
      .sort((a, b) => (a.expiresAt < b.expiresAt ? -1 : 1));
    const v = candidates[candidates.length - 1];
    if (!v) return { ok: false, reason: 'no_code' };
    if (new Date(v.expiresAt).getTime() < Date.now()) return { ok: false, reason: 'expired' };
    if (v.attempts >= MAX_ATTEMPTS) return { ok: false, reason: 'too_many_attempts' };
    const ok = hashCode(code, v.salt) === v.codeHash;
    if (ok) {
      v.consumedAt = new Date().toISOString();
      this.save();
      return { ok: true };
    }
    v.attempts += 1;
    this.save();
    return { ok: false, reason: 'invalid' };
  }

  // ---- chats / messages ----
  createChat(c: Omit<Chat, 'id' | 'readBy' | 'pinnedBy' | 'mutedBy' | 'createdAt' | 'lastActivityAt'>): Chat {
    const chat: Chat = {
      ...c,
      id: uid(),
      readBy: {},
      pinnedBy: {},
      mutedBy: {},
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
    };
    for (const m of chat.memberIds) chat.readBy[m] = '';
    this.db.chats[chat.id] = chat;
    this.save();
    return chat;
  }

  getChat(id: string): Chat | undefined {
    return this.db.chats[id];
  }

  updateChat(id: string, patch: Partial<Chat>): Chat {
    this.db.chats[id] = { ...this.db.chats[id], ...patch };
    this.save();
    return this.db.chats[id];
  }

  addMessage(m: Omit<Message, 'id' | 'createdAt' | 'status'>): Message {
    const msg: Message = { ...m, id: uid(), status: 'sent', createdAt: new Date().toISOString() };
    this.db.messages[msg.id] = msg;
    const chat = this.db.chats[msg.chatId];
    if (chat) chat.lastActivityAt = msg.createdAt;
    this.save();
    return msg;
  }

  getMessage(id: string): Message | undefined {
    return this.db.messages[id];
  }

  updateMessage(id: string, patch: Partial<Message>): Message {
    this.db.messages[id] = { ...this.db.messages[id], ...patch };
    this.save();
    return this.db.messages[id];
  }

  chatMessages(chatId: string, before?: string, limit = 100): Message[] {
    const list = Object.values(this.db.messages)
      .filter((m) => m.chatId === chatId && (!before || m.id < before))
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    return list.slice(-limit);
  }

  /** Server-computed unread counts per chat for a user (watermark-based). */
  unreadFor(chatId: string, userId: string): number {
    const chat = this.db.chats[chatId];
    if (!chat) return 0;
    const mark = chat.readBy[userId] || '';
    let n = 0;
    for (const m of Object.values(this.db.messages)) {
      if (m.chatId === chatId && m.senderId !== userId && m.id > mark) n++;
    }
    return n;
  }

  markRead(chatId: string, userId: string, upToMessageId: string): void {
    const chat = this.db.chats[chatId];
    if (!chat) return;
    const cur = chat.readBy[userId] || '';
    if (upToMessageId > cur) {
      chat.readBy[userId] = upToMessageId;
      // mark messages from other senders as delivered+read
      for (const m of Object.values(this.db.messages)) {
        if (m.chatId === chatId && m.senderId !== userId && m.id <= upToMessageId) {
          if (m.status === 'sent') { m.status = 'delivered'; m.deliveredAt = new Date().toISOString(); }
          if (m.status === 'delivered') { m.status = 'read'; m.readAt = new Date().toISOString(); }
        }
      }
      this.save();
    }
  }

  // ---- updates ----
  addUpdate(u: Omit<Update, 'id' | 'viewerIds' | 'expiresAt' | 'createdAt'>): Update {
    const upd: Update = {
      ...u, id: uid(), viewerIds: [], createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    };
    this.db.updates[upd.id] = upd;
    this.save();
    return upd;
  }

  liveUpdates(userId: string, contactIds: string[]): Update[] {
    const now = Date.now();
    return Object.values(this.db.updates)
      .filter((u) => (u.userId === userId || contactIds.includes(u.userId)) && new Date(u.expiresAt).getTime() > now)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  viewUpdate(id: string, viewerId: string): void {
    const u = this.db.updates[id];
    if (u && !u.viewerIds.includes(viewerId)) {
      u.viewerIds.push(viewerId);
      this.save();
    }
  }

  // ---- calls ----
  addCall(c: Omit<CallRecord, 'id' | 'startedAt'>): CallRecord {
    const call: CallRecord = { ...c, id: uid(), startedAt: new Date().toISOString() };
    this.db.calls[call.id] = call;
    this.save();
    return call;
  }

  updateCall(id: string, patch: Partial<CallRecord>): CallRecord {
    this.db.calls[id] = { ...this.db.calls[id], ...patch };
    this.save();
    return this.db.calls[id];
  }

  callsFor(userId: string): CallRecord[] {
    return Object.values(this.db.calls)
      .filter((c) => c.aUserId === userId || c.bUserId === userId)
      .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  }

  // ---- game profile ----
  gameProfile(userId: string): GameProfile {
    let g = this.db.gameProfiles[userId];
    if (!g) {
      g = { userId, played: 0, won: 0, xp: 0, level: 1 };
      this.db.gameProfiles[userId] = g;
      this.save();
    }
    return g;
  }

  recordGame(userId: string, won: boolean, xpGain: number): GameProfile {
    const g = this.gameProfile(userId);
    g.played += 1;
    if (won) g.won += 1;
    g.xp += xpGain;
    g.level = Math.floor(g.xp / 500) + 1;
    this.save();
    return g;
  }
}

export function parseAuth(req: any): { userId: string | null; session: Session | null } {
  const h = req.headers['authorization'] || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return { userId: null, session: null };
  const s = store.getSession(token);
  return s ? { userId: s.userId, session: s } : { userId: null, session: null };
}

const dataDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'data');
export const store = new Store(dataDir);
