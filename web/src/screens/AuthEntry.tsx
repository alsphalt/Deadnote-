// DARKNOTE — auth entry (phone or email)

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export function AuthEntry() {
  const nav = useNavigate();
  const [mode, setMode] = useState<'phone' | 'email'>('phone');
  const [value, setValue] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr('');
    setBusy(true);
    try {
      if (mode === 'phone') {
        const r = await api.phoneRequest(value);
        nav('/verify', { state: { channel: 'phone', identifier: value, devCode: r.devCode } });
      } else {
        const r = await api.emailRequest(value);
        nav('/verify', { state: { channel: 'email', identifier: value, devCode: r.devCode } });
      }
    } catch (e: any) {
      setErr(e.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-logo">DARKNOTE</div>
      <div className="auth-card">
        <h1 className="auth-title">Welcome to DARKNOTE</h1>
        <p className="auth-sub">Chat, call and play Ludo with your people. Choose how you sign in.</p>
        <div className="seg">
          <button className={mode === 'phone' ? 'active' : ''} onClick={() => setMode('phone')}>Phone</button>
          <button className={mode === 'email' ? 'active' : ''} onClick={() => setMode('email')}>Email</button>
        </div>
        <div className="field">
          <label>{mode === 'phone' ? 'Phone number' : 'Email address'}</label>
          <input
            className="input"
            inputMode={mode === 'phone' ? 'tel' : 'email'}
            placeholder={mode === 'phone' ? '+254 7XX XXX XXX' : 'you@example.com'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        {err && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</p>}
        <button className="btn primary block" disabled={busy || !value.trim()} onClick={submit}>
          Continue
        </button>
        <p className="auth-sub" style={{ fontSize: 11.5 }}>
          We'll send a verification code. Codes expire in 5 minutes.
        </p>
      </div>
    </div>
  );
}
