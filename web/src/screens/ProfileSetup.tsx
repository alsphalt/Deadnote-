// DARKNOTE — new profile setup (avatar, unique username, about)

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

const AVATARS = ['🌑', '🚀', '🎲', '🦊', '🐺', '🔥', '⚡', '🌌', '👑', '🤖', '🎮', '💜', '🌙', '⭐', '🛡️', '🎯'];

export function ProfileSetup() {
  const nav = useNavigate();
  const [avatarEmoji, setAvatarEmoji] = useState('🌑');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [about, setAbout] = useState('');
  const [avail, setAvail] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const u = username.trim().toLowerCase();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(u)) {
      setAvail(null);
      return;
    }
    setChecking(true);
    const t = setTimeout(async () => {
      try {
        const r = await api.usernameCheck(u);
        setAvail(r.available);
      } catch {
        setAvail(null);
      } finally {
        setChecking(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [username]);

  const submit = async () => {
    setErr('');
    if (avail !== true) {
      setErr('That username is not available.');
      return;
    }
    setBusy(true);
    try {
      await api.createProfile({
        username: username.trim().toLowerCase(),
        displayName: displayName.trim(),
        about: about.trim(),
        avatarEmoji,
      });
      nav('/welcome', { replace: true });
    } catch (e: any) {
      setErr(e.message === 'username_taken' ? 'Username taken — try another.' : 'Could not create profile.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-logo">DARKNOTE</div>
      <div className="auth-card">
        <h1 className="auth-title">Create your profile</h1>
        <p className="auth-sub">Verification successful — now make it yours.</p>

        <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
          <div className="avatar xl" style={{ background: 'var(--bg-elevated)', fontSize: 44 }}>{avatarEmoji}</div>
        </div>
        <p className="auth-sub" style={{ marginBottom: 8 }}>Pick your avatar</p>
        <div className="grid4">
          {AVATARS.map((a) => (
            <button
              key={a}
              className="icon-btn"
              style={{ width: '100%', height: 44, fontSize: 22, background: avatarEmoji === a ? 'rgba(124,92,255,0.25)' : 'rgba(255,255,255,0.05)', border: avatarEmoji === a ? '1px solid var(--accent-violet)' : 'none' }}
              onClick={() => setAvatarEmoji(a)}
            >
              {a}
            </button>
          ))}
        </div>

        <div className="field" style={{ marginTop: 16 }}>
          <label>Username</label>
          <input
            className="input"
            placeholder="@darkjimnah"
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
          />
          {username && (
            <span style={{ fontSize: 12, color: checking ? 'var(--text-muted)' : avail ? 'var(--success)' : 'var(--danger)' }}>
              {checking ? 'Checking…' : avail ? '@' + username.toLowerCase() + ' is available' : 'Not available or invalid'}
            </span>
          )}
        </div>

        <div className="field">
          <label>Display name (optional)</label>
          <input className="input" placeholder="Jimnah" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={30} />
        </div>

        <div className="field">
          <label>About</label>
          <input className="input" placeholder="Playing life one move at a time." value={about} onChange={(e) => setAbout(e.target.value)} maxLength={140} />
        </div>

        {err && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</p>}
        <button className="btn primary block" disabled={busy || avail !== true} onClick={submit}>
          Continue
        </button>
      </div>
    </div>
  );
}
