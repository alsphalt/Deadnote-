import { createGame, setDice, applyMove, completeMove, nextTurn, rollDiceValue, SEAT_COLORS } from '../server/dist/shared/ludo-engine.js';
import { chooseAiMove } from '../server/dist/shared/ludo-ai.js';

function pair(modeA, modeB, games) {
  let a = 0, b = 0;
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
      const mvList = setDice(state, state.turn, dice);
      if (mvList.length > 0) {
        const pick = chooseAiMove(state, state.turn, mvList, cur.aiMode);
        if (pick) { applyMove(state, state.turn, pick); completeMove(state, state.turn, pick); }
        else nextTurn(state);
      }
    }
    if (state.winnerId === 'A') a++; else if (state.winnerId === 'B') b++;
  }
  console.log(`${modeA} vs ${modeB}: ${a}/${games} (${(a / games * 100).toFixed(0)}%) vs ${b} (${(b / games * 100).toFixed(0)}%)`);
}

function fourPlayer(games) {
  let finished = 0, maxTurns = 0;
  for (let g = 0; g < games; g++) {
    const players = SEAT_COLORS[4].map((color, i) => ({
      id: `p${i}`, color,
      aiMode: ['wise', 'professional', 'beginner', 'pro'][i],
    }));
    const state = createGame(players);
    let guard = 0;
    while (state.phase !== 'finished' && guard < 6000) {
      guard++;
      const cur = state.players[state.turn];
      const dice = rollDiceValue();
      const mvList = setDice(state, state.turn, dice);
      if (mvList.length > 0) {
        const pick = chooseAiMove(state, state.turn, mvList, cur.aiMode);
        if (pick) { applyMove(state, state.turn, pick); completeMove(state, state.turn, pick); }
        else nextTurn(state);
      }
    }
    if (state.phase === 'finished') finished++;
    maxTurns = Math.max(maxTurns, guard);
  }
  console.log(`4-player mix (${games} games): finished=${finished}/${games} · maxTurns=${maxTurns}`);
}

pair('wise', 'trainer', 300);
pair('wise', 'beginner', 300);
pair('pro', 'professional', 300);
pair('beginner', 'trainer', 300);
fourPlayer(100);
