// DARKNOTE — 5-second welcome experience

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function Welcome() {
  const nav = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => nav('/app', { replace: true }), 5000);
    return () => clearTimeout(t);
  }, [nav]);

  return (
    <div className="welcome-stage" onClick={() => nav('/app', { replace: true })}>
      <div className="welcome-title">✦ DARKNOTE ✦</div>
      <div className="welcome-letters">W E L C O M E</div>
      <div className="welcome-sub">Welcome to DARKNOTE — chat, call, play.</div>
    </div>
  );
}
