import { createGame, setDice, applyMove, completeMove, nextTurn, rollDiceValue, SEAT_COLORS } from '../server/dist/shared/ludo-engine.js';
import { chooseAiMove } from '../server/dist/shared/ludo-ai.js';

const hist = { '0-10': 0, '11-20': 0, '21-30': 0, '31-40': 0, '41-51': 0 };
let wiseGain = 0, trainerGain = 0, wiseMoves = 0, trainerMoves = 0;
let wise = 0, trainer = 0, games = 0;

for (let g = 0; g < 400; g++) {
  const players = SEAT_COLORS[2].map((color, i) => ({
    id: i === 0 ? 'wise' : 'trainer', color,
    aiMode: i === 0 ? 'wise' : 'trainer',
  }));
  const state = createGame(players);
  let guard = 0;
  while (state.phase !== 'finished' && guard < 4000) {
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
            const vp = e.data.victimProgress ?? 0;
            const bucket = vp <= 10 ? '0-10' : vp <= 20 ? '11-20' : vp <= 30 ? '21-30' : vp <= 40 ? '31-40' : '41-51';
            hist[bucket]++;
          }
        }
        if (cur.id === 'wise') { wiseGain += pick.to - pick.from; wiseMoves++; }
        else { trainerGain += pick.to - pick.from; trainerMoves++; }
        completeMove(state, state.turn, pick);
      } else nextTurn(state);
    }
  }
  games++;
  if (state.winnerId === 'wise') wise++;
  else if (state.winnerId === 'trainer') trainer++;
}

console.log(`games=${games} wise=${wise} (${(wise / games * 100).toFixed(0)}%) trainer=${trainer}`);
console.log(`avg gain/move: wise=${(wiseGain / wiseMoves).toFixed(2)} (${wiseMoves} moves) · trainer=${(trainerGain / trainerMoves).toFixed(2)} (${trainerMoves} moves)`);
console.log('victim progress buckets:', JSON.stringify(hist));
