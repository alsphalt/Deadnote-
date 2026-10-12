// DARKNOTE web — shared UI primitives

import React, { useEffect, useState, useCallback } from 'react';

export function Avatar({ emoji, size, online }: { emoji?: string; size?: 'sm' | 'lg' | 'xl'; online?: boolean }) {
  const cls = ['avatar', size === 'lg' ? 'lg' : size === 'xl' ? 'xl' : '', online ? 'online' : ''].join(' ');
  return <div className={cls}>{emoji || '👤'}</div>;
}

export function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <button className={`switch${on ? ' on' : ''}`} onClick={() => onChange(!on)} aria-pressed={on} />;
}

export function Sheet({ title, onClose, children }: { title?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet">
        {title && <h3 style={{ marginBottom: 14 }}>{title}</h3>}
        {children}
      </div>
    </>
  );
}

export function Modal({ title, onClose, children }: { title?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal">
      <div className="backdrop" onClick={onClose} />
      <div className="card" style={{ position: 'relative' }}>
        {title && <h3 style={{ marginBottom: 14 }}>{title}</h3>}
        {children}
      </div>
    </div>
  );
}

// toast system
interface ToastCtx { show: (msg: string) => void }
const ToastContext = React.createContext<ToastCtx>({ show: () => {} });
export function useToast(): ToastCtx {
  return React.useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    window.setTimeout(() => setMsg(null), 2600);
  }, []);
  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {msg && <div className="toast">{msg}</div>}
    </ToastContext.Provider>
  );
}

export function timeFmt(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function relTime(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// emoji picker (small, used in composer + reactions)
const EMOJIS = ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','😉','😍','🥰','😘','😎','🤔','🤨','😐','😴','😭','😢','😤','😡','👍','👎','👏','🙏','💪','🔥','✨','🎉','🎮','🎲','❤️','💯','✅','❌','😂','🤝','👋','😮','🤯','🥳','😱','🤩'];

export function EmojiPicker({ onPick }: { onPick: (e: string) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4, padding: 8 }}>
      {EMOJIS.map((e, i) => (
        <button key={i} className="icon-btn" style={{ width: 40, height: 40, fontSize: 18 }} onClick={() => onPick(e)}>
          {e}
        </button>
      ))}
    </div>
  );
}

export function useCountdown(targetMs: number, onDone?: () => void): number {
  const [n, setN] = useState(() => Math.max(0, Math.ceil((targetMs - Date.now()) / 1000)));
  useEffect(() => {
    const iv = setInterval(() => {
      const left = Math.max(0, Math.ceil((targetMs - Date.now()) / 1000));
      setN(left);
      if (left === 0) {
        clearInterval(iv);
        onDone?.();
      }
    }, 200);
    return () => clearInterval(iv);
  }, [targetMs, onDone]);
  return n;
}
