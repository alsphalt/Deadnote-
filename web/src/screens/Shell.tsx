// DARKNOTE — app shell: header + mobile bottom nav / desktop rail

import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../store';
import { useSocket } from '../socket';
import { Avatar } from '../components/ui';

const TABS = [
  { to: '/app', label: 'Home', ico: '🏠' },
  { to: '/app/updates', label: 'Updates', ico: '◉' },
  { to: '/app/chats', label: 'Chats', ico: '💬' },
  { to: '/app/calls', label: 'Calls', ico: '☎' },
  { to: '/app/games', label: 'Games', ico: '🎮' },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const { user, chats } = useApp();
  const { connected } = useSocket();
  const nav = useNavigate();
  const loc = useLocation();
  const unread = chats.reduce((n, c) => n + c.unread, 0);

  return (
    <div className="app">
      {/* desktop rail */}
      <nav className="rail">
        <div className="logo">DARKNOTE</div>
        {TABS.map((t) => {
          const active = t.to === '/app' ? loc.pathname === '/app' || loc.pathname === '/app/home' : loc.pathname.startsWith(t.to);
          return (
            <button key={t.to} className={active ? 'active' : ''} onClick={() => nav(t.to)}>
              <span className="ico">{t.ico}</span>
              {t.label}
              {t.to === '/app/chats' && unread > 0 && <span className="badge" style={{ right: 10, top: 10 }}>{unread}</span>}
            </button>
          );
        })}
        <div className="spacer" />
        <button className={loc.pathname.startsWith('/app/contacts') ? 'active' : ''} onClick={() => nav('/app/contacts')}>
          <span className="ico">👥</span>Contacts
        </button>
        <button className={loc.pathname.startsWith('/app/settings') ? 'active' : ''} onClick={() => nav('/app/settings')}>
          <span className="ico">⚙</span>Settings
        </button>
      </nav>

      <div className="app-main">
        {/* top bar */}
        <div className="topbar">
          <span className="logo">DARKNOTE</span>
          <span className="spacer" />
          {connected ? <span className="pill ok">● Connected</span> : <span className="pill warn">Connecting…</span>}
          <button className="icon-btn game-btn" onClick={() => nav('/app/games')} title="DARKNOTE GAMES">🎮</button>
          <button className="icon-btn" onClick={() => nav('/app/settings')} title="Profile & settings">
            <Avatar emoji={user?.avatarEmoji} size="sm" />
          </button>
        </div>

        {children}

        {/* mobile bottom nav */}
        <nav className="bottom-nav">
          {TABS.map((t) => {
            const active = t.to === '/app' ? loc.pathname === '/app' || loc.pathname === '/app/home' : loc.pathname.startsWith(t.to);
            return (
              <button key={t.to} className={active ? 'active' : ''} onClick={() => nav(t.to)}>
                <span className="ico">{t.ico}</span>
                {t.label}
                {t.to === '/app/chats' && unread > 0 && <span className="badge">{unread}</span>}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
