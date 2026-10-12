import { createGame, setDice, applyMove, completeMove, nextTurn, rollDiceValue, SEAT_COLORS, LOOP, loopCell } from '../server/dist/shared/ludo-engine.js';
import { chooseAiMove } from '../server/dist/shared/ludo-ai.js';

// one game with logging of every few turns
const players = SEAT_COLORS[2].map((color, i) => ({
  id: i === 0 ? 'beginner' : 'wise', color,
  aiMode: i === 0 ? 'beginner' : 'wise',
}));
const state = createGame(players);
let guard = 0;
while (state.phase !== 'finished' && guard < 200) {
  guard++;
  const cur = state.players[state.turn];
  const dice = rollDiceValue();
  const mvList = setDice(state, state.turn, dice);
  if (mvList.length > 0) {
    const pick = chooseAiMove(state, state.turn, mvList, cur.aiMode);
    if (pick) {
      applyMove(state, state.turn, pick);
      completeMove(state, state.turn, pick);
    } else nextTurn(state);
  }
  if (guard % 10 === 0) {
    const red = state.players[0].tokens.map((t) => t.progress).join(',');
    const yel = state.players[1].tokens.map((t) => t.progress).join(',');
    const inPlay = state.players.flatMap((p) => p.tokens.filter((t) => t.progress > 0 && t.progress <= LOOP)).length;
    console.log(`turn ${guard} · inPlay=${inPlay} · red=[${red}] · yellow=[${yel}]`);
  }
}
console.log('winner:', state.winnerId, '· turns:', guard);
