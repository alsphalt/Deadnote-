import { createGame, setDice, applyMove, completeMove, nextTurn, rollDiceValue, SEAT_COLORS } from '../server/dist/shared/ludo-engine.js';
import { chooseAiMove } from '../server/dist/shared/ludo-ai.js';

function run(modeA, modeB, games) {
  let a = 0, b = 0, capA = 0, capB = 0, capTakenByA = 0, capTakenByB = 0, sixesA = 0, sixesB = 0;
  for (let g = 0; g < games; g++) {
    const players = SEAT_COLORS[2].map((color, i) => ({
      id: i === 0 ? 'A' : 'B', color,
      aiMode: i === 0 ? modeA : modeB,
    }));
    const state = createGame(players);
    let guard = 0;
    while (state.phase !== 'finished' && guard < 4000) {
      guard++;
      const cur = state.players[state.turn];
      const dice = rollDiceValue();
      if (dice === 6) (cur.id === 'A' ? sixesA++ : sixesB++);
      const mvList = setDice(state, state.turn, dice);
      if (mvList.length > 0) {
        const pick = chooseAiMove(state, state.turn, mvList, cur.aiMode);
        if (pick) {
          const before = state.events.length;
          applyMove(state, state.turn, pick);
          for (const e of state.events.slice(before)) {
            if (e.type === 'capture') {
              if (e.data.victim === 'A') capA++; else capB++;
              if (cur.id === 'A') capTakenByA++; else capTakenByB++;
            }
          }
          completeMove(state, state.turn, pick);
        } else nextTurn(state);
      }
    }
    if (state.winnerId === 'A') a++;
    else if (state.winnerId === 'B') b++;
  }
  console.log(`${modeA} vs ${modeB} (${games}): ${modeA}=${a} (${(a / games * 100).toFixed(0)}%) · ${modeB}=${b} (${(b / games * 100).toFixed(0)}%)`);
  console.log(`  captures: ${modeA} took ${capTakenByA}, lost ${capA} · ${modeB} took ${capTakenByB}, lost ${capB} · sixes ${sixesA}/${sixesB}`);
}

run('wise', 'trainer', 300);
run('wise', 'beginner', 300);
run('pro', 'professional', 300);
run('beginner', 'trainer', 200);
