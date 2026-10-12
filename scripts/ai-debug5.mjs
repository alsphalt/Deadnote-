import { createGame, setDice, applyMove, completeMove, nextTurn, rollDiceValue, SEAT_COLORS, loopCell } from '../server/dist/shared/ludo-engine.js';
import { chooseAiMove } from '../server/dist/shared/ludo-ai.js';

const players = SEAT_COLORS[2].map((color, i) => ({
  id: i === 0 ? 'wise' : 'trainer', color,
  aiMode: i === 0 ? 'wise' : 'trainer',
}));
const state = createGame(players);
let guard = 0;
const capLog = [];
while (state.phase !== 'finished' && guard < 600) {
  guard++;
  const cur = state.players[state.turn];
  const dice = rollDiceValue();
  const mvList = setDice(state, state.turn, dice);
  if (mvList.length > 0) {
    const pick = chooseAiMove(state, state.turn, mvList, cur.aiMode);
    if (pick) {
      const before = state.events.length;
      applyMove(state, state.turn, pick);
      for (const e of state.events.slice(before)) {
        if (e.type === 'capture') {
          const victim = state.players.find((p) => p.id === e.data.victim);
          const victimProgress = victim.tokens[e.data.token].progress === 0 ? 'SENT HOME' : victim.tokens[e.data.token].progress;
          capLog.push(`turn ${guard}: ${cur.id}(${cur.color}) at cell ${loopCell(cur.color, pick.to)} captured ${e.data.victim}(${victim.color}) [victim progress after: ${victimProgress}]`);
        }
      }
      completeMove(state, state.turn, pick);
    } else nextTurn(state);
  }
}
console.log(`winner: ${state.winnerId} · turns: ${guard}`);
for (const l of capLog) console.log(' ', l);
console.log('final progress:');
for (const p of state.players) console.log(`  ${p.id}: ${p.tokens.map((t) => t.progress).join(',')}`);
