import { createGame, setDice, applyMove, completeMove, nextTurn, rollDiceValue, SEAT_COLORS, LOOP, loopCell, SAFE_CELLS, START_CELL } from '../server/dist/shared/ludo-engine.js';
import { chooseAiMove } from '../server/dist/shared/ludo-ai.js';

let opportunities = 0, taken = 0, movesMade = 0;

function captureOpportunities(state, selfIdx, mvList) {
  const me = state.players[selfIdx];
  let n = 0;
  for (const m of mvList) {
    if (m.to < 1 || m.to > LOOP) continue;
    const cell = loopCell(me.color, m.to);
    if (SAFE_CELLS.has(cell)) continue;
    for (let i = 0; i < state.players.length; i++) {
      if (i === selfIdx) continue;
      const opp = state.players[i];
      const occ = opp.tokens.filter((t) => t.progress >= 1 && t.progress <= LOOP && loopCell(opp.color, t.progress) === cell);
      if (occ.length === 1) n++;
    }
  }
  return n;
}

let wise = 0, beginner = 0;
for (let g = 0; g < 500; g++) {
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
      opportunities += captureOpportunities(state, state.turn, mvList);
      const pick = chooseAiMove(state, state.turn, mvList, cur.aiMode);
      if (pick) {
        movesMade++;
        const before = state.events.length;
        applyMove(state, state.turn, pick);
        if (state.events.slice(before).some((e) => e.type === 'capture')) taken++;
        completeMove(state, state.turn, pick);
      } else nextTurn(state);
    }
  }
  if (state.winnerId === 'wise') wise++;
  else if (state.winnerId === 'beginner') beginner++;
}

console.log(`500 games · wise=${wise} beginner=${beginner}`);
console.log(`capture opportunities=${opportunities} · captures taken=${taken} · moves=${movesMade}`);
