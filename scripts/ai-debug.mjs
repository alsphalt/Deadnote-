import { createGame, setDice, applyMove, completeMove, nextTurn, rollDiceValue, SEAT_COLORS, LOOP } from '../server/dist/shared/ludo-engine.js';
import { chooseAiMove } from '../server/dist/shared/ludo-ai.js';

let wise = 0, beginner = 0, captures = 0, capturesWise = 0, capturesBeg = 0, guardMax = 0, totalGames = 0;

for (let g = 0; g < 1000; g++) {
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
        const before = state.events.length;
        applyMove(state, state.turn, pick);
        const evs = state.events.slice(before);
        if (evs.some((e) => e.type === 'capture')) {
          captures++;
          if (cur.id === 'wise') capturesWise++; else capturesBeg++;
        }
        completeMove(state, state.turn, pick);
      } else nextTurn(state);
    }
  }
  guardMax = Math.max(guardMax, guard);
  totalGames++;
  if (state.winnerId === 'wise') wise++;
  else if (state.winnerId === 'beginner') beginner++;
}

console.log(`games=${totalGames} wise=${wise} (${(wise / totalGames * 100).toFixed(0)}%) beginner=${beginner} (${(beginner / totalGames * 100).toFixed(0)}%)`);
console.log(`captures total=${captures} (wise made ${capturesWise}, beginner made ${capturesBeg}) · max turns=${guardMax}`);
