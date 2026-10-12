// DARKNOTE — Updates (status cards)

import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../store';
import { api } from '../api';
import { Avatar, Modal, relTime } from '../components/ui';
import type { UpdatePost } from '../types';

export function Updates() {
  const { user } = useApp();
  const [updates, setUpdates] = useState<UpdatePost[]>([]);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<UpdatePost | null>(null);
  const [text, setText] = useState('');
  const [type, setType] = useState<'text' | 'image' | 'video'>('text');
  const [privacy, setPrivacy] = useState('contacts');

  const load = useCallback(() => {
    api.updates().then((r) => setUpdates(r.updates)).catch(() => {});
  }, []);

  useEffect(load, [load]);

  const create = async () => {
    if (!text.trim()) return;
    try {
      await api.createUpdate({ type, text: text.trim(), privacy, mediaEmoji: type === 'text' ? '💬' : type === 'image' ? '🖼' : '🎥' });
      setText('');
      setCreating(false);
      load();
    } catch { /* ignore */ }
  };

  const mine = updates.filter((u) => u.userId === user?.id);
  const others = updates.filter((u) => u.userId !== user?.id);
  const unseen = others.filter((u) => !u.viewerIds.includes(user?.id || '')).length;

  const open = (u: UpdatePost) => {
    setViewing(u);
    api.viewUpdate(u.id).then(() => load()).catch(() => {});
  };

  return (
    <div className="screen">
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Updates</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: 13 }}>
        {unseen > 0 ? `${unseen} unseen` : 'All caught up'} · expires after 24 hours
      </p>

      <div className="card" style={{ textAlign: 'center', padding: 24, marginBottom: 18, cursor: 'pointer' }} onClick={() => setCreating(true)}>
        <div style={{ fontSize: 30, marginBottom: 6 }}>＋</div>
        <div style={{ fontWeight: 600 }}>Your update</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Add an update</div>
      </div>

      <div className="section-title">Recent updates</div>
      {others.length === 0 && mine.length === 0 && (
        <p className="empty">No updates yet. Be the first to share something.</p>
      )}
      {others.map((u) => (
        <div className="row" key={u.id} onClick={() => open(u)}>
          <Avatar emoji="◉" online={!u.viewerIds.includes(user?.id || '')} />
          <div className="body">
            <div className="name">{u.userId === user?.id ? 'You' : 'Contact'}</div>
            <div className="sub">{relTime(u.createdAt)}</div>
          </div>
          <div className="right">
            <span style={{ fontSize: 20 }}>{u.mediaEmoji}</span>
          </div>
        </div>
      ))}
      {mine.map((u) => (
        <div className="row" key={u.id}>
          <Avatar emoji={user?.avatarEmoji} />
          <div className="body">
            <div className="name">You · {u.viewerIds.length} view{u.viewerIds.length === 1 ? '' : 's'}</div>
            <div className="sub">{relTime(u.createdAt)}</div>
          </div>
          <div className="right">
            <button className="btn ghost" style={{ padding: '6px 10px', minHeight: 30, fontSize: 12 }} onClick={() => api.deleteUpdate(u.id).then(load)}>Delete</button>
          </div>
        </div>
      ))}

      {creating && (
        <Modal title="New update" onClose={() => setCreating(false)}>
          <div className="seg" style={{ marginBottom: 14 }}>
            {(['text', 'image', 'video'] as const).map((t) => (
              <button key={t} className={type === t ? 'active' : ''} onClick={() => setType(t)}>
                {t === 'text' ? '💬 Text' : t === 'image' ? '🖼 Image' : '🎥 Video'}
              </button>
            ))}
          </div>
          <div className="field">
            <label>Caption / text</label>
            <textarea className="input" rows={3} placeholder="What's on your mind?" value={text} onChange={(e) => setText(e.target.value)} maxLength={280} />
          </div>
          <div className="field">
            <label>Who can see this</label>
            <div className="seg">
              {['contacts', 'everyone', 'selected'].map((p) => (
                <button key={p} className={privacy === p ? 'active' : ''} onClick={() => setPrivacy(p)}>{p}</button>
              ))}
            </div>
          </div>
          <button className="btn primary block" disabled={!text.trim()} onClick={create}>Post update</button>
        </Modal>
      )}

      {viewing && (
        <Modal title="Update" onClose={() => setViewing(null)}>
          <div style={{ fontSize: 44, textAlign: 'center', margin: '10px 0' }}>{viewing.mediaEmoji}</div>
          <p style={{ textAlign: 'center', marginBottom: 12 }}>{viewing.text}</p>
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            {relTime(viewing.createdAt)} · {viewing.viewerIds.length} viewers
          </p>
        </Modal>
      )}
    </div>
  );
}
