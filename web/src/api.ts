// DARKNOTE web — API client

import type { ChatSummary, Message, UpdatePost, CallRecord, PublicUser } from './types';

const TOKEN_KEY = 'darknote_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string | null): void {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

async function req<T>(method: string, path: string, body?: any): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data.error || 'request_failed', data);
  }
  return data as T;
}

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(status: number, message: string, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export const api = {
  phoneRequest: (phone: string, device?: string) => req<any>('POST', '/auth/phone/request', { phone, device }),
  phoneVerify: (phone: string, code: string, device?: string) => req<any>('POST', '/auth/phone/verify', { phone, code, device }),
  emailRequest: (email: string, device?: string) => req<any>('POST', '/auth/email/request', { email, device }),
  emailVerify: (email: string, code: string, device?: string) => req<any>('POST', '/auth/email/verify', { email, code, device }),
  usernameCheck: (username: string) => req<{ available: boolean; reason?: string }>('POST', '/auth/username/check', { username }),
  createProfile: (p: { username: string; about: string; displayName?: string; avatarEmoji?: string }) =>
    req<any>('POST', '/auth/profile', p),
  me: () => req<any>('GET', '/auth/me'),
  logout: () => req<any>('POST', '/auth/logout'),
  sessions: () => req<{ sessions: any[] }>('GET', '/auth/sessions'),
  revokeSession: (token: string) => req<any>('POST', '/auth/sessions/revoke', { token }),

  chats: () => req<{ chats: ChatSummary[] }>('GET', '/chats'),
  messages: (chatId: string, before?: string) => req<{ messages: Message[]; readBy: Record<string, string> }>(`GET`, `/chats/${chatId}/messages${before ? `?before=${before}` : ''}`),
  directChat: (userId: string) => req<any>('POST', '/chats/direct', { userId }),
  createGroup: (name: string, memberIds: string[]) => req<any>('POST', '/groups', { name, memberIds }),

  updates: () => req<{ updates: UpdatePost[] }>('GET', '/updates'),
  createUpdate: (u: { type: string; text: string; mediaEmoji?: string; privacy?: string }) => req<any>('POST', '/updates', u),
  viewUpdate: (id: string) => req<any>('POST', `/updates/${id}/view`),
  deleteUpdate: (id: string) => req<any>('DELETE', `/updates/${id}`),

  calls: () => req<{ calls: CallRecord[] }>('GET', '/calls'),
  people: (q: string) => req<{ people: PublicUser[] }>('GET', `/people?q=${encodeURIComponent(q)}`),
  search: (q: string) => req<any>('GET', `/search?q=${encodeURIComponent(q)}`),
  presence: () => req<{ online: string[] }>('GET', '/presence'),
  ludoThemes: () => req<{ themes: string[] }>('GET', '/games/ludo/themes'),
};
