import { createGame, applyMove, loopCell } from '../server/dist/shared/ludo-engine.js';

const g = createGame([
  { id: 'red', color: 'red', aiMode: null },
  { id: 'yellow', color: 'yellow', aiMode: null },
]);
const red = g.players[0];
const yel = g.players[1];

// red token 0 at progress 4 (cell 3), moves +1 → progress 5 (cell 4)
red.tokens[0].progress = 4;
// yellow token 1 at progress 31 → loopCell('yellow', 31) = (26+31-1)%52 = 56%52 = 4 → same cell 4
yel.tokens[1].progress = 31;
console.log('red cell:', loopCell('red', 4), '→ moving to cell', loopCell('red', 5));
console.log('yellow cell:', loopCell('yellow', 31));

const mv = { token: 0, from: 4, to: 5 };
const res = applyMove(g, 0, mv);
console.log('events:', JSON.stringify(res.events.map((e) => e.type)));
console.log('yellow progress after:', yel.tokens[1].progress, '(expect 0 = captured)');
console.log('red progress after:', red.tokens[0].progress, '(expect 5)');
