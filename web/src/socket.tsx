// DARKNOTE web — socket context (realtime)

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getToken } from './api';

interface SocketCtx {
  socket: Socket | null;
  connected: boolean;
  emit: (event: string, payload?: any, ack?: (r: any) => void) => void;
}

const Ctx = createContext<SocketCtx>({ socket: null, connected: false, emit: () => {} });

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const s = io({ auth: { token }, transports: ['websocket', 'polling'] });
    socketRef.current = s;
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on('connect_error', () => setConnected(false));
    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, []);

  const emit = (event: string, payload?: any, ack?: (r: any) => void) => {
    const s = socketRef.current;
    if (!s) return;
    if (ack) s.emit(event, payload, ack);
    else s.emit(event, payload);
  };

  return <Ctx.Provider value={{ socket: socketRef.current, connected, emit }}>{children}</Ctx.Provider>;
}

export function useSocket(): SocketCtx {
  return useContext(Ctx);
}
