// ============================================================
// DARKNOTE Ludo board — pure renderer driven by the engine map.
// Cell positions are computed from PROGRESS via the authoritative
// path table; tokens are never manually placed.
// ============================================================

import React from 'react';
import { START_CELL, PlayerColor, LOOP, TOTAL_PROGRESS } from '@shared/ludo-engine';

export const CELL = 50;
export const SIZE = 15;

// authoritative 52-cell track (global index → [row, col]) — see spec §18.1
export const TRACK: [number, number][] = [
  [6,0],[6,1],[6,2],[6,3],[6,4],[6,5],
  [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],
  [0,7],[0,8],
  [1,8],[2,8],[3,8],[4,8],[5,8],
  [6,9],[6,10],[6,11],[6,12],[6,13],[6,14],
  [7,14],[8,14],
  [8,13],[8,12],[8,11],[8,10],[8,9],
  [9,8],[10,8],[11,8],[12,8],[13,8],[14,8],
  [14,7],[14,6],
  [13,6],[12,6],[11,6],[10,6],[9,6],
  [8,5],[8,4],[8,3],[8,2],[8,1],[8,0],
  [7,0],
];

// home columns (5 colored cells each), entry at index 51.. per color
export const HOME_COL: Record<PlayerColor, [number, number][]> = {
  red:    [[7,1],[7,2],[7,3],[7,4],[7,5]],
  green:  [[1,7],[2,7],[3,7],[4,7],[5,7]],
  yellow: [[7,13],[7,12],[7,11],[7,10],[7,9]],
  blue:   [[13,7],[12,7],[11,7],[10,7],[9,7]],
};

export const CENTER_CELL: Record<PlayerColor, [number, number]> = {
  red: [7,6], green: [6,7], yellow: [7,8], blue: [8,7],
};

// token home slots (2x2)
export const HOME_SLOTS: Record<PlayerColor, [number, number][]> = {
  red:    [[2,3],[2,4],[3,3],[3,4]],
  green:  [[2,11],[2,12],[3,11],[3,12]],
  yellow: [[11,11],[11,12],[12,11],[12,12]],
  blue:   [[11,3],[11,4],[12,3],[12,4]],
};

export const SAFE_INDEXES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
const COLOR_HEX: Record<PlayerColor, string> = {
  red: '#FF4757', green: '#2ED573', yellow: '#FFA502', blue: '#5B6CFF',
};
const COLOR_DARK: Record<PlayerColor, string> = {
  red: '#7A1520', green: '#0F5C33', yellow: '#7A4E00', blue: '#1E2A7A',
};

function px(r: number, c: number): [number, number] {
  return [c * CELL + CELL / 2, r * CELL + CELL / 2];
}

/** progress → [x, y] using the engine map. */
export function tokenXY(color: PlayerColor, progress: number): [number, number] {
  if (progress === 0) {
    const [r, c] = HOME_SLOTS[color][0];
    return px(r, c);
  }
  if (progress >= 1 && progress <= LOOP) {
    const idx = (START_CELL[color] + progress - 1) % LOOP;
    const [r, c] = TRACK[idx];
    return px(r, c);
  }
  if (progress >= LOOP + 1 && progress <= TOTAL_PROGRESS - 1) {
    const [r, c] = HOME_COL[color][progress - LOOP - 1];
    return px(r, c);
  }
  const [r, c] = CENTER_CELL[color];
  return px(r, c);
}

export interface BoardToken {
  color: PlayerColor;
  token: number;
  progress: number;
  selectable?: boolean;
}

interface BoardProps {
  tokens: BoardToken[];
  theme: string;
  dice: number | null;
  rolling: boolean;
  onTokenClick?: (color: PlayerColor, token: number) => void;
  onRollClick?: () => void;
  rollEnabled?: boolean;
  turnLabel?: string;
  myTurn?: boolean;
  statusLine?: string;
}

export function LudoBoard({ tokens, theme, dice, rolling, onTokenClick, onRollClick, rollEnabled, turnLabel, myTurn, statusLine }: BoardProps) {
  const W = SIZE * CELL;
  const diceFaces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

  return (
    <div className={`ludo-scene theme-${theme}`}>
      <svg viewBox={`0 0 ${W} ${W}`} style={{ width: '100%', height: 'auto', display: 'block' }} className="ludo-svg">
        <defs>
          <filter id="tokenShadow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="2.5" stdDeviation="2.5" floodColor="#000" floodOpacity="0.55" />
          </filter>
          <radialGradient id="coreGlow">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.95" />
            <stop offset="45%" stopColor="#22D3EE" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#7C5CFF" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* board base */}
        <rect x="0" y="0" width={W} height={W} rx="18" className="board-base" />

        {/* center: four triangles */}
        {(['red', 'green', 'yellow', 'blue'] as PlayerColor[]).map((c) => {
          const [cr, cc] = CENTER_CELL[c];
          const [cx, cy] = px(cr, cc);
          const pts =
            c === 'red'
              ? `${cx},${cy - 75} ${cx - 75},${cy} ${cx + 75},${cy}`
              : c === 'green'
                ? `${cx},${cy + 75} ${cx - 75},${cy} ${cx + 75},${cy}`
                : c === 'yellow'
                  ? `${cx},${cy - 75} ${cx - 75},${cy} ${cx + 75},${cy}`
                  : `${cx},${cy + 75} ${cx - 75},${cy} ${cx + 75},${cy}`;
          return <polygon key={c} points={pts} fill={COLOR_HEX[c]} opacity="0.85" />;
        })}
        <circle cx={W / 2} cy={W / 2} r="40" fill="url(#coreGlow)" />
        <text x={W / 2} y={W / 2 + 8} textAnchor="middle" fontSize="30" fill="#0B0E14">◆</text>

        {/* main track cells */}
        {TRACK.map(([r, c], i) => {
          const safe = SAFE_INDEXES.has(i);
          const isStart = [0, 13, 26, 39].includes(i);
          const startColor = isStart ? (i === 0 ? 'red' : i === 13 ? 'green' : i === 26 ? 'yellow' : 'blue') : null;
          return (
            <g key={i}>
              <rect x={c * CELL + 1} y={r * CELL + 1} width={CELL - 2} height={CELL - 2} rx="7" className={safe ? 'cell safe' : 'cell'} fill={startColor ? COLOR_HEX[startColor as PlayerColor] : undefined} />
              {safe && <text x={c * CELL + CELL / 2} y={r * CELL + CELL / 2 + 6} textAnchor="middle" fontSize="20" fill="#FFD76A" opacity="0.95">★</text>}
            </g>
          );
        })}

        {/* home columns */}
        {(['red', 'green', 'yellow', 'blue'] as PlayerColor[]).map((c) =>
          HOME_COL[c].map(([r, cc], i) => (
            <rect key={`${c}${i}`} x={cc * CELL + 1} y={r * CELL + 1} width={CELL - 2} height={CELL - 2} rx="7" fill={COLOR_HEX[c]} opacity="0.75" />
          ))
        )}

        {/* home areas */}
        {(['red', 'green', 'yellow', 'blue'] as PlayerColor[]).map((c) => {
          const [r0, c0] = c === 'red' || c === 'blue' ? [0, 0] : c === 'green' ? [0, 9] : [9, 9];
          const [r1, c1] = [r0 + 6, c0 + 6];
          return (
            <g key={`home-${c}`}>
              <rect x={c0 * CELL + 4} y={r0 * CELL + 4} width={(c1 - c0) * CELL - 8} height={(r1 - r0) * CELL - 8} rx="16" className="home-area" fill={COLOR_DARK[c]} />
              <rect x={c0 * CELL + 4} y={r0 * CELL + 4} width={(c1 - c0) * CELL - 8} height={(r1 - r0) * CELL - 8} rx="16" fill="none" stroke={COLOR_HEX[c]} strokeWidth="2.5" opacity="0.9" />
              {HOME_SLOTS[c].map(([r, cc], i) => (
                <circle key={i} cx={cc * CELL + CELL / 2} cy={r * CELL + CELL / 2} r="11" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.18)" />
              ))}
            </g>
          );
        })}
        {/* home labels */}
        {(['red', 'green', 'yellow', 'blue'] as PlayerColor[]).map((c) => {
          const pos: Record<PlayerColor, [number, number]> = { red: [2.9, 3.2], green: [2.9, 11.8], yellow: [11.9, 11.8], blue: [11.9, 3.2] };
          const [r, cc] = pos[c];
          return (
            <text key={`lbl-${c}`} x={cc * CELL} y={r * CELL} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff" opacity="0.85" style={{ textTransform: 'uppercase', letterSpacing: '0.14em' }}>
              {c}
            </text>
          );
        })}

        {/* tokens */}
        {tokens.map((t, i) => {
          const [x, y] = tokenXY(t.color, t.progress);
          return (
            <g
              key={`${t.color}-${t.token}-${i}`}
              transform={`translate(${x}, ${y})`}
              style={{ transition: 'transform 0.11s cubic-bezier(0.34,1.56,0.64,1)', cursor: t.selectable ? 'pointer' : 'default' }}
              onClick={() => t.selectable && onTokenClick?.(t.color, t.token)}
            >
              <circle r="13.5" fill={COLOR_HEX[t.color]} stroke="rgba(255,255,255,0.85)" strokeWidth="2" filter="url(#tokenShadow)" className={t.selectable ? 'token-selectable' : 'token-piece'} />
              <circle r="5" cy="-3.5" fill="rgba(255,255,255,0.55)" />
              {t.selectable && <circle r="18" fill="none" stroke="#FFD76A" strokeWidth="2" className="token-ring" />}
            </g>
          );
        })}
      </svg>

      {/* dice control */}
      <div className={`dice-panel ${myTurn ? 'turn-glow' : ''}`}>
        <div className="turn-banner" style={{ marginBottom: 8, padding: '6px 12px', fontSize: 13 }}>
          {turnLabel || statusLine || '…'}
        </div>
        <div className="dice-row">
          <div className={`dice-box ${rolling ? 'rolling' : ''}`}>
            {rolling ? '🎲' : dice ? <span className="dice-face">{diceFaces[dice - 1]}</span> : <span className="dice-face dim">🎲</span>}
          </div>
          <button className="btn primary" disabled={!rollEnabled || rolling} onClick={onRollClick}>
            {rolling ? 'ROLLING…' : 'ROLL DICE'}
          </button>
        </div>
      </div>
    </div>
  );
}
