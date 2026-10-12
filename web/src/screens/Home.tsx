// DARKNOTE — Home dashboard (activity + quick actions)

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../store';
import { api } from '../api';
import { Avatar, relTime } from '../components/ui';
import type { CallRecord, UpdatePost } from '../types';

export function Home() {
  const { user, chats, gameProfile, online } = useApp();
  const nav = useNavigate();
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [updates, setUpdates] = useState<UpdatePost[]>([]);

  useEffect(() => {
    api.calls().then((r) => setCalls(r.calls)).catch(() => {});
    api.updates().then((r) => setUpdates(r.updates)).catch(() => {});
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const newConvs = chats.filter((c) => c.unread > 0).length;
  const missed = calls.filter((c) => c.state === 'missed').length;
  const unseen = updates.filter((u) => u.userId !== user?.id && !u.viewerIds.includes(user?.id || '')).length;
  const lastMatch = gameProfile ? `${gameProfile.won >= Math.max(1, gameProfile.played / 2) ? 'WON' : 'played'} (${gameProfile.played} games)` : null;

  const hourGreeting = `${greeting}, ${user?.username || 'there'}`;

  return (
    <div className="screen">
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>{hourGreeting}</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: 13 }}>
        Here's what's happening in your world.
      </p>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="section-title" style={{ marginTop: 0 }}>Your recent activity</div>
        <div className="row" onClick={() => nav('/app/chats')}>
          <span style={{ fontSize: 22 }}>💬</span>
          <div className="body"><div className="sub">{newConvs > 0 ? `${newConvs} new conversation${newConvs > 1 ? 's' : ''} with unread messages` : 'No unread conversations'}</div></div>
        </div>
        <div className="row" onClick={() => nav('/app/updates')}>
          <span style={{ fontSize: 22 }}>◉</span>
          <div className="body"><div className="sub">{unseen > 0 ? `${unseen} new update${unseen > 1 ? 's' : ''}` : 'No new updates'}</div></div>
        </div>
        <div className="row" onClick={() => nav('/app/games')}>
          <span style={{ fontSize: 22 }}>🎮</span>
          <div className="body">
            <div className="sub">
              {lastMatch ? `Last Ludo match: ${lastMatch} · Level ${gameProfile?.level} · ${gameProfile?.xp} XP` : 'Play your first Ludo match'}
            </div>
          </div>
        </div>
        <div className="row" onClick={() => nav('/app/calls')}>
          <span style={{ fontSize: 22 }}>☎</span>
          <div className="body"><div className="sub">{missed > 0 ? `${missed} missed call${missed > 1 ? 's' : ''}` : 'No missed calls'}</div></div>
        </div>
      </div>

      <div className="section-title">Quick actions</div>
      <div className="quick-grid" style={{ marginBottom: 20 }}>
        <button className="quick" onClick={() => nav('/app/chats')}><span className="ico">💬</span>New Chat</button>
        <button className="quick" onClick={() => nav('/app/chats')}><span className="ico">👥</span>New Group</button>
        <button className="quick" onClick={() => nav('/app/updates')}><span className="ico">◉</span>Status</button>
        <button className="quick" onClick={() => nav('/app/calls')}><span className="ico">☎</span>Call</button>
        <button className="quick" onClick={() => nav('/app/games')}><span className="ico">🎮</span>Play</button>
      </div>

      <div className="section-title">Online now</div>
      {online.size > 0 ? (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
          {Array.from(online).filter((id) => id !== user?.id).slice(0, 8).map((id) => (
            <div key={id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 56 }} onClick={() => api.directChat(id).then((r) => nav(`/app/chats/${r.chat.id}`))}>
              <Avatar emoji="👤" online />
              <span style={{ fontSize: 10, color: 'var(--text-muted)', maxWidth: 56, overflow: 'hidden', textOverflow: 'ellipsis' }}>member</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty">No one is online right now — start a game and invite friends.</p>
      )}

      {chats.length === 0 && (
        <div className="card" style={{ marginTop: 18, textAlign: 'center', padding: 28 }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>🚀</div>
          <h3 style={{ marginBottom: 6 }}>Welcome to DARKNOTE</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 14 }}>
            Find people by username, start a chat, and challenge friends to Ludo.
          </p>
          <button className="btn primary" onClick={() => nav('/app/contacts')}>Find people</button>
        </div>
      )}
    </div>
  );
}
