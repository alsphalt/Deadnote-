// DARKNOTE — conversation screen (full-screen on mobile)

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../store';
import { useSocket } from '../socket';
import { api } from '../api';
import { Avatar, EmojiPicker, Sheet, timeFmt } from '../components/ui';
import type { Message } from '../types';

export function Conversation() {
  const { chatId } = useParams();
  const nav = useNavigate();
  const { user, loadChats, online } = useApp();
  const { socket, emit } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [chat, setChat] = useState<any>(null);
  const [text, setText] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [typing, setTyping] = useState<{ [k: string]: boolean }>({});
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<any>(null);

  const load = useCallback(async () => {
    if (!chatId) return;
    const [msgs, chats] = await Promise.all([api.messages(chatId), api.chats()]);
    setMessages(msgs.messages);
    const c = chats.chats.find((x) => x.id === chatId);
    setChat(c || null);
  }, [chatId]);

  useEffect(() => {
    load();
    socket?.emit('chat:join', chatId);
    // mark read
    if (messages.length > 0) {
      const last = messages[messages.length - 1];
      emit('message:read', { chatId, upTo: last.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, socket]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    if (!socket) return;
    const onNew = (p: { message: Message }) => {
      if (p.message.chatId !== chatId) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === p.message.id)) return prev;
        return [...prev, p.message];
      });
      emit('message:read', { chatId, upTo: p.message.id });
      loadChats();
    };
    const onTyping = (p: { chatId: string; userId: string; isTyping: boolean }) => {
      if (p.chatId !== chatId || p.userId === user?.id) return;
      setTyping((prev) => ({ ...prev, [p.userId]: p.isTyping }));
    };
    const onRead = (p: { chatId: string; userId: string; upTo: string }) => {
      if (p.chatId !== chatId) return;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.senderId !== user?.id || m.id > p.upTo) return m;
          if (m.status !== 'read') return { ...m, status: 'read' as const };
          return m;
        })
      );
    };
    socket.on('message:new', onNew);
    socket.on('typing', onTyping);
    socket.on('message:read-receipt', onRead);
    return () => {
      socket.off('message:new', onNew);
      socket.off('typing', onTyping);
      socket.off('message:read-receipt', onRead);
    };
  }, [socket, chatId, user?.id, emit, loadChats]);

  const send = (body?: string) => {
    const t = (body ?? text).trim();
    if (!t || !chatId) return;
    const clientId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const optimistic: Message = {
      id: `local-${clientId}`,
      clientId,
      chatId,
      senderId: user?.id || '',
      type: 'text',
      text: t,
      status: 'sent',
      createdAt: new Date().toISOString(),
      replyToId: replyTo?.id ?? null,
    };
    setMessages((prev) => [...prev, optimistic]);
    setText('');
    setReplyTo(null);
    emit('message:send', { chatId, clientId, type: 'text', text: t, replyToId: optimistic.replyToId }, (r: any) => {
      if (r?.ok) {
        setMessages((prev) => prev.map((m) => (m.clientId === clientId ? { ...m, id: r.message.id } : m)));
        emit('message:read', { chatId, upTo: r.message.id });
        loadChats();
      }
    });
  };

  const onType = (v: string) => {
    setText(v);
    emit('typing', { chatId, isTyping: true });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emit('typing', { chatId, isTyping: false }), 1500);
  };

  const otherName = chat?.other?.displayName || chat?.name || 'Chat';
  const otherOnline = chat?.otherUserId ? online.has(chat.otherUserId) : false;

  const typingNames = Object.entries(typing).filter(([, v]) => v).map(([k]) => k).join(', ');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="topbar">
        <button className="icon-btn" onClick={() => nav(-1)}>←</button>
        <Avatar emoji={chat?.other?.avatarEmoji || (chat?.type === 'group' ? '👥' : '👤')} online={otherOnline} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>{otherName}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
            {typingNames ? `${typingNames} is typing…` : otherOnline ? 'online' : 'last seen recently'}
          </div>
        </div>
        <button className="icon-btn" title="Call">☎</button>
        <button className="icon-btn" title="Video">📹</button>
        <button className="icon-btn" onClick={() => nav(`/app/games/ludo/room?invite=${chatId}`)} title="Invite to Ludo">🎮</button>
      </div>

      <div className="msgs" style={{ flex: 1, overflowY: 'auto' }}>
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const showDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
          const own = m.senderId === user?.id;
          return (
            <React.Fragment key={m.id}>
              {showDay && <div className="day-sep">{new Date(m.createdAt).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</div>}
              <div className={`msg ${own ? 'own' : 'other'}`} onDoubleClick={() => setReplyTo(m)}>
                <div className="bubble">
                  {m.replyToId && <div style={{ fontSize: 11, color: 'var(--text-secondary)', borderLeft: '2px solid var(--accent-violet)', paddingLeft: 8, marginBottom: 4 }}>replying…</div>}
                  {m.type === 'game-invite' ? (
                    <div>
                      <div>🎮 Ludo invitation</div>
                      <button className="btn primary" style={{ marginTop: 6, padding: '6px 12px', minHeight: 32, fontSize: 12 }} onClick={() => nav('/app/games/ludo/room')}>
                        JOIN GAME
                      </button>
                    </div>
                  ) : (
                    m.text
                  )}
                  <div className="meta">
                    {timeFmt(m.createdAt)}
                    {own && (
                      <span className={`tick ${m.status === 'read' ? 'done' : ''}`}>
                        {m.status === 'read' ? '✓✓' : m.status === 'delivered' ? '✓✓' : '✓'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
        <div ref={endRef} />
      </div>

      {replyTo && (
        <div style={{ padding: '6px 14px', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-secondary)' }}>
          <span style={{ flex: 1 }}>Replying to: {replyTo.text.slice(0, 60)}</span>
          <button onClick={() => setReplyTo(null)}>✕</button>
        </div>
      )}

      <div className="composer">
        <button className="icon-btn" onClick={() => setEmojiOpen((v) => !v)}>😊</button>
        <input
          placeholder="Type a message…"
          value={text}
          onChange={(e) => onType(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button className="icon-btn" onClick={() => setAttachOpen(true)}>＋</button>
        {text.trim() ? (
          <button className="icon-btn game-btn" onClick={() => send()}>➤</button>
        ) : (
          <button className="icon-btn" title="Voice message">🎤</button>
        )}
      </div>

      {emojiOpen && (
        <Sheet title="Emoji" onClose={() => setEmojiOpen(false)}>
          <EmojiPicker onPick={(e) => { setText((t) => t + e); setEmojiOpen(false); }} />
        </Sheet>
      )}

      {attachOpen && (
        <Sheet title="Add to chat" onClose={() => setAttachOpen(false)}>
          {[
            { label: 'Document', ico: '📄', action: () => send('📄 Document') },
            { label: 'Image', ico: '🖼', action: () => send('📷 Photo') },
            { label: 'Video', ico: '🎥', action: () => send('🎥 Video') },
            { label: 'Music / Audio', ico: '🎵', action: () => send('🎵 Audio') },
            { label: 'Poll', ico: '📊', action: () => send('📊 Poll') },
            { label: 'Location', ico: '📍', action: () => send('📍 Location') },
            { label: 'Contact', ico: '👤', action: () => send('👤 Contact') },
            { label: 'Ludo invite', ico: '🎮', action: () => send('🎮 Ludo invitation') },
          ].map((a) => (
            <div className="row" key={a.label} onClick={() => { a.action(); setAttachOpen(false); }}>
              <span style={{ fontSize: 22 }}>{a.ico}</span>
              <div className="body"><div className="sub">{a.label}</div></div>
            </div>
          ))}
        </Sheet>
      )}
    </div>
  );
}
