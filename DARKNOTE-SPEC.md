# DARKNOTE — Complete Developer Specification

| Field | Value |
|---|---|
| Product | DARKNOTE Web — social communication platform with integrated games |
| Version | 1.0 |
| Date | 2026-08-27 |
| Status | Ready for build planning |
| Audience | Engineering (frontend, backend, game, infra) |

This document formalizes the product brief into an actionable engineering specification: design system, information architecture, screen inventory, flows, data contracts, API design, realtime protocol, the authoritative Ludo engine, AI opponent design, board themes, security model, and a phased build plan.

Where the brief left a decision open, this document makes a recommendation and marks it **[Decision]**.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Design System](#2-design-system)
3. [Information Architecture](#3-information-architecture)
4. [Authentication & Onboarding](#4-authentication--onboarding)
5. [App Shell & Navigation](#5-app-shell--navigation)
6. [Home Dashboard](#6-home-dashboard)
7. [Updates (Status)](#7-updates-status)
8. [Chats](#8-chats)
9. [Calls](#9-calls)
10. [Groups](#10-groups)
11. [Message Features](#11-message-features)
12. [Polls](#12-polls)
13. [Settings](#13-settings)
14. [Contacts](#14-contacts)
15. [Block & Report](#15-block--report)
16. [Search](#16-search)
17. [Games Platform](#17-games-platform)
18. [Ludo Engine (Authoritative)](#18-ludo-engine-authoritative)
19. [Ludo Board UI & Themes](#19-ludo-board-ui--themes)
20. [Ludo Multiplayer Table](#20-ludo-multiplayer-table)
21. [AI Players](#21-ai-players)
22. [Game Progression](#22-game-progression)
23. [Bet Mode (Modular, Not v1)](#23-bet-mode-modular-not-v1)
24. [Game Invitations](#24-game-invitations)
25. [Backend Architecture](#25-backend-architecture)
26. [Realtime & Offline Behavior](#26-realtime--offline-behavior)
27. [Security](#27-security)
28. [Responsive & Performance](#28-responsive--performance)
29. [Build Plan (Phases)](#29-build-plan-phases)
30. [Definition of Done & Open Questions](#30-definition-of-done--open-questions)

---

## 1. Product Overview

### 1.1 Vision

DARKNOTE is a social communication platform with integrated games. It borrows the *familiarity* of a messaging app (chats, status, calls, groups) so that anyone who knows WhatsApp can use it instantly — but its visual identity, navigation, interactions, and built-in Ludo platform make it unmistakably DARKNOTE. Games are a first-class part of the platform, not an afterthought.

### 1.2 Non-negotiable engineering principles

1. **Server authority.** The browser never decides whether something is valid: message delivery, verification codes, Ludo moves, dice results, room membership, and settlement all pass through the backend. Frontend values are treated as untrusted input.
2. **Engine/UI separation.** The Ludo rules engine and the AI players are pure, framework-free modules. Boards, pieces, dice, and effects are visual themes layered on top. One engine powers 2/3/4-player, multiplayer, bot mode, every AI difficulty, and future game modes.
3. **No-cheating AI.** Every AI — including Wise — rolls the same dice, follows the same rules, and sees only public information. Difficulty comes from decision quality, never from altered dice or hidden state.
4. **Verification security.** Verification codes expire, are single-use, have limited attempts, are rate-limited, and are never stored in plaintext or shipped in frontend code.
5. **Idempotency.** Every message and game action carries a unique client-generated ID; the server deduplicates. Reconnects never duplicate messages or moves.
6. **Modular platform.** Games, attachments, AI modes, and board themes are pluggable so new features can be added without rewriting the core.
7. **Not a WhatsApp clone.** Every screen has its own DARKNOTE identity: dark glass surfaces, luminous accents, rounded cards, custom status cards, call screens, group pages, and a distinctive game button.

### 1.3 v1 Scope

| In scope (v1) | Out of scope (v1) |
|---|---|
| Phone & email verification auth, profile setup, welcome | Real-money Bet Mode (architecture hooks only) |
| Home dashboard, Updates, Chats, Calls, Groups, Contacts | Light theme (architecture supports it) |
| Full messaging: text, media, docs, voice notes, polls, reactions, replies | Native mobile/desktop apps (responsive web only) |
| WebRTC voice & video calls (browser) | Production push infrastructure (Web Push API is a stub) |
| Ludo: local vs AI, multiplayer rooms, 6 board themes, game chat, voice/camera in room | Admin panel UI (report moderation API + queue only) |
| Settings, privacy, security, devices, notifications | International SMS provider contracts (adapter interface only) |

### 1.4 Differentiators (identity, not features)

- **Game-first identity** — Games tab, header game button, Home "Play" action, chat-level game invitations.
- **Room system** — temporary multiplayer rooms with shareable codes and board themes.
- **Activity dashboard** — Home aggregates chats, updates, calls, and game results.
- **Rich profiles** — globally unique username, about, styled profile headers.
- **Chat ↔ game connection** — invite friends to Ludo directly from any conversation or group.

---

## 2. Design System

### 2.1 Design principles

Dark base, soft luminous accents, rounded glass-like cards, minimal shadows, clean typography, short smooth animations, restrained glow (readability first). The system is dark-only in v1; tokens are structured so a light theme can be added later.

### 2.2 Color tokens

| Token | Value | Usage |
|---|---|---|
| `bg/base` | `#0B0E14` | App background |
| `bg/surface` | `#12161F` | Cards, sheets |
| `bg/elevated` | `#181E2B` | Popovers, menus |
| `bg/glass` | `rgba(24,30,43,0.72)` + `backdrop-filter: blur(16px)` | Floating bars, headers |
| `text/primary` | `#F4F6FB` | Primary text |
| `text/secondary` | `#9AA3B5` | Secondary text, timestamps |
| `text/muted` | `#5C6474` | Placeholders, captions |
| `accent/violet` | `#7C5CFF` | Primary brand action |
| `accent/cyan` | `#22D3EE` | Secondary accent, links |
| `accent/gradient` | `linear-gradient(135deg, #7C5CFF, #22D3EE)` | Game button, logo, highlights |
| `success` | `#2EE6A8` | Sent/delivered states, positive |
| `warning` | `#FFB020` | Warnings |
| `danger` | `#FF5C7C` | Errors, end-call, destructive |
| `glow/violet` | `0 0 24px rgba(124,92,255,0.35)` | Focused/active elements |
| `glow/cyan` | `0 0 18px rgba(34,211,238,0.30)` | Game accents |

**Ludo player colors** (used in engine and themes):

| Player | Color | Hex |
|---|---|---|
| Red | `#FF4757` | `game/red` |
| Green | `#2ED573` | `game/green` |
| Yellow | `#FFA502` | `game/yellow` |
| Blue | `#3742FA` | `game/blue` |

### 2.3 Typography

| Role | Font | Sizes |
|---|---|---|
| Display / headings | Space Grotesk | 24 / 32 / 44 |
| Body / UI | Inter | 12 / 14 / 16 / 20 |
| Codes & numbers (room codes, dice, timers) | JetBrains Mono | 14 / 18 / 24 |

Line height 1.4 (body), 1.15 (headings). Weight 500–700 for emphasis; avoid light weights on dark backgrounds.

### 2.4 Spacing, radius, elevation

- 4px spacing grid (4/8/12/16/20/24/32/48).
- Radius: `sm` 10, `md` 16, `lg` 20, `xl` 28, `pill` 999.
- Elevation is minimal: level 1 = `0 2px 12px rgba(0,0,0,0.4)` (cards), level 2 = `0 8px 32px rgba(0,0,0,0.55)` (modals, sheets). Glow replaces shadow for emphasis.

### 2.5 Motion tokens

| Token | Value | Use |
|---|---|---|
| `dur/fast` | 120ms | Hover, active states |
| `dur/base` | 200ms | Toggles, small reveals |
| `dur/slow` | 300ms | Panels, page transitions |
| `ease/out` | `cubic-bezier(0.22, 1, 0.36, 1)` | Standard exit |
| `ease/spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Tokens, game pieces |
| Ludo token travel | 90–110ms per cell | `ease/spring` |
| AI thinking delay | 600–1500ms by mode | See §21.5 |
| Welcome screen | 5000ms total | See §4.6 |

Respect `prefers-reduced-motion`: replace travel/glow animations with simple fades.

### 2.6 Component inventory

Buttons (primary/gradient/ghost/danger/icon), cards, avatar (with online dot, size scale 28–120), status cards, chips, inputs, OTP input, bottom sheet, modal, snackbar/toast, segmented control, switch, slider, tabs, nav rail/bottom bar, player seat card, dice control, game piece, emoji picker, attachment sheet, message bubble (own/other/system), call screen, device card, setting row, search bar.

### 2.7 Iconography & accessibility

- 1.5px-stroke line icons for UI; expressive filled glyphs for games/status.
- Contrast ≥ 4.5:1 for text; focus rings visible (`2px accent/violet` offset).
- Touch targets ≥ 44px on mobile; keyboard navigation on desktop.
- All animations reducible; all interactive elements have accessible names.

---

## 3. Information Architecture

### 3.1 Sitemap

```
DARKNOTE
├── Auth
│   ├── Entry (phone / email choice)
│   ├── Phone verify
│   ├── Email verify
│   ├── Profile setup
│   └── Welcome (5s)
├── App (authenticated)
│   ├── Home
│   ├── Updates
│   ├── Chats
│   │   ├── Personal chats
│   │   └── Groups
│   ├── Calls
│   ├── Games
│   │   └── Ludo
│   │       ├── Quick Play (vs AI, fast config)
│   │       ├── Create Room
│   │       ├── Join Room
│   │       ├── VS Computer
│   │       └── Bet Mode (entry only, "coming soon")
│   ├── Contacts
│   └── Settings (Profile / Account / Privacy / Security / Notifications /
│       Chats / Calls / Updates / Groups / Storage / Appearance / Language /
│       Data usage / Devices / Help / About)
└── Deep links: /ludo/join/:code, /ludo/invite/:id, /profile/:username
```

### 3.2 Navigation rules

- **Mobile**: bottom bar with 5 tabs — Home, Updates, Chats, Calls, Games — plus the header's game button (`🎮`) as a secondary Games shortcut. Opening a chat/group/call/game hides the bottom bar (full-screen experience); back gesture/button returns.
- **Desktop**: persistent left rail (same 5 items, stacked) + Settings entry at the bottom. Chats opens a two-pane layout (chat list sidebar + conversation panel). Games and Calls open their own full panels; Ludo uses the dedicated table layout (§19.5).
- Unread/notification counts badge the Chats, Updates, Calls, and Games tabs.
- The header game button is present on Home, Chats, Groups, and Updates screens; it opens the Games hub.

### 3.3 Screen inventory

| Route | Screen | Access | Notes |
|---|---|---|---|
| `/` | Auth entry | Anonymous | Brand + phone/email choice |
| `/verify` | Code entry | Anonymous | Phone or email, resend |
| `/setup` | Profile setup | Verified, no profile | Avatar, username, about |
| `/welcome` | Welcome splash | New profile | 5s auto-advance |
| `/app/home` | Home dashboard | Authenticated | §6 |
| `/app/updates` | Updates feed | Authenticated | §7 |
| `/app/chats` | Chat list | Authenticated | §8 |
| `/app/chats/:chatId` | Conversation | Authenticated | Full-screen on mobile |
| `/app/groups/:groupId` | Group info | Member | §10 |
| `/app/calls` | Calls list | Authenticated | History + dial |
| `/app/games` | Games hub | Authenticated | Ludo card + future slots |
| `/app/games/ludo` | Ludo main | Authenticated | §18 entry |
| `/app/games/ludo/room/:code` | Room / table | Authenticated | Live game UI |
| `/app/contacts` | Contacts | Authenticated | §14 |
| `/app/settings/*` | Settings sections | Authenticated | §13 |
| `/ludo/join/:code` | Deep-link join | Authenticated | Validates + enters room |

### 3.4 Global elements

- **Header**: `DARKNOTE` wordmark (gradient accent), `🎮` game button, search entry, connection status pill (`Connected` / `Connecting…` / `Reconnecting…`), avatar menu.
- **Connection status**: global pill; when offline, chat UI stays usable with an outbox (§26).
- **Game button**: animated gradient pill — the distinctive DARKNOTE element (§9 of the brief).

---

## 4. Authentication & Onboarding

### 4.1 Entry screen

Anonymous users see the branded DARKNOTE entry screen with two paths, both equivalent in security:

```
┌─────────────────────────────┐
│         DARKNOTE            │
│                             │
│  Continue with phone number │
│  Continue with email        │
│                             │
│  Privacy · Terms            │
└─────────────────────────────┘
```

- No guest access. Every feature requires a verified identity.
- The same account can later add the other identifier from Settings → Account (verification required for each change).

### 4.2 Phone flow (state machine)

```
Enter phone (E.164 + country code)
        ↓  POST /auth/phone/request
Send verification code by SMS
        ↓  (provider adapter: Twilio / MessageBird / …)
Enter 6-digit code (OTP input)
        ↓  POST /auth/phone/verify
Verify code (server-side, single-use)
        ↓
Continue → existing user: session issued → /app/home
        → new user: onboard=true → /setup
```

UI states: `idle → requesting → code-sent → verifying → success | error`.
Errors surfaced distinctly: invalid format, rate-limited (retry-after shown), code expired (resend offered), code invalid (attempts remaining shown), too many attempts (invalidated, new code required).

### 4.3 Email flow

Identical state machine with email instead of phone:

```
Enter email → POST /auth/email/request → code emailed → enter code → POST /auth/email/verify → continue
```

Email format validated (RFC-compliant regex + DNS-level check skipped in dev), normalized to lowercase.

### 4.4 Verification code security (hard requirements)

1. 6-digit numeric codes, generated by `crypto.randomInt` (CSPRNG) on the server.
2. **TTL 5 minutes**; expired codes are rejected.
3. **Single-use**: successful verification invalidates the code immediately; resend invalidates the previous code.
4. **Limited attempts**: max 5 verify attempts per code, then the code is invalidated and a new one must be requested.
5. **Rate limits**: 1 request per 60s per identifier; 10 requests per 24h per identifier; per-IP caps as a secondary guard.
6. **Never stored in plaintext.** Stored as `HMAC-SHA256(serverSecret, salt || code)` with a per-request random salt; compared with constant-time comparison. Plaintext never leaves the server, never appears in logs, responses, or analytics.
7. **Never shipped in frontend JavaScript.** No code generation, no test backdoors, no dev-only bypass in production builds (dev bypass only behind an explicit env flag and never in prod).
8. On success, the server issues a session (§4.7); the client never constructs its own credential.
9. If the identifier already belongs to an account, the flow logs the user in; if not, it creates the account (onboard flag) — this is decided server-side, never by the client.

### 4.5 New profile setup

After successful verification, new users build a profile:

1. **Profile picture** — allow: camera capture, gallery/file upload, crop + reposition (client-side canvas, 1:1, min 256px export), preview. Fallback: generated initial avatar. Upload through the media service (§25.6) with validation.
2. **Username** — e.g. `@darkjimnah`.
   - Validation: `^[a-zA-Z0-9_]{3,20}$`, lowercase-normalized, globally unique (case-insensitive).
   - Availability check via `POST /auth/username/check` (debounced live check; reserved names + offensive-token blocklist rejected server-side).
   - Uniqueness enforced with a unique DB index + retry-safe insert; the server is the only authority.
3. **About** — free text ≤ 140 chars, e.g. *"Playing life one move at a time."*
4. `[ Continue ]` → welcome screen.

Edits later: Settings → Profile (same validation rules).

### 4.6 Welcome screen (5s)

A branded moment, not a loader:

- Full-screen dark stage, gradient glow bloom, `✦ DARKNOTE ✦` logo animation, "W E L C O M E" letter-spaced reveal, tagline, subtle particle/grid background.
- Total duration ≈ 5s, then automatic transition to `/app/home`.
- **[Decision]** Tap anywhere to skip (product owner can disable).

### 4.7 Data models (auth)

```ts
// User: identity record
User {
  id: string;                 // uuid
  phone: string | null;       // E.164, unique, encrypted at rest
  email: string | null;       // normalized, unique
  phoneVerifiedAt: Date | null;
  emailVerifiedAt: Date | null;
  onboarded: boolean;         // profile completed
  twoStepPinHash: string | null;   // argon2id, optional two-step PIN
  createdAt, updatedAt
}

// Profile: public identity
Profile {
  id: string; userId: string; // 1:1
  username: string;           // unique, lowercased
  displayName: string;        // optional, shown in chats
  about: string;              // ≤ 140 chars
  avatarMediaId: string | null;
  privacy: PrivacySettings;   // §13.2
}

// Session: one row per device login (drives Devices + Security)
Session {
  id: string; userId: string;
  deviceName, deviceType, os, browser, ip, country, lastActiveAt;
  createdAt, expiresAt, revokedAt;
}

// VerificationCode
VerificationCode {
  id: string; identifier: string;   // phone or email
  channel: 'sms' | 'email';
  codeHash: string;                 // HMAC(secret, salt || code)
  salt: string;
  attempts: number;                 // ≤ 5
  expiresAt: Date;                  // 5 min
  consumedAt: Date | null;
  createdAt: Date;
}
```

### 4.8 Auth API

| Method | Path | Body | Response | Notes |
|---|---|---|---|---|
| POST | `/api/v1/auth/phone/request` | `{ phone }` | `202 { retryAfter }` | Sends SMS code |
| POST | `/api/v1/auth/phone/verify` | `{ phone, code }` | `{ user, profile?, onboarded }` + session cookie | Single-use |
| POST | `/api/v1/auth/email/request` | `{ email }` | `202 { retryAfter }` | Sends email code |
| POST | `/api/v1/auth/email/verify` | `{ email, code }` | `{ user, profile?, onboarded }` + session cookie | Single-use |
| POST | `/api/v1/auth/username/check` | `{ username }` | `{ available }` | Live availability |
| POST | `/api/v1/auth/profile` | `{ username, about, avatarMediaId }` | `{ profile }` | Creates profile |
| POST | `/api/v1/auth/logout` | — | `204` | Revokes current session |
| POST | `/api/v1/auth/logout-all` | `{ pin? }` | `204` | Requires re-verification |
| GET | `/api/v1/auth/sessions` | — | `Session[]` | Devices list |
| POST | `/api/v1/auth/two-step` | `{ pin, action }` | — | Set / verify / disable |
| POST | `/api/v1/auth/refresh` | — | new cookie | Session rotation |

**Sessions [Decision]**: server-side sessions in Redis/DB + httpOnly `Secure; SameSite=Lax` cookies with rotation (30-day lifetime, sliding), plus CSRF double-submit token (§27). This gives real device management and remote logout.

---

## 5. App Shell & Navigation

- **Layout switch**: `max-width < 768px` → mobile (bottom bar, full-screen sheets); `≥ 768px` → desktop (left rail + panes). The layout is not a scaled-up phone.
- **Mobile bottom bar**: 5 items — Home, Updates, Chats, Calls, Games. Active tab = gradient icon + label; badges for unread chats, unseen updates, missed calls, game invites.
- **Desktop left rail**: same 5 items stacked vertically with labels, + Settings at the bottom; width 88px collapsed / 240px expanded (user toggle). Chat list + conversation pane appear to the right of the rail.
- **Header**: wordmark, game button, search, connection pill, avatar.
- **Route guards**: `/app/*` requires an authenticated session and completed onboarding; otherwise redirect to `/` or `/setup`. Session expiry mid-use → soft sign-out with a "session expired, verify again" screen.

---

## 6. Home Dashboard

Home is a personalized overview, not a second chat list. Data comes from `GET /api/v1/home/summary` (aggregated server-side; realtime events refresh it live).

```
DARKNOTE
Good evening, @jimnah

┌─ Your recent activity ─────────────────┐
│ 💬  3 new conversations                │
│ ◉   2 new updates                     │
│ 🎮  Last Ludo match: WON (+250 XP)    │
│ ☎   Missed call: Alex                 │
└───────────────────────────────────────┘

Quick actions
[ New Chat ] [ New Group ] [ Status ] [ Call ] [ Play ]
```

- **Greeting** by local time (morning/afternoon/evening) + username.
- **Activity card**: 4 rows, each deep-links (chats → Chats tab filtered; updates → Updates; Ludo result → Games; missed call → Calls). Empty states show inviting placeholders ("Start your first conversation", "Play your first Ludo match").
- **Quick actions**: New Chat (contact picker), New Group, Status (create update), Call (dialer), Play (Games hub). The Play button carries the gradient game treatment.
- Optional widgets (future): suggested contacts, active game invites, pinned chats, storage usage.
- Home must feel alive: rows update in place via socket events (new message, new update, call ended, game finished).

---

## 7. Updates (Status)

Own identity — DARKNOTE status *cards*, not a WhatsApp-style strip.

### 7.1 Data model

```ts
Update {
  id: string; userId: string;
  type: 'text' | 'image' | 'video' | 'audio';
  text: string | null;          // caption / text status (≤ 280)
  mediaId: string | null;       // media service reference
  musicId: string | null;       // optional music/audio track (future)
  privacy: 'everyone' | 'contacts' | 'selected' | 'exclude'; // per-update override
  allowedUserIds: string[];     // for 'selected'
  expiresAt: Date;              // created + 24h
  createdAt: Date; deletedAt: Date | null;
}
UpdateView { id; updateId; userId; viewedAt }   // viewers list
UpdateReply { id; updateId; fromUserId; text }  // text reactions/replies
```

### 7.2 Feed

- **Your Update** card: `+ Add Update` → composer (text / image / video / audio, optional caption, privacy selector, optional location).
- **Recent Updates**: DARKNOTE cards — avatar ring (gradient when unseen), name, relative time, preview thumbnail, unseen indicator. Tap → full-screen viewer with swipe between updates; long-press → menu (reply, react, view viewers [author only], delete [author only]).
- **Viewers list**: shown to the author only; names + viewed time. Viewing another user's update is recorded server-side.
- **Reactions/replies**: emoji react + text reply; sent as a chat message to the author by default.
- **Privacy enforcement is server-side**: feed queries filter by the viewer's relation (§13.2), never by client filtering. Blocked users never appear.
- **Muted contacts** don't trigger the unseen counter.
- **Delete**: author can delete at any time; deletion propagates in realtime to anyone currently viewing.
- Unseen updates badge the Updates tab; tapping marks them seen (read-receipt semantics like chats).

---

## 8. Chats

### 8.1 Chat list

- Ordering: pinned first (by pin time), then by `lastActivityAt` descending.
- Row fields: avatar (personal/group, online dot where visible), name (or `+2547…` for unsaved numbers), last-message preview (§8.2), time (HH:MM today, weekday, date), unread badge (server-computed §8.3), mute icon when muted, pin icon when pinned.
- Swipe actions (mobile): mute/unmute, pin/unpin, mark read, archive, delete. Long-press: multi-select (mute, pin, delete, archive).
- Desktop: hover actions; multi-select via checkbox.

### 8.2 Last message system

Every row renders the latest non-deleted message via a type-aware preview:

| Message type | Preview |
|---|---|
| text | excerpt (≈ 60 chars, ellipsized) |
| image | `📷 Photo` (+ caption excerpt if present) |
| video | `🎥 Video` |
| audio (voice) | `🎵 Audio` (+ duration) |
| document | `📄 Document` |
| sticker | `😀 Sticker` |
| poll | `📊 Poll` |
| location | `📍 Location` |
| contact | `👤 Contact` |
| call | `☎ Missed call` / `📞 Outgoing` / `Incoming` |
| game invite | `🎮 Ludo invitation` |
| system | `Group created`, `You added Brian`, `Message deleted` |

Group chats prefix sender: `Brian: Let's play Ludo`. Draft indicator (`Draft: …`) if the user has an unsaved draft. Updates in real time via the `message.new` socket event; the server sends a lightweight preview payload so the list doesn't re-render full messages.

### 8.3 Unread count & read state (read receipts, not hiding)

- Server keeps a **read watermark per chat member**: `lastReadMessageId` (+ `lastReadAt`).
- `unreadCount = count(messages where id > watermark and senderId != me and not deleted)`.
- **Opening a chat** sends `message.read` (watermark update) → server persists → broadcasts read receipts to the senders → unread badge recomputed and pushed to other devices of the same user too.
- Requirement enforced: after reading 7 unread messages, the badge shows 0 and stays 0 until a **new** message arrives after the read point, which increments the count to 1. The number is never "hidden" client-side — it is genuinely recomputed from the watermark.
- Chat list rows also show `✓✓` double-check state on the last outgoing message (sent/delivered/read) where the privacy setting permits.

### 8.4 Conversation screen (chat opened)

- **Mobile**: bottom nav hidden; full-screen conversation with back-swipe gesture.
- **Desktop**: conversation panel replaces the list's right pane; list remains visible (or collapses on narrow widths).
- Components (top→bottom): header (§8.5) → message list → composer (§8.6). Message list: bubbles (own = gradient surface, other = elevated), day separators, delivery ticks on own messages (§26), typing indicator ("Brian is typing…"), connection/`Connecting…` banner, scroll-to-bottom FAB, search entry (in-chat search, §16), media preview strip (shared media quick access).
- Tap-and-hold message → action sheet (§11).

### 8.5 Chat header

**Personal chat**: back · avatar · name | online / last seen · call · video call · more (view profile, mute, search, invite to Ludo, block, clear, delete, report).
**Unsaved number**: shows `+2547XXXXXXXX` in place of a name; header offers "Add contact".
**Group**: group avatar · name · member count · call · video call · more (group info, mute, search, invite to Ludo, exit group).

Online presence derives from the presence service (§26); "last seen" respects the privacy setting (§13.2).

### 8.6 Composer

```
┌──────────────────────────────────────────────┐
│ 😊  Type a message…                ＋     🎤 │
└──────────────────────────────────────────────┘
```

- Left: emoji button → full emoji selector (categories, search, recent).
- Center: input (multi-line up to 6 rows; `Enter` = send on mobile, Shift+Enter newline on desktop; mention autocomplete in groups `@` → member chips).
- Right: `＋` attachment (§8.7); when input is empty the mic shows — **tap** starts recording (§8.10); when text is present the mic becomes `➤` send.
- Reply/quote bar appears above the composer when replying; editing mode swaps the input to "Edit message".
- Drafts persist per chat (local storage, synced server-side later).

### 8.7 Attachment menu (`＋`)

An **extensible registry** — each attachment type is a plugin (icon, label, handler, mime rules, preview component):

```
┌──────────────────────────────┐
│ 📄 Document                  │
│ 🖼 Image                     │
│ 🎥 Video                     │
│ 🎵 Music / Audio             │
│ 📊 Poll                      │
│ 📍 Location                  │
│ 👤 Contact                   │
│ 📷 Camera                    │
└──────────────────────────────┘
```

Adding a future type = registering a new plugin; no changes to the composer core.

### 8.8 Documents

- Supported (v1 allowlist, MIME-sniffed server-side — never trusting the client's claimed type): PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, TXT, CSV, ZIP, JSON.
- Upload: presigned PUT to object storage with progress; server validates size (≤ 100 MB), MIME (magic-byte sniff), and extension consistency.
- Receiver card:

```
┌──────────────────────────────┐
│ 📄 report.pdf                │
│ 2.4 MB                       │
│                    Download  │
└──────────────────────────────┘
```

- Download/stream via presigned GET with `Range` support; large files are **never loaded fully into browser memory** — the card shows metadata + a download action; previews only for safe types (PDF, text, images) via blob streaming.

### 8.9 Media sharing

- Image ≤ 25 MB (JPEG/PNG/WebP/GIF); video ≤ 64 MB (MP4/WebM); audio ≤ 16 MB (M4A/OGG/OPUS/MP3); sticker (WebP).
- Multi-select (up to 10); grid preview with per-item remove; caption field (≤ 280); `[Send]`.
- Previews rendered from client-side files before upload; server generates thumbnails (images) and poster frames (video) for list/row rendering.
- Sending pipeline: optimistic bubble (`Sending…`) → upload media → `message.send` with `clientMsgId` → server persists → broadcast → status transitions (§26).

### 8.10 Camera

- Entry: attachment "Camera" (and profile-picture capture).
- `getUserMedia({ video: { facingMode: 'environment' } })` with a proper permission prompt; modes **Take Photo** (canvas capture) and **Record Video** (MediaRecorder); switching front/back cameras where supported.
- Graceful fallback: `NotAllowedError` → guidance card + "Upload from gallery" button; `NotFoundError`/unsupported → hide camera entry and offer upload. Never a dead-end.

### 8.11 Voice messages

- Flow: **tap mic** → recording starts (visual: `🔴 00:08` live timer, pulsing ring) → **tap stop** → preview card (waveform placeholder, play/pause, re-record, discard) → `[Send]`.
- Implementation: `MediaRecorder` (Opus in WebM/OGG), chunked to keep memory bounded; ≤ 5 min cap; playback with seek + speed toggle.
- Sent as `type: 'audio'` with `durationMs`; plays inline in the bubble.

---

## 9. Calls

### 9.1 Architecture

- **Browser-based WebRTC**: `RTCPeerConnection`; signaling via the realtime socket (Socket.IO) — the backend relays session descriptions/ICE candidates and tracks call state, but media flows peer-to-peer (or via TURN when NAT requires).
- **TURN fallback**: coturn in infra (§25); without TURN the product fails on some networks — this is a hard deployment requirement.
- Call state machine (server-authoritative):

```
idle → outgoing (ringing) → connecting → ongoing → ended
                          ↘ declined / missed / failed → ended
```

- One active call per user in v1; incoming call while in a call → busy signal.
- Calls are recorded in the Calls tab history with status (outgoing/incoming/missed), duration, and re-dial.

### 9.2 Signaling events (§26.5)

`call.invite` (callee), `call.accept`, `call.reject`, `call.cancel`, `call.timeout` (30s ring), `call.ice`, `call.offer`, `call.answer`, `call.state` (mute/camera/speaker), `call.end`. All routed through the backend; callee privacy ("who can call me") enforced server-side.

### 9.3 Call screen (voice)

```
┌──────────────────────────────────┐
│             👤                   │
│            Alex                  │
│                                  │
│           Calling…               │
│       (connecting / 00:42)       │
│                                  │
│       🎤      🔊      📞         │
└──────────────────────────────────┘
```

States: `Ringing` (outgoing), `Incoming` (accept/decline), `Ongoing` (timer), `Ended` (summary). Controls: mute, speaker (desktop: output device), end (danger).

### 9.4 Video call screen

```
┌──────────────────────────────────┐
│        REMOTE VIDEO (full)       │
│                                  │
│                     ┌──────────┐ │
│                     │  YOU     │ │
│                     │ (PiP)    │ │
│                     └──────────┘ │
│  🎤   📹   🔊   🔄   📞          │
└──────────────────────────────────┘
```

Controls: mute, camera on/off, speaker, **switch camera** (facing-mode toggle), end call, optional **screen share** (desktop, `getDisplayMedia`). PiP draggable within bounds; remote video fills the stage.

---

## 10. Groups

### 10.1 Creation

`New Group` → name (≤ 50), optional image, member picker (≥ 2 from contacts/global search), optional description → created with creator as admin. Group join is **invite-only** in v1 (no public discovery).

### 10.2 Group info page

```
┌────────────────────────────────┐
│          GROUP IMAGE           │
│       DARKNOTE FAMILY          │
│       24 members               │
│                                │
│ [Add Member] [Invite]          │
├────────────────────────────────┤
│ Group Description (edit, admin)│
│ Members (searchable list)      │
│ Media / Files / Links (grids)  │
│ Permissions                    │
│ Mute / Search / Exit group     │
└────────────────────────────────┘
```

### 10.3 Member & admin model

- Roles: `admin` | `member`. Creator is admin; admins can: add/remove members, promote/demote admins, edit name/image/description, delete group messages (policy: admin can delete any message in v1), disband group, start group call.
- Members can: leave, mute, search messages, change their own notification settings, see member list.
- `GroupMember { groupId, userId, role, joinedAt, mutedUntil, notificationPref }`.

### 10.4 Permissions (v1)

- Who can send messages: `everyone` | `admins` (server-enforced).
- Who can edit group info: `admins` only.
- Who can add members: `everyone` | `admins`.

### 10.5 Group features

- Mentions `@Name` (autocomplete; visually distinct chip; notifies the mentioned member).
- Group call (voice/video) via the header buttons; joins open a group call session.
- Member count in header; "online" aggregates (X of Y online) where privacy allows.
- Group search (§16), media/files/links grids derived from message types.
- **Ludo from group**: "Let's play Ludo" → `[ CREATE LUDO ROOM ]` card (§24).

---

## 11. Message Features

Applies to personal and group chats; triggered by long-press/hover action sheet on a message.

| Feature | Behavior |
|---|---|
| Reply | Quote (author + excerpt/thumbnail) above composer; replied message gets a reply count |
| Forward | Contact/group picker; forwards preserve original sender + timestamp note; can forward to multiple chats |
| Copy | Copies text to clipboard; media copies download link |
| React | Emoji picker → `Reaction { messageId, userId, emoji }`; counts aggregated; my reaction highlighted; realtime |
| Delete | "Delete for me" (soft-delete locally) / "Delete for everyone" (admin or author within 48h; system placeholder replaces body) |
| Edit | Author only, within 5 min; `edited` flag + `editedAt`; edit history not stored in v1 |
| Pin | Pinned messages list per chat (up to 10); pinned banner at top of conversation |
| Report | Opens report sheet (§15); attaches the message as evidence |
| Star/Save | `SavedMessage { userId, messageId }`; Saved view under Profile |
| Mention | Groups only; chip styling + notify |

Data: `Message` gains `replyToId, editedAt, deletedAt, pinnedAt, isForward, forwardedFrom`.

---

## 12. Polls

```
┌──────────────────────────────┐
│ What should we play?         │
│                              │
│ ○ Ludo                       │
│ ○ Chess                      │
│ ○ Cards                      │
│                              │
│ [Create Poll]                │
└──────────────────────────────┘
```

- Model: `Poll { id, messageId, question, options[], multipleChoice, anonymous, closeAt, closedAt }`; `PollVote { pollId, userId, optionIndex }` (one vote per user; re-vote allowed until close).
- Create via attachment menu → Poll; sent as `type: 'poll'` message.
- Realtime vote counts (server-authoritative; client renders only). Creator can close the poll; closing locks results.
- Anonymous option hides voter identities; counts only.

---

## 13. Settings

### 13.1 Categories & controls

| Section | Contents |
|---|---|
| Profile | Avatar, username (unique, §4.5 rules), about, phone, email; privacy controls (shortcut) |
| Account | Change phone / email (each requires verification), delete account, saved messages |
| Privacy | §13.2 |
| Security | Two-step verification (PIN), active sessions, login history, verification settings, logout from other devices (§13.3) |
| Notifications | Per-category toggles: messages, groups, calls, updates, game invitations, sounds, vibration, desktop notifications |
| Chats | Wallpaper choice, font size, enter-to-send, media auto-download (mobile data / Wi-Fi), link previews, draft autosave |
| Calls | Ringtone, call privacy, camera default, hide my number (where supported) |
| Updates | Who can see my updates (default), mute status, viewers default |
| Groups | Invite permission, default notification sound, admins' powers |
| Storage | Per-chat usage, media cache clearing, auto-download rules |
| Appearance | Dark theme (v1), accent color choice, message density, animations on/off (reduced motion) |
| Language | App language (i18n-ready; v1: English) |
| Data usage | Media auto-download limits, low-data mode (thumbnail-only previews) |
| Devices | §13.4 |
| Help | FAQ, contact support, report a problem |
| About DARKNOTE | Version, licenses, terms, privacy policy |

### 13.2 Privacy model (own design, not a WhatsApp copy)

Server-enforced audience model. Each item has a value: `Everyone` | `My Contacts` | `Nobody` (per-item overrides for individuals where sensible).

| Item | Options | Enforcement |
|---|---|---|
| Last seen | Everyone / Contacts / Nobody | Omitted from presence payloads, not just hidden in UI |
| Online status | Everyone / Contacts / Nobody | Presence publish filter |
| Profile picture | Everyone / Contacts / Nobody | Avatar fetch returns placeholder when unauthorized |
| About | Everyone / Contacts / Nobody | Same |
| Updates | Everyone / Contacts / Selected / Exclude | Feed query filter (§7) |
| Read receipts | On / Off | Watermark broadcast suppression (chat-level override allowed) |
| Group invitations | Everyone / Contacts / Nobody | Join invite enforcement |
| Who can call me | Everyone / Contacts / Nobody | Call routing server-side |

Exceptions: blocked users always excluded; contacts never see more than their tier allows; group members can always see each other's names within the group context.

### 13.3 Security

- **Two-step verification**: optional 4–6 digit PIN (argon2id-hashed); required when signing in on a new device; required for sensitive actions (change phone/email, disable two-step, logout-all, delete account).
- **Active sessions**: list with device, OS, browser, IP, country, last active; remote logout per session.
- **Login history**: recent sign-ins (time, device, IP, location, method); anomaly flagging (new country) surfaced as a prompt.
- **Verification settings**: which identifiers are verified, resend/re-verify controls.
- Sensitive actions request an additional verification step (SMS code or two-step PIN) regardless of active session.

### 13.4 Devices

```
Your devices
📱 Android phone          Active now
💻 Chrome on Windows      Last active 5 minutes ago
                         [ Log out device ]
```

Data from `Session` rows (§4.7); "Active now" = socket connected within 60s.

### 13.5 Notifications

- In-app (toast/banner + tab badges) always.
- Desktop notifications via the Notification API (permission-gated).
- Server push (Web Push) is a stub interface in v1 — implement with a provider later; all settings are already modeled.
- Per-category: messages, groups, calls, updates, games; plus sound, vibration, and per-chat mute (custom durations: 8h/1w/always) with mute indicator in chat lists.

---

## 14. Contacts

- **My Contacts**: the user's address book (manually added or imported) + DARKNOTE members flagged with a badge; non-members show an `Invite` action.
- **Find People**: search by username or phone number (server-side lookup, privacy-safe: only exact/near matches for DARKNOTE members; no public directory of non-members).
- **Invite**: shareable invite link `https://darknote.app/i/<code>` (or SMS to phone) → opens app store/web signup with the inviter attached.
- Clear separation of DARKNOTE members vs contacts who haven't joined (badge + invite CTA on every non-member row).
- Contact model: `Contact { userId, ownerId, name, phone, isDarknoteMember, addedAt }`.

---

## 15. Block & Report

### 15.1 Block

- Blocking is bidirectional in effect: blocked user cannot message, call, or see updates/profile of the blocker; the blocker likewise stops receiving their content. Existing chats become "blocked" banners. Unblock restores prior history.
- `BlockedUser { blockerId, blockedId, createdAt }`.

### 15.2 Report

- Report types: spam, harassment, inappropriate content, impersonation, dangerous content, other (+ free-text note, optional message/media evidence).
- `Report { id, reporterId, targetUserId, type, note, messageIds[], mediaIds[], status: open|reviewed|actioned, createdAt, reviewedAt, action }`.
- Stored for administrative review (API + queue in v1; admin panel later). Repeated reports auto-flag the target (`reportCount` threshold) for priority review; auto-limits (e.g., non-friends messaging frequency) can be triggered by policy.

---

## 16. Search

- **Global search** (`GET /api/v1/search?q=`): chats, messages, contacts, groups, users (by username), media, files, links; later games. Server-side search (PostgreSQL `pg_trgm` + `tsvector`), results grouped by type with icons; keyboard-navigable.
- **In-conversation search**: scoped to `chatId`, filters messages by text/type, jump-to-position.
- Search index updates on write; debounced queries (300ms); result cap per group (10) with "view all".
- Searching users only matches DARKNOTE members; blocked users excluded.

---

## 17. Games Platform

### 17.1 Games hub

```
┌──────────────────────────────────┐
│          DARKNOTE GAMES          │
│                                  │
│     🎲 LUDO                     │
│     Play with friends · AI ·     │
│     Multiplayer · Competitive    │
│                                  │
│       [ PLAY LUDO ]              │
│                                  │
│  (future game slots, locked)     │
└──────────────────────────────────┘
```

### 17.2 Game registry (modular)

```ts
GameDefinition {
  id: 'ludo' | string;          // registry key
  name, icon, tagline;
  minPlayers, maxPlayers;
  entryRoute;                   // /app/games/ludo
  supports: ['local-ai', 'multiplayer', 'bet-mode'];
  lobbyComponent, enginePackage, themes: ThemeDefinition[];
}
```

Adding a future game = registering a `GameDefinition`; navigation, invitations, and the hub render it automatically. No core rewrites.

---

## 18. Ludo Engine (Authoritative)

### 18.1 Board geometry (single authoritative map)

The engine is built around one path map. Tokens are tracked by **progress** (steps traveled), never by screen coordinates — this makes multiplayer sync and AI trivial.

```
        ┌─────────────────────────────────┐
        │ 🔴 RED HOME      │ 🟢 GREEN HOME│
        │    🔴 🔴         │     🟢 🟢    │
        │    🔴 🔴         │     🟢 🟢    │
        ├───────┬───────────┬──────────────┤
        │ RED   │           │ GREEN        │
        │ PATH  │   ★  ◆    │ PATH         │
        │ (5)   │  CENTER   │ (5)          │
        ├───────┤   ◆  ★    ├──────────────┤
        │ BLUE  │           │ YELLOW       │
        │ PATH  │           │ PATH         │
        ├───────┴───────────┴──────────────┤
        │ 🔵 BLUE HOME     │ 🟡 YELLOW HOME│
        │    🔵 🔵         │     🟡 🟡    │
        │    🔵 🔵         │     🟡 🟡    │
        └─────────────────────────────────┘
```

**Constants**

```
LOOP_LENGTH  = 52          // main track cells
START_CELL   = { red: 0, green: 13, yellow: 26, blue: 39 }
SAFE_CELLS   = [0, 8, 13, 21, 26, 34, 39, 47]   // start + 8 for each color
HOME_COLUMN_LEN = 5        // colored cells before center
TOTAL_PROGRESS   = 57      // 1..51 loop, 52..56 home column, 57 = center (finished)
```

**Progress model** — every token has an integer `progress`:

| Progress | Meaning |
|---|---|
| `0` | In home yard (not yet started) |
| `1..51` | On the main loop: `loopCell(progress) = (START_CELL[color] + progress − 1) mod 52` |
| `52..56` | In the player's colored home column (rendered adjacent to center) |
| `57` | Finished — reached the center (winning destination) |

- Loop traversal: progress 1 = start cell; each +1 advances one cell; at progress 51 the token sits on `(start − 1) mod 52` (the cell before home), then enters its home column at 52.
- Home column entry is automatic — a token at 51 moving +1 enters the column at 52.
- **Exact finish required**: a roll that would take progress beyond 57 is illegal for that token (token stays put).
- The **center** is the visual winning destination; four colored triangles meeting at a glowing core (per theme).

### 18.2 Data model (engine types)

```ts
type PlayerColor = 'red' | 'green' | 'yellow' | 'blue';

type TokenState = {
  playerId: string;      // engine player id ('p0'..'p3' or user id)
  tokenIndex: 0 | 1 | 2 | 3;
  state: 'home' | 'active' | 'finished';
  progress: number;      // 0..57 (see above)
};

type PlayerState = {
  playerId: string;
  userId: string | null;      // null for AI
  aiMode: AiMode | null;      // 'trainer' | 'beginner' | 'professional' | 'pro' | 'wise' | null
  color: PlayerColor;
  seat: number;               // 0..3
  connected: boolean;         // multiplayer
  tokens: TokenState[];       // exactly 4
};

type GameConfig = {
  playerCount: 2 | 3 | 4;
  seats: PlayerColor[];       // e.g. 2p: ['red','yellow'], 3p: ['red','green','yellow'], 4p: all
  roomId: string | null;
  boardTheme: ThemeId;        // visual only — engine never reads it
};

type GameState = {
  id: string;
  config: GameConfig;
  players: PlayerState[];
  turnIndex: number;            // index into players[]
  phase: 'waiting' | 'countdown' | 'rolling' | 'selecting' | 'moving' | 'finished';
  diceValue: number | null;
  diceOwner: string | null;
  sixesInRow: number;           // consecutive sixes counter (3 → forfeit)
  legalMoves: Move[] | null;    // computed by server after each roll
  winnerIds: string[];          // finish order (1st..4th)
  finishedOrder: string[];
  moveLog: MoveLogEntry[];      // event log (moves, captures, home entries, wins)
  stateVersion: number;         // monotonic — sync/resync key
  startedAt: Date; finishedAt: Date | null;
};

type Move = {
  playerId: string;
  tokenIndex: number;
  from: number;                 // old progress
  to: number;                   // new progress
  captured: string[] | null;    // token ids sent home, if any
  isHomeEntry: boolean;         // entered home column
  isFinish: boolean;            // reached 57
};

type MoveLogEntry = { seq: number; type: 'roll'|'move'|'capture'|'home'|'finish'|'pass'|'forfeit'; playerId; data; at: Date };
```

### 18.3 Rules engine (server-authoritative)

Turn loop (per player, in seat order):

```
Turn start → ROLL (server CSPRNG, crypto.randomInt(1,7))
  → diceOwner = current player; broadcast { phase:'rolling' }
  → compute legalMoves (server)
  → if legalMoves empty → broadcast PASS → next player
  → else phase 'selecting' → player picks token (intent 'game.move') → server validates
  → animate move (client) → resolve capture/safe/home → check finish → next turn
```

Rules (v1, configurable flags):

1. **Roll**: 1–6 via CSPRNG. A 6 grants an extra turn; **three consecutive 6s forfeit the turn** (no move).
2. **Leaving home**: a 6 is required to move a token from home to its start cell (progress 1).
3. **Move legality**: target progress computed from dice; illegal if: token finished, token home without a 6, exact-finish violation (progress + dice > 57), or token already at 57.
4. **Capture**: landing on a non-safe loop cell occupied by exactly one opponent token → opponent token returns home (`state:'home', progress:0`); capture event emitted (`💥 CAPTURE!`).
5. **Safe cells**: `SAFE_CELLS` — tokens on safe cells cannot be captured. Opponent tokens never stack on safe cells via capture; landing on an occupied safe cell just shares it.
6. **Blocks**: two or more same-color tokens on one cell form a block — cannot be captured; blocks move together when a member token is moved. **[Decision]** blocks are passable (a token may land on the same cell); the "cannot pass" variant is a future option.
7. **No legal moves** → automatic pass (broadcast `game.pass`); no re-roll.
8. **Finish**: all 4 tokens at progress 57 → player wins; ranking for 2nd+ computed at table end from tokens-finished, then total progress. **[Decision]** the table ends at the first winner (result screen shows computed ranking).
9. **2/3/4 players**: seat colors fixed by config (2p: opposite colors; 3p: any three; 4p: all). Engine logic is identical for all counts.
10. **Player disconnects** (§20.3): turn timer 30s → auto-pass / AI substitute per room setting.

**Engine API** (pure TypeScript, no I/O):

```ts
createGame(config): GameState
rollDice(state): { state, diceValue }                 // server only
getLegalMoves(state, playerId, diceValue): Move[]
applyMove(state, move): { state, events }             // validates, mutates via reducer
nextTurn(state): state
toSnapshot(state): GameSnapshot                       // wire-safe payload
resumeFromSnapshot(snapshot): state
```

The server exposes these behind the room endpoints; the browser *renders* snapshots and *sends intents* (`roll`, `move tokenIndex`). The client never validates legality. The same engine runs local-vs-AI games (server-validated as well, so AI difficulty cannot be tampered with).

### 18.4 Special effects (event-driven)

Engine emits typed events in `moveLog`/broadcasts; the UI plays short animations: capture (`💥 CAPTURE!`), home entry (`✨ HOME! ✨`), win (`🏆 ALEX WINS!`). Effects are ≤ 700ms and non-blocking; they never gate the next broadcast.
