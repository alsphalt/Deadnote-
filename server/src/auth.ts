// ============================================================
// DARKNOTE auth service — phone/email verification, sessions,
// profile onboarding. Codes are HMAC-hashed, 5-min TTL, 5
// attempts, single-use, rate-limited. In dev mode the code is
// returned in the response (no SMS gateway configured) — never
// in production.
// ============================================================

import { Router } from 'express';
import { store, parseAuth, hashCode, genCode, CODE_TTL_MS, MAX_ATTEMPTS, RATE_DAILY_MAX, RATE_WINDOW_MS } from './store.js';

export const authRouter = Router();

const PHONE_RE = /^\+[1-9]\d{6,14}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const RESERVED = new Set(['admin', 'darknote', 'support', 'moderator', 'system', 'ludo', 'game']);

// naive per-identifier rate limiting (in-memory; prod: Redis)
const requestLog: Record<string, number[]> = {};
function rateLimit(identifier: string): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const key = identifier.toLowerCase();
  const arr = (requestLog[key] = (requestLog[key] || []).filter((t) => now - t < 24 * 3600 * 1000));
  const last = arr[arr.length - 1];
  if (last && now - last < RATE_WINDOW_MS) return { ok: false, retryAfter: Math.ceil((RATE_WINDOW_MS - (now - last)) / 1000) };
  if (arr.length >= RATE_DAILY_MAX) return { ok: false, retryAfter: 3600 };
  arr.push(now);
  return { ok: true, retryAfter: 0 };
}

function sendCodeDev(identifier: string, code: string): void {
  // Dev delivery: log it. Replace with SMS/email provider adapters.
  console.log(`[DARKNOTE dev] verification code for ${identifier}: ${code}`);
}

function normalizePhone(p: string): string {
  return p.replace(/[\s-]/g, '');
}

// ---- request a code (phone) ----
authRouter.post('/phone/request', (req, res) => {
  const phone = normalizePhone(String(req.body?.phone || ''));
  if (!PHONE_RE.test(phone)) return res.status(400).json({ error: 'invalid_phone' });
  const rl = rateLimit(phone);
  if (!rl.ok) return res.status(429).json({ error: 'rate_limited', retryAfter: rl.retryAfter });
  const { devCode } = store.createVerification(phone, 'sms');
  sendCodeDev(phone, devCode);
  res.status(202).json({ ok: true, retryAfter: 0, devCode });
});

// ---- verify phone ----
authRouter.post('/phone/verify', (req, res) => {
  const phone = normalizePhone(String(req.body?.phone || ''));
  const code = String(req.body?.code || '').trim();
  if (!PHONE_RE.test(phone) || !/^\d{6}$/.test(code)) return res.status(400).json({ error: 'invalid_input' });
  const v = store.checkVerification(phone, code);
  if (!v.ok) return res.status(401).json({ error: v.reason });
  let user = store.findUserByIdentifier('phone', phone);
  const isNew = !user;
  if (!user) user = store.createUser({ phone: phone.toLowerCase() });
  else user = store.updateUser(user.id, { phone: phone.toLowerCase() });
  const session = store.createSession(user.id, String(req.body?.device || 'DARKNOTE Web'));
  res.json({ user: store.publicProfile(user.id), onboarded: user.onboarded, isNew, token: session.token });
});

// ---- email flows ----
authRouter.post('/email/request', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'invalid_email' });
  const rl = rateLimit(email);
  if (!rl.ok) return res.status(429).json({ error: 'rate_limited', retryAfter: rl.retryAfter });
  const { devCode } = store.createVerification(email, 'email');
  sendCodeDev(email, devCode);
  res.status(202).json({ ok: true, retryAfter: 0, devCode });
});

authRouter.post('/email/verify', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const code = String(req.body?.code || '').trim();
  if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(code)) return res.status(400).json({ error: 'invalid_input' });
  const v = store.checkVerification(email, code);
  if (!v.ok) return res.status(401).json({ error: v.reason });
  let user = store.findUserByIdentifier('email', email);
  const isNew = !user;
  if (!user) user = store.createUser({ email });
  const session = store.createSession(user.id, String(req.body?.device || 'DARKNOTE Web'));
  res.json({ user: store.publicProfile(user.id), onboarded: user.onboarded, isNew, token: session.token });
});

// ---- username availability ----
authRouter.post('/username/check', (req, res) => {
  const username = String(req.body?.username || '').toLowerCase();
  if (!USERNAME_RE.test(username)) return res.json({ available: false, reason: 'format' });
  if (RESERVED.has(username)) return res.json({ available: false, reason: 'reserved' });
  res.json({ available: !store.getProfileByUsername(username) });
});

// ---- create profile (onboarding) ----
authRouter.post('/profile', (req, res) => {
  const auth = parseAuth(req);
  if (!auth.userId) return res.status(401).json({ error: 'unauthorized' });
  const username = String(req.body?.username || '').toLowerCase();
  const about = String(req.body?.about || '').slice(0, 140);
  const displayName = String(req.body?.displayName || '').slice(0, 30);
  const avatarEmoji = String(req.body?.avatarEmoji || '👤').slice(0, 8);
  if (!USERNAME_RE.test(username)) return res.status(400).json({ error: 'invalid_username' });
  if (RESERVED.has(username)) return res.status(400).json({ error: 'reserved' });
  if (store.getProfileByUsername(username)) return res.status(409).json({ error: 'username_taken' });
  const prof = store.setProfile(auth.userId, { username, displayName: displayName || username, about, avatarEmoji });
  store.updateUser(auth.userId, { onboarded: true });
  res.json({ profile: prof, user: store.publicProfile(auth.userId) });
});

// ---- session helpers ----
authRouter.get('/me', (req, res) => {
  const auth = parseAuth(req);
  if (!auth.userId) return res.status(401).json({ error: 'unauthorized' });
  res.json({
    user: store.publicProfile(auth.userId),
    onboarded: store.getUser(auth.userId)?.onboarded,
    gameProfile: store.gameProfile(auth.userId),
  });
});

authRouter.post('/logout', (req, res) => {
  const auth = parseAuth(req);
  if (auth.session) store.deleteSession(auth.session.token);
  res.status(204).end();
});

authRouter.get('/sessions', (req, res) => {
  const auth = parseAuth(req);
  if (!auth.userId) return res.status(401).json({ error: 'unauthorized' });
  const list = Object.values(store.data.sessions).filter((s) => s.userId === auth.userId);
  res.json({ sessions: list.map((s) => ({ deviceName: s.deviceName, createdAt: s.createdAt, lastActiveAt: s.lastActiveAt, current: s.token === auth.session?.token })) });
});

authRouter.post('/sessions/revoke', (req, res) => {
  const auth = parseAuth(req);
  if (!auth.userId) return res.status(401).json({ error: 'unauthorized' });
  const token = String(req.body?.token || '');
  const s = store.data.sessions[token];
  if (s && s.userId === auth.userId) store.deleteSession(token);
  res.status(204).end();
});
