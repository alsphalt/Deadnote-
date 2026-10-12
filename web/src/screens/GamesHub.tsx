// DARKNOTE — Games hub (registry-driven, future games plug in)

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../store';

export function GamesHub() {
  const nav = useNavigate();
  const { gameProfile } = useApp();

  return (
    <div className="screen">
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>DARKNOTE GAMES</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: 13 }}>
        Play with friends, against AI, or in competitive rooms.
      </p>

      {gameProfile && (
        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <div style={{ fontWeight: 700 }}>Level {gameProfile.level}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{gameProfile.xp} XP · {gameProfile.won} wins / {gameProfile.played} games</div>
          </div>
          <div style={{ fontSize: 28 }}>🏆</div>
        </div>
      )}

      <div className="ludo-tile" onClick={() => nav('/app/games/ludo')}>
        <div className="dice">🎲</div>
        <div style={{ fontWeight: 700, fontSize: 20 }}>LUDO</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          Play with friends · Play against AI · Multiplayer · Competitive modes
        </div>
        <button className="btn primary" onClick={(e) => { e.stopPropagation(); nav('/app/games/ludo'); }}>PLAY LUDO</button>
      </div>

      <div className="section-title">More games (coming soon)</div>
      <div className="grid2">
        {['♟ Chess', '🃏 Cards', '🧩 Puzzle', '🎯 Darts'].map((g) => (
          <div key={g} className="card" style={{ textAlign: 'center', opacity: 0.45, padding: 18 }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{g.split(' ')[0]}</div>
            <div style={{ fontWeight: 600 }}>{g.split(' ')[1]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
