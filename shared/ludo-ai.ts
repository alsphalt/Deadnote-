// ============================================================
// DARKNOTE LUDO AI — five difficulty personalities.
// ALL modes roll the same dice and follow the same legal rules.
// Difficulty comes from decision quality (heuristics + noise),
// never from cheating the dice or hiding information.
// Targets (difficulty, not guaranteed win rate):
//   trainer ≈ 15% · beginner ≈ 40% · professional ≈ 60%
//   pro ≈ 80% · wise ≈ 95%
// ============================================================

import { GameState, LegalMove, AiMode, loopCell, SAFE_CELLS, TOTAL_PROGRESS, LOOP, PLAYER_COLORS } from './ludo-engine.js';

export type { AiMode } from './ludo-engine.js';

export const AI_THINK_DELAY_MS: Record<AiMode, number> = {
  trainer: 450,
  beginner: 650,
  professional: 950,
  pro: 1250,
  wise: 1500,
};

export const AI_MODE_LABEL: Record<AiMode, string> = {
  trainer: 'Trainer',
  beginner: 'Beginner',
  professional: 'Professional',
  pro: 'Pro',
  wise: 'Wise',
};

interface Weights {
  progress: number;      // raw distance gained
  exit: number;          // bonus for leaving home (game momentum)
  capture: number;       // sending an opponent home
  safety: number;        // landing on safe cell / own stack
  risk: number;          // penalty: opponent within striking distance of dest
  homeCol: number;       // advancing inside home column
  finish: number;        // reaching center
  noise: number;         // random jitter (lower = more consistent)
}

const WEIGHTS: Record<AiMode, Weights> = {
  trainer: { progress: 0.4, exit: 0.2, capture: 0.4, safety: 0.2, risk: 0.1, homeCol: 0.3, finish: 0.6, noise: 3.0 },
  beginner: { progress: 0.9, exit: 1.1, capture: 0.7, safety: 0.5, risk: 0.3, homeCol: 0.6, finish: 1.2, noise: 2.0 },
  professional: { progress: 1.0, exit: 1.4, capture: 2.6, safety: 1.5, risk: 1.2, homeCol: 1.0, finish: 2.8, noise: 0.45 },
  pro: { progress: 1.15, exit: 2.2, capture: 4.2, safety: 2.0, risk: 1.9, homeCol: 1.3, finish: 4.2, noise: 0.15 },
  wise: { progress: 1.3, exit: 2.6, capture: 5.0, safety: 2.6, risk: 2.4, homeCol: 1.6, finish: 5.5, noise: 0.05 },
};

// how often a weak AI throws a random (legal) move — makes Trainer/Beginner
// visibly human-fallible without breaking the rules
const BLUNDER_RATE: Record<AiMode, number> = {
  trainer: 0.55,
  beginner: 0.3,
  professional: 0.05,
  pro: 0.0,
  wise: 0.0,
};

function rnd(seedless = true): number {
  return seedless ? Math.random() : Math.random();
}

/** Expected number of captures against us if we land on `destProgress`:
 *  each opponent token within 1..6 behind us has a 1/6 chance to roll the gap. */
function expectedCaptureLoss(state: GameState, selfIdx: number, destProgress: number): number {
  const me = state.players[selfIdx];
  const destCell = loopCell(me.color, destProgress);
  let loss = 0;
  for (let i = 0; i < state.players.length; i++) {
    if (i === selfIdx) continue;
    const opp = state.players[i];
    for (const t of opp.tokens) {
      if (t.progress < 1 || t.progress > LOOP) continue;
      const c = loopCell(opp.color, t.progress);
      const dist = (destCell - c + LOOP) % LOOP;
      if (dist >= 1 && dist <= 6) {
        loss += (1 / 6) * destProgress; // value at risk × capture odds
      }
    }
  }
  return loss;
}

/** Whether this move captures a lone opponent token. */
function captureTarget(state: GameState, selfIdx: number, m: LegalMove): number | null {
  // returns the victim's progress (value = how much progress we erase), or null
  if (m.to < 1 || m.to > LOOP) return null;
  const me = state.players[selfIdx];
  const cell = loopCell(me.color, m.to);
  if (SAFE_CELLS.has(cell)) return null;
  for (let i = 0; i < state.players.length; i++) {
    if (i === selfIdx) continue;
    const opp = state.players[i];
    const occ = opp.tokens.filter((t) => t.progress >= 1 && t.progress <= LOOP && loopCell(opp.color, t.progress) === cell);
    if (occ.length === 1) return occ[0].progress;
  }
  return null;
}

function willCapture(state: GameState, selfIdx: number, m: LegalMove): boolean {
  return captureTarget(state, selfIdx, m) !== null;
}

/** 1-ply lookahead for strong modes: opponent's best capture against us after this move. */
function counterRisk(state: GameState, selfIdx: number, m: LegalMove): number {
  const me = state.players[selfIdx];
  const destCell = loopCell(me.color, m.to);
  let worst = 0;
  for (let i = 0; i < state.players.length; i++) {
    if (i === selfIdx) continue;
    const opp = state.players[i];
    for (const t of opp.tokens) {
      if (t.progress < 1 || t.progress > LOOP) continue;
      const c = loopCell(opp.color, t.progress);
      const dist = (destCell - c + LOOP) % LOOP;
      if (dist >= 1 && dist <= 6) {
        // how many opponent tokens would sit at destCell after their move
        const after = opp.tokens.filter((x) => {
          const cc = loopCell(opp.color, x.progress);
          return cc === destCell;
        }).length + 1; // + the moving token
        if (after === 1) worst = Math.max(worst, 1); // they capture us
      }
    }
  }
  return worst;
}

function scoreMove(state: GameState, selfIdx: number, m: LegalMove, w: Weights): number {
  const me = state.players[selfIdx];
  const gain = m.to - m.from;
  let s = gain * w.progress;

  if (m.from === 0) {
    // exiting is urgent: a token at home is dead weight that causes pass-turns
    const atHome = me.tokens.filter((t) => t.progress === 0).length;
    s += w.exit * (0.4 + 1.4 * atHome);
  }
  const victim = captureTarget(state, selfIdx, m);
  if (victim !== null) {
    // capturing a token that has travelled far is worth far more than
    // resetting one that just left home
    s += w.capture * (0.4 + victim / TOTAL_PROGRESS);
  }

  const cell = loopCell(me.color, m.to);
  if (SAFE_CELLS.has(cell) || (m.to >= 1 && m.to <= LOOP && me.tokens.some((t) => t.index !== m.token && t.progress === m.to))) {
    s += w.safety;
  }

  // probabilistic danger: expected capture loss, not a flat veto
  s -= expectedCaptureLoss(state, selfIdx, m.to) * w.risk;

  if (m.to >= LOOP + 1 && m.to <= TOTAL_PROGRESS - 1) s += w.homeCol * (m.to - LOOP);
  if (m.to === TOTAL_PROGRESS) s += w.finish;

  // strong modes hedge against being captured next turn
  if (w.noise < 0.5) {
    s -= counterRisk(state, selfIdx, m) * w.risk * 2.4;
  }

  s += (rnd() * 2 - 1) * w.noise;
  return s;
}

/**
 * Choose the best token to move for the player at playerIdx.
 * Returns token index, or null if no legal moves (caller should pass).
 */
export function chooseAiMove(state: GameState, playerIdx: number, moves: LegalMove[], mode: AiMode): LegalMove | null {
  if (moves.length === 0) return null;
  const w = WEIGHTS[mode];

  // weak modes blunder: throw a random legal move with a personality-dependent
  // probability (always legal — difficulty from decision quality, never rules)
  if (rnd() < BLUNDER_RATE[mode]) {
    return moves[Math.floor(rnd() * moves.length)];
  }

  if (mode === 'trainer') {
    // intentionally weak: pure random legal moves with occasional aimless
    // preference — useful for practice, learning the board, testing
    return moves[Math.floor(rnd() * moves.length)];
  }

  let best = moves[0];
  let bestScore = -Infinity;
  for (const m of moves) {
    const s = scoreMove(state, playerIdx, m, w);
    if (s > bestScore) {
      bestScore = s;
      best = m;
    }
  }
  return best;
}

/** Short human-feel message for the AI's turn banner. */
export function aiThinkingLine(mode: AiMode): string {
  return `${AI_MODE_LABEL[mode]} is thinking…`;
}
