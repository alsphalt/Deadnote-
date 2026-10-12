// DARKNOTE web — app state

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken } from './api';
import { useSocket } from './socket';
import type { ChatSummary, Message, PublicUser, GameProfile } from './types';

export interface AppState {
  user: PublicUser | null;
  onboarded: boolean;
  gameProfile: GameProfile | null;
  chats: ChatSummary[];
  online: Set<string>;
  loadChats: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const Ctx = createContext<AppState>({
  user: null, onboarded: false, gameProfile: null, chats: [], online: new Set(),
  loadChats: async () => {}, refreshMe: async () => {},
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [onboarded, setOnboarded] = useState(false);
  const [gameProfile, setGameProfile] = useState<GameProfile | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const { socket, connected } = useSocket();

  const refreshMe = useCallback(async () => {
    if (!getToken()) return;
    try {
      const me = await api.me();
      setUser(me.user);
      setOnboarded(!!me.onboarded);
      setGameProfile(me.gameProfile);
    } catch {
      /* session invalid — handled by route guard */
    }
  }, []);

  const loadChats = useCallback(async () => {
    if (!getToken()) return;
    try {
      const r = await api.chats();
      setChats(r.chats);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    refreshMe();
    loadChats();
  }, [refreshMe, loadChats, connected]);

  useEffect(() => {
    if (!socket) return;
    const onMsg = () => loadChats();
    const onPresence = (p: { userId: string; online: boolean }) => {
      setOnline((prev) => {
        const n = new Set(prev);
        if (p.online) n.add(p.userId);
        else n.delete(p.userId);
        return n;
      });
    };
    const onRead = () => loadChats();
    socket.on('message:new', onMsg);
    socket.on('presence:update', onPresence);
    socket.on('message:read-receipt', onRead);
    socket.on('chat:added', onRead);
    return () => {
      socket.off('message:new', onMsg);
      socket.off('presence:update', onPresence);
      socket.off('message:read-receipt', onRead);
      socket.off('chat:added', onRead);
    };
  }, [socket, loadChats]);

  // hydrate online set
  useEffect(() => {
    api.presence().then((r) => setOnline(new Set(r.online))).catch(() => {});
  }, [connected]);

  const value: AppState = { user, onboarded, gameProfile, chats, online, loadChats, refreshMe };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  return useContext(Ctx);
}
