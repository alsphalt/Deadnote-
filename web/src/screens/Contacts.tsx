// DARKNOTE — Contacts & people

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useApp } from '../store';
import { Avatar } from '../components/ui';
import type { PublicUser } from '../types';

export function Contacts() {
  const { online } = useApp();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [people, setPeople] = useState<PublicUser[]>([]);
  const [searched, setSearched] = useState(false);

  const search = async (query: string) => {
    setQ(query);
    if (!query.trim()) {
      setPeople([]);
      setSearched(false);
      return;
    }
    const r = await api.people(query);
    setPeople(r.people);
    setSearched(true);
  };

  const startChat = async (p: PublicUser) => {
    const r = await api.directChat(p.id);
    nav(`/app/chats/${r.chat.id}`);
  };

  const invite = () => {
    const link = `${location.origin}/?invite=darknote`;
    navigator.clipboard?.writeText(link).catch(() => {});
    alert(`Invite link copied: ${link}`);
  };

  return (
    <div className="screen">
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>Contacts</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input className="input" placeholder="Search username or phone…" value={q} onChange={(e) => search(e.target.value)} />
        <button className="btn primary" onClick={invite}>Invite</button>
      </div>

      <div className="seg" style={{ marginBottom: 16 }}>
        <button className="active">My Contacts</button>
        <button>Find People</button>
      </div>

      {!searched && (
        <div className="card" style={{ textAlign: 'center', padding: 28 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Search for DARKNOTE members by username. People who haven't joined yet can be invited.
          </p>
        </div>
      )}

      {searched && people.length === 0 && <p className="empty">No DARKNOTE members found for “{q}”</p>}
      {people.map((p) => (
        <div className="row" key={p.id} onClick={() => startChat(p)}>
          <Avatar emoji={p.avatarEmoji} online={online.has(p.id)} />
          <div className="body">
            <div className="name">@{p.username}</div>
            <div className="sub">{p.about || 'DARKNOTE member'} {!online.has(p.id) && '· not online'}</div>
          </div>
          <button className="btn ghost" style={{ padding: '6px 12px', minHeight: 34, fontSize: 12 }} onClick={(e) => { e.stopPropagation(); startChat(p); }}>
            Message
          </button>
        </div>
      ))}
    </div>
  );
}
