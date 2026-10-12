// DARKNOTE — chat list with last-message previews + unread badges

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../store';
import { api } from '../api';
import { Avatar, Modal, timeFmt } from '../components/ui';
import type { PublicUser } from '../types';

function preview(m: { type: string; text: string } | null | undefined, senderName?: string): string {
  if (!m) return 'No messages yet';
  const sender = senderName ? `${senderName}: ` : '';
  switch (m.type) {
    case 'image': return `${sender}📷 Photo`;
    case 'video': return `${sender}🎥 Video`;
    case 'audio': return `${sender}🎵 Audio`;
    case 'document': return `${sender}📄 Document`;
    case 'sticker': return `${sender}😀 Sticker`;
    case 'poll': return `${sender}📊 Poll`;
    case 'game-invite': return `${sender}🎮 Ludo invitation`;
    case 'system': return m.text;
    default: return `${sender}${m.text.slice(0, 60)}${m.text.length > 60 ? '…' : ''}`;
  }
}

export function Chats() {
  const { chats, loadChats, online, user } = useApp();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [newChat, setNewChat] = useState(false);
  const [people, setPeople] = useState<PublicUser[]>([]);
  const [groupName, setGroupName] = useState('');
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  useEffect(() => {
    loadChats();
    const iv = setInterval(loadChats, 8000);
    return () => clearInterval(iv);
  }, [loadChats]);

  useEffect(() => {
    if (!newChat) return;
    api.people('').then((r) => setPeople(r.people)).catch(() => {});
  }, [newChat]);

  const filtered = useMemo(() => {
    const qq = q.toLowerCase();
    const sorted = [...chats].sort((a, b) => Number(b.pinned) - Number(a.pinned) || (a.lastActivityAt < b.lastActivityAt ? 1 : -1));
    if (!qq) return sorted;
    return sorted.filter((c) => c.name.toLowerCase().includes(qq));
  }, [chats, q]);

  const startChat = async (p: PublicUser) => {
    try {
      const r = await api.directChat(p.id);
      setNewChat(false);
      nav(`/app/chats/${r.chat.id}`);
    } catch { /* ignore */ }
  };

  const createGroup = async () => {
    if (!groupName.trim() || groupMembers.length === 0) return;
    try {
      const r = await api.createGroup(groupName.trim(), groupMembers);
      setCreatingGroup(false);
      setNewChat(false);
      nav(`/app/chats/${r.chat.id}`);
    } catch { /* ignore */ }
  };

  const me = user?.id;

  return (
    <div className="screen">
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>Chats</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input className="input" placeholder="Search chats…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="icon-btn" onClick={() => setNewChat(true)} title="New chat">＋</button>
        <button className="icon-btn" onClick={() => setCreatingGroup(true)} title="New group">👥</button>
      </div>

      {filtered.length === 0 && (
        <p className="empty">No conversations yet. Tap ＋ to find people by username.</p>
      )}

      {filtered.map((c) => {
        const lastSender = c.lastMessage && c.lastMessage.senderId === me ? 'You' : c.type === 'group' && c.lastMessage ? c.lastMessage.senderId === me ? undefined : 'Member' : undefined;
        return (
          <div className="row" key={c.id} onClick={() => nav(`/app/chats/${c.id}`)}>
            <Avatar emoji={c.other?.avatarEmoji || (c.type === 'group' ? '👥' : '👤')} online={c.otherUserId ? online.has(c.otherUserId) : false} />
            <div className="body">
              <div className="name">
                {c.name}
                {c.muted && <span className="mute-ico">🔕</span>}
                {c.pinned && <span className="pin-ico">📌</span>}
              </div>
              <div className="sub">{preview(c.lastMessage, lastSender)}</div>
            </div>
            <div className="right">
              <span className="time">{c.lastMessage ? timeFmt(c.lastMessage.createdAt) : ''}</span>
              {c.unread > 0 && <span className="unread-badge">{c.unread}</span>}
            </div>
          </div>
        );
      })}

      {newChat && (
        <Modal title="New chat" onClose={() => setNewChat(false)}>
          <div className="field">
            <label>Search by username</label>
            <input className="input" placeholder="@username" onChange={(e) => api.people(e.target.value).then((r) => setPeople(r.people)).catch(() => {})} />
          </div>
          {people.length === 0 && <p className="empty">No DARKNOTE members found</p>}
          {people.map((p) => (
            <div className="row" key={p.id} onClick={() => startChat(p)}>
              <Avatar emoji={p.avatarEmoji} online={online.has(p.id)} />
              <div className="body">
                <div className="name">@{p.username}</div>
                <div className="sub">{p.about || 'DARKNOTE member'}</div>
              </div>
            </div>
          ))}
        </Modal>
      )}

      {creatingGroup && (
        <Modal title="New group" onClose={() => setCreatingGroup(false)}>
          <div className="field">
            <label>Group name</label>
            <input className="input" placeholder="DARKNOTE FAMILY" value={groupName} onChange={(e) => setGroupName(e.target.value)} maxLength={50} />
          </div>
          <div className="field">
            <label>Add members (tap to toggle)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {people.map((p) => (
                <button
                  key={p.id}
                  className={`chip${groupMembers.includes(p.id) ? ' active' : ''}`}
                  onClick={() => setGroupMembers((prev) => prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id])}
                >
                  @{p.username}
                </button>
              ))}
            </div>
          </div>
          <button className="btn primary block" disabled={!groupName.trim() || groupMembers.length === 0} onClick={createGroup}>
            Create group
          </button>
        </Modal>
      )}
    </div>
  );
}
