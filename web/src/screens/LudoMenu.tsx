// DARKNOTE — Ludo main menu

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../components/ui';
import { AI_MODE_LABEL } from '@shared/ludo-ai';
import type { AiMode } from '@shared/ludo-ai';

const AI_MODES: AiMode[] = ['trainer', 'beginner', 'professional', 'pro', 'wise'];
const MODE_HINT: Record<AiMode, string> = {
  trainer: '≈15% target strength — practice & learning',
  beginner: '≈40% — makes mistakes, good for new players',
  professional: '≈60% — stronger moves and captures',
  pro: '≈80% — plans ahead, aggressive',
  wise: '≈95% — the most dangerous mode',
};

export function LudoMenu() {
  const nav = useNavigate();
  const [quickOpen, setQuickOpen] = useState(false);
  const [aiCount, setAiCount] = useState<2 | 3 | 4>(2);
  const [aiModes, setAiModes] = useState<AiMode[]>(['professional', 'professional', 'professional', 'professional']);

  const startVsComputer = (players: 2 | 3 | 4) => {
    setAiCount(players);
    setQuickOpen(false);
    nav(`/app/games/ludo/play?players=${players}&modes=${aiModes.slice(0, players - 1).join(',')}&theme=darknote`);
  };

  return (
    <div className="screen">
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>DARKNOTE LUDO</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: 13 }}>
        Roll · Move · Capture · Win — the classic board, brought to life.
      </p>

      <button className="btn primary block" style={{ marginBottom: 12, justifyContent: 'space-between', padding: '16px 18px' }} onClick={() => setQuickOpen(true)}>
        <span>🎮 QUICK PLAY</span><span>➤</span>
      </button>
      <button className="btn block" style={{ marginBottom: 12, justifyContent: 'space-between', padding: '16px 18px' }} onClick={() => nav('/app/games/ludo/room')}>
        <span>🛠 CREATE ROOM</span><span>➤</span>
      </button>
      <button className="btn block" style={{ marginBottom: 12, justifyContent: 'space-between', padding: '16px 18px' }} onClick={() => nav('/app/games/ludo/room?join=1')}>
        <span>🔗 JOIN ROOM</span><span>➤</span>
      </button>
      <button className="btn block" style={{ marginBottom: 12, justifyContent: 'space-between', padding: '16px 18px' }} onClick={() => nav('/app/games/ludo/play?players=2&modes=professional&theme=classic')}>
        <span>🤖 VS COMPUTER</span><span>➤</span>
      </button>
      <button className="btn block" style={{ justifyContent: 'space-between', padding: '16px 18px', opacity: 0.6 }} onClick={() => alert('Bet Mode is architecture-ready but disabled until legal/compliance requirements are defined.')}>
        <span>🎲 BET MODE</span><span>🔒</span>
      </button>

      {quickOpen && (
        <Modal title="Quick play" onClose={() => setQuickOpen(false)}>
          <div className="section-title">How many players?</div>
          <div className="grid2" style={{ marginBottom: 14 }}>
            {([2, 3, 4] as const).map((n) => (
              <button key={n} className={`chip${aiCount === n ? ' active' : ''}`} style={{ padding: '14px', fontSize: 16 }} onClick={() => setAiCount(n)}>
                {n} players
              </button>
            ))}
          </div>
          <div className="section-title">AI opponents</div>
          {Array.from({ length: aiCount - 1 }).map((_, i) => (
            <div className="field" key={i}>
              <label>Computer {i + 1}</label>
              <select
                className="input"
                value={aiModes[i]}
                onChange={(e) => {
                  const next = [...aiModes];
                  next[i] = e.target.value as AiMode;
                  setAiModes(next);
                }}
              >
                {AI_MODES.map((m) => (
                  <option key={m} value={m}>{AI_MODE_LABEL[m]} — {MODE_HINT[m]}</option>
                ))}
              </select>
            </div>
          ))}
          <button className="btn primary block" onClick={() => startVsComputer(aiCount)}>Start game</button>
        </Modal>
      )}
    </div>
  );
}
