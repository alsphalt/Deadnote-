// DARKNOTE — Settings (profile, privacy, security, devices, notifications)

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../api';
import { useApp } from '../store';
import { Avatar, Switch } from '../components/ui';

const SECTIONS = [
  'Profile', 'Account', 'Privacy', 'Security', 'Notifications', 'Chats',
  'Calls', 'Updates', 'Groups', 'Storage', 'Appearance', 'Language',
  'Data usage', 'Devices', 'Help', 'About DARKNOTE',
];

export function Settings() {
  const { user, gameProfile, refreshMe } = useApp();
  const nav = useNavigate();
  const [section, setSection] = useState('Profile');
  const [sessions, setSessions] = useState<any[]>([]);
  const [notif, setNotif] = useState({ messages: true, groups: true, calls: true, updates: true, games: true, sound: true, desktop: false });
  const [privacy, setPrivacy] = useState({ lastSeen: 'everyone', readReceipts: true, profilePhoto: 'everyone', about: 'contacts', updates: 'contacts' });

  useEffect(() => {
    if (section === 'Devices') api.sessions().then((r) => setSessions(r.sessions)).catch(() => {});
  }, [section]);

  const logout = async () => {
    await api.logout().catch(() => {});
    setToken(null);
    nav('/');
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <>
      <div className="section-title">{title}</div>
      {children}
    </>
  );

  const renderSection = () => {
    switch (section) {
      case 'Profile':
        return (
          <Section title="Profile">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, margin: '18px 0' }}>
              <Avatar emoji={user?.avatarEmoji} size="xl" />
              <h3>@{user?.username}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{user?.about || 'No about'}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Level {gameProfile?.level} · {gameProfile?.xp} XP · {gameProfile?.won}/{gameProfile?.played} games won</p>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
              Edit avatar/username/about happens on the setup screen in this build.
            </p>
          </Section>
        );
      case 'Privacy':
        return (
          <Section title="Privacy">
            {([
              ['Last seen', 'lastSeen', ['everyone', 'contacts', 'nobody']],
              ['Profile photo', 'profilePhoto', ['everyone', 'contacts', 'nobody']],
              ['About', 'about', ['everyone', 'contacts', 'nobody']],
              ['Updates', 'updates', ['everyone', 'contacts']],
            ] as const).map(([label, key, opts]) => (
              <div className="switch-row" key={key}>
                <span>{label}</span>
                <div className="seg" style={{ width: 210 }}>
                  {opts.map((o) => (
                    <button key={o} className={privacy[key] === o ? 'active' : ''} onClick={() => setPrivacy((p) => ({ ...p, [key]: o }))}>{o}</button>
                  ))}
                </div>
              </div>
            ))}
            <div className="switch-row">
              <span>Read receipts</span>
              <Switch on={privacy.readReceipts} onChange={(v) => setPrivacy((p) => ({ ...p, readReceipts: v }))} />
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 11.5, padding: '8px 4px' }}>
              Server-enforced — unauthorized viewers see placeholders, never real data.
            </p>
          </Section>
        );
      case 'Security':
        return (
          <Section title="Security">
            <div className="switch-row"><span>Two-step verification</span><span className="chip">Coming soon</span></div>
            <div className="switch-row"><span>Active sessions</span><button className="chip" onClick={() => setSection('Devices')}>View</button></div>
            <div className="switch-row"><span>Login history</span><span className="chip">Coming soon</span></div>
            <p style={{ color: 'var(--text-muted)', fontSize: 11.5, padding: '8px 4px' }}>
              Verification codes are hashed, expiring and single-use; sessions are server-side.
            </p>
          </Section>
        );
      case 'Devices':
        return (
          <Section title="Your devices">
            {sessions.map((s) => (
              <div className="row" key={s.createdAt}>
                <span style={{ fontSize: 20 }}>💻</span>
                <div className="body">
                  <div className="name">{s.deviceName} {s.current && <span className="chip active">current</span>}</div>
                  <div className="sub">Last active {new Date(s.lastActiveAt).toLocaleString()}</div>
                </div>
                {!s.current && <button className="btn ghost" style={{ padding: '6px 10px', minHeight: 32, fontSize: 12 }} onClick={() => api.revokeSession(s.token ? s.token : '').then(() => api.sessions().then((r) => setSessions(r.sessions)))}>Log out</button>}
              </div>
            ))}
            <button className="btn danger block" style={{ marginTop: 12 }}>Log out from all devices</button>
          </Section>
        );
      case 'Notifications':
        return (
          <Section title="Notifications">
            {([
              ['Message notifications', 'messages'],
              ['Group notifications', 'groups'],
              ['Calls', 'calls'],
              ['Updates', 'updates'],
              ['Game notifications', 'games'],
              ['Sound', 'sound'],
              ['Desktop notifications', 'desktop'],
            ] as const).map(([label, key]) => (
              <div className="switch-row" key={key}>
                <span>{label}</span>
                <Switch on={notif[key]} onChange={(v) => setNotif((n) => ({ ...n, [key]: v }))} />
              </div>
            ))}
          </Section>
        );
      case 'Calls':
        return (
          <Section title="Calls">
            <div className="switch-row"><span>Who can call me</span><span className="chip">Everyone</span></div>
            <div className="switch-row"><span>Default camera</span><span className="chip">Front</span></div>
          </Section>
        );
      case 'Appearance':
        return (
          <Section title="Appearance">
            <div className="switch-row"><span>Theme</span><span className="chip active">DARKNOTE Dark</span></div>
            <div className="switch-row"><span>Reduced motion</span><Switch on={false} onChange={() => {}} /></div>
          </Section>
        );
      case 'About DARKNOTE':
        return (
          <Section title="About DARKNOTE">
            <div style={{ textAlign: 'center', margin: '20px 0' }}>
              <div className="auth-logo" style={{ fontSize: 30 }}>DARKNOTE</div>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 8 }}>
                Version 1.0 · a social communication platform with integrated games.<br />
                Chat · Call · Updates · Groups · Ludo
              </p>
            </div>
          </Section>
        );
      default:
        return (
          <Section title={section}>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Settings for this section are stubbed in v1 — the structure is ready.</p>
          </Section>
        );
    }
  };

  return (
    <div className="screen">
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Settings</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 14, fontSize: 13 }}>@{user?.username}</p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {SECTIONS.map((s) => (
          <button key={s} className={`chip${section === s ? ' active' : ''}`} onClick={() => setSection(s)}>{s}</button>
        ))}
      </div>

      <div className="card">{renderSection()}</div>

      <button className="btn danger block" style={{ marginTop: 20 }} onClick={logout}>Log out</button>
    </div>
  );
}
