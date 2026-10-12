# DARKNOTE

A social communication platform with integrated games — dark glass design, realtime chat, WebRTC calls, and a fully playable authoritative Ludo engine with 5 AI difficulties and 6 board themes.

```
DARKNOTE
├── Home          (activity dashboard + quick actions)
├── Updates       (status cards, 24h expiry, viewers)
├── Chats         (realtime, read receipts, groups, polls, reactions)
├── Calls         (WebRTC voice/video + history)
├── Games
│   └── Ludo      (Quick Play · VS Computer · Create Room · Join Room · Bet Mode stub)
├── Contacts
└── Settings      (profile, privacy, security, devices, notifications)
```

## Quick start

```bash
npm install        # installs server + web workspaces
npm run dev        # server :4000 + web :5173 (Vite proxies /api + /socket.io)
```

Then open **http://localhost:5173**.

- Sign up with phone or email. **Dev mode**: the 6-digit verification code is returned in the API response and shown on screen (no SMS/email gateway configured) — in production, replace `sendCodeDev` with a provider adapter.
- Two players? Open a second browser and use **Create Room** → share the room code → **Join Room**. Multiplayer is server-validated over Socket.IO.
- Play **VS Computer** with any of the 5 AI modes (Trainer/Beginner/Professional/Pro/Wise).

Production: `npm run build` then `npm start` (server serves `web/dist` at :4000).

## Architecture

```
web/       React 18 + Vite + TS (design system, screens, SVG Ludo board)
server/    Express + Socket.IO + TS (auth, chats, rooms; JSON-file store for dev)
shared/    Ludo engine + AI — pure TS, framework-free, used by server AND browser
scripts/   smoke-test.mjs (auth + realtime + AI simulation), ai-debug*.mjs
```

**Engine authority** — the browser never decides validity:
- Verification codes: HMAC-hashed, 5-min TTL, single-use, 5 attempts, rate-limited.
- Messages: `clientId` idempotency, watermark-based read receipts, server-computed unread counts.
- Ludo: clients send intents (`game:roll`, `game:move`); the server validates every move against the shared engine and broadcasts snapshots. Dice come from the server CSPRNG.
- AI: all modes roll the same dice and obey the same rules — difficulty comes from decision quality (heuristics + blunder rates), never from cheating.

**Ludo engine** (§spec): 52-cell loop + 5-cell home columns + center (57-step progress model), 8 safe cells, captures, blocks, exact-finish, 2/3/4-player, six-rules. One engine powers local, multiplayer, and every AI mode; the 6 board themes (Classic/Neon/Royal/Galaxy/DARKNOTE/3D Table) are pure visual layers.

## Smoke test

```bash
node scripts/smoke-test.mjs   # needs the server running (npm run dev:server)
```

Covers: phone/email verification (wrong code, single-use), session + profile, realtime message send/broadcast, read receipts → unread 0, persistence, and a 200-game AI simulation (Wise must dominate Beginner).

## Notes / v1 scope

- Verification codes are returned in dev responses only; production requires SMS/email providers + stricter secret handling (see spec §4.4, §27).
- JSON-file store (dev) — swap for PostgreSQL/Redis via the `Store` class without touching routes.
- Bet Mode is an entry stub; real-money wagering is disabled until legal/compliance is defined.
- The 3D Table theme is a stylized 2.5D renderer in this build; a full Three.js table is the planned enhancement.
- Full product spec: `DARKNOTE-SPEC.md` (sections §1–§30 map to this implementation).
