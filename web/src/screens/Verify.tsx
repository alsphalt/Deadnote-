// DARKNOTE — verification code entry

import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, setToken } from '../api';

export function Verify() {
  const loc = useLocation();
  const nav = useNavigate();
  const state = (loc.state as any) || {};
  const channel: 'phone' | 'email' = state.channel || 'phone';
  const identifier: string = state.identifier || '';
  const devCode: string = state.devCode || '';

  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resendCode, setResendCode] = useState('');
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const iv = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(iv);
  }, []);

  // dev convenience: prefill the code the server generated
  useEffect(() => {
    if (devCode && devCode.length === 6) {
      setDigits(devCode.split(''));
    }
  }, [devCode]);

  const setDigit = (i: number, v: string) => {
    const d = v.replace(/\D/g, '');
    const next = [...digits];
    next[i] = d.slice(-1);
    setDigits(next);
    if (d && i < 5) inputs.current[i + 1]?.focus();
  };

  const verify = async () => {
    const code = digits.join('');
    if (code.length !== 6) return;
    setBusy(true);
    setErr('');
    try {
      const r = channel === 'phone'
        ? await api.phoneVerify(identifier, code)
        : await api.emailVerify(identifier, code);
      setToken(r.token);
      if (!r.onboarded) nav('/setup', { replace: true });
      else nav('/app', { replace: true });
    } catch (e: any) {
      if (e.message === 'expired') setErr('Code expired — request a new one.');
      else if (e.message === 'invalid') setErr('Incorrect code.');
      else if (e.message === 'too_many_attempts') setErr('Too many attempts. Request a new code.');
      else setErr('Verification failed.');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0) return;
    try {
      const r = channel === 'phone'
        ? await api.phoneRequest(identifier)
        : await api.emailRequest(identifier);
      setResendCode(r.devCode || '');
      setDigits((r.devCode || '').split(''));
      setCooldown(60);
      setErr('');
    } catch (e: any) {
      setErr(e.message === 'rate_limited' ? 'Try again in a minute.' : 'Could not resend.');
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-logo">DARKNOTE</div>
      <div className="auth-card">
        <h1 className="auth-title">Verify your number</h1>
        <p className="auth-sub">
          Code sent to <strong>{identifier}</strong>
        </p>
        <div className="otp">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => (inputs.current[i] = el)}
              value={d}
              inputMode="numeric"
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
                if (e.key === 'Enter') verify();
              }}
            />
          ))}
        </div>
        {err && <p style={{ color: 'var(--danger)', fontSize: 13, textAlign: 'center' }}>{err}</p>}
        {resendCode && resendCode.length === 6 && (
          <p style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
            Dev mode: new code is <strong>{resendCode}</strong>
          </p>
        )}
        <button className="btn primary block" disabled={busy || digits.join('').length !== 6} onClick={verify}>
          {busy ? 'Verifying…' : 'Verify'}
        </button>
        <button className="btn ghost block" disabled={cooldown > 0} onClick={resend}>
          {cooldown > 0 ? `Resend code (${cooldown}s)` : 'Resend code'}
        </button>
      </div>
    </div>
  );
}
