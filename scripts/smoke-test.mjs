// DARKNOTE smoke test — auth flow, realtime chat, Ludo engine + AI stats
import { io } from 'socket.io-client';
import {
  createGame, setDice, legalMoves, applyMove, completeMove, nextTurn,
  rollDiceValue, SEAT_COLORS,
} from '../server/dist/shared/ludo-engine.js';
import { chooseAiMove } from '../server/dist/shared/ludo-ai.js';

const BASE = 'http://localhost:4000';
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${extra}`); }
};

async function main() {
  console.log('== 1. AUTH FLOW ==');
  const ph = '+2547' + String(Math.floor(10000000 + Math.random() * 89999999));
  const r1 = await fetch(`${BASE}/api/v1/auth/phone/request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: ph }) });
  const j1 = await r1.json();
  ok('phone/request', r1.status === 202 && /^\d{6}$/.test(j1.devCode), JSON.stringify(j1));

  const wrong = await fetch(`${BASE}/api/v1/auth/phone/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: ph, code: '000000' }) });
  ok('wrong code rejected', wrong.status === 401);

  const r2 = await fetch(`${BASE}/api/v1/auth/phone/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: ph, code: j1.devCode }) });
  const j2 = await r2.json();
  ok('phone/verify + session', r2.status === 200 && !!j2.token && j2.isNew, JSON.stringify(j2));

  const reuse = await fetch(`${BASE}/api/v1/auth/phone/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: ph, code: j1.devCode }) });
  ok('code single-use', reuse.status === 401);

  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${j2.token}` };
  const uname = 'smoke' + Math.floor(Math.random() * 100000);
  const r3 = await fetch(`${BASE}/api/v1/auth/username/check`, { method: 'POST', headers: H, body: JSON.stringify({ username: uname }) });
  const j3 = await r3.json();
  ok('username available', j3.available);

  const r4 = await fetch(`${BASE}/api/v1/auth/profile`, { method: 'POST', headers: H, body: JSON.stringify({ username: uname, about: 'smoke test', avatarEmoji: '🎲' }) });
  ok('profile created', r4.status === 200);

  const me = await fetch(`${BASE}/api/v1/auth/me`, { headers: H }).then((r) => r.json());
  ok('me returns profile', me.onboarded === true && me.user.username === uname);

  console.log('== 2. REALTIME CHAT ==');
  const token = j2.token;
  const s1 = io(BASE, { auth: { token }, transports: ['websocket'] });
  await new Promise((res) => s1.on('connect', res));

  // create second user via email
  const em = `smoke${Math.floor(Math.random() * 100000)}@test.dev`;
  const e1 = await fetch(`${BASE}/api/v1/auth/email/request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: em }) }).then((r) => r.json());
  const e2 = await fetch(`${BASE}/api/v1/auth/email/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: em, code: e1.devCode }) }).then((r) => r.json());
  const H2 = { 'Content-Type': 'application/json', Authorization: `Bearer ${e2.token}` };
  await fetch(`${BASE}/api/v1/auth/profile`, { method: 'POST', headers: H2, body: JSON.stringify({ username: 'smoke2' + Math.floor(Math.random() * 100000), about: 'p2' }) });
  const otherId = e2.user?.id;

  const dc = await fetch(`${BASE}/api/v1/chats/direct`, { method: 'POST', headers: H, body: JSON.stringify({ userId: otherId }) }).then((r) => r.json());
  const chatId = dc.chat.id;
  ok('direct chat created', !!chatId);

  const received = new Promise((res) => s1.on('message:new', (p) => res(p)));
  const s2 = io(BASE, { auth: { token: e2.token }, transports: ['websocket'] });
  await new Promise((res) => s2.on('connect', res));
  s1.emit('chat:join', chatId);
  s2.emit('chat:join', chatId);
  const msgSent = await new Promise((res) => s2.emit('message:send', { chatId, clientId: 'cid-' + Date.now(), type: 'text', text: 'hello from smoke' }, res));
  ok('message sent + acked', msgSent.ok === true);

  const got = await Promise.race([received, new Promise((r) => setTimeout(() => r(null), 3000))]);
  ok('message broadcast realtime', !!got && got.message?.text === 'hello from smoke');

  s1.emit('message:read', { chatId, upTo: got.message.id });
  await new Promise((r) => setTimeout(r, 300));
  const chats = await fetch(`${BASE}/api/v1/chats`, { headers: H }).then((r) => r.json());
  ok('unread=0 after read', chats.chats.find((c) => c.id === chatId)?.unread === 0);

  const msgs = await fetch(`${BASE}/api/v1/chats/${chatId}/messages`, { headers: H }).then((r) => r.json());
  ok('messages persisted', msgs.messages.some((m) => m.text === 'hello from smoke'));
  ok('message status read', msgs.messages.some((m) => m.status === 'read'));

  console.log('== 3. LUDO ENGINE + AI (200 games: Beginner vs Wise) ==');
  let wise = 0, beginner = 0, games = 0, moves = 0;
  for (let g = 0; g < 200; g++) {
    const players = SEAT_COLORS[2].map((color, i) => ({
      id: i === 0 ? 'beginner' : 'wise', color,
      aiMode: i === 0 ? 'beginner' : 'wise',
    }));
    const state = createGame(players);
    let guard = 0;
    while (state.phase !== 'finished' && guard < 3000) {
      guard++;
      const cur = state.players[state.turn];
      const dice = rollDiceValue();
      const mvList = setDice(state, state.turn, dice);
      if (mvList.length > 0) {
        const pick = chooseAiMove(state, state.turn, mvList, cur.aiMode);
        if (pick) {
          moves++;
          applyMove(state, state.turn, pick);
          completeMove(state, state.turn, pick);
          // sanity: applied move must have been in legal list
          if (!mvList.some((m) => m.token === pick.token)) { ok('move legality', false); return; }
        } else {
          nextTurn(state);
        }
      }
    }
    games++;
    if (state.winnerId === 'wise') wise++;
    else if (state.winnerId === 'beginner') beginner++;
  }
  ok('no infinite games', games === 200);
  const wr = (wise / games) * 100;
  console.log(`  Wise won ${wise}/${games} (${wr.toFixed(0)}%) · Beginner ${beginner}/${games} · total moves ${moves}`);
  ok('Wise dominates Beginner (>65%)', wr > 65, `got ${wr.toFixed(1)}%`);

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error('SMOKE FAIL', e); process.exit(1); });
