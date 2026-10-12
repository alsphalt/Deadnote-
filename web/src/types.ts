// DARKNOTE web — shared client types

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  about: string;
  avatarEmoji: string;
}

export interface ChatSummary {
  id: string;
  type: 'direct' | 'group';
  name: string;
  otherUserId?: string | null;
  other?: PublicUser | null;
  members: string[];
  lastMessage?: { text: string; type: string; senderId: string; createdAt: string; status: string } | null;
  unread: number;
  pinned: boolean;
  muted: boolean;
  createdAt: string;
  lastActivityAt: string;
}

export interface Message {
  id: string;
  clientId: string;
  chatId: string;
  senderId: string;
  type: string;
  text: string;
  meta?: any;
  status: 'sent' | 'delivered' | 'read';
  createdAt: string;
  replyToId?: string | null;
}

export interface UpdatePost {
  id: string;
  userId: string;
  type: string;
  text: string;
  mediaEmoji: string;
  viewerIds: string[];
  createdAt: string;
}

export interface CallRecord {
  id: string;
  aUserId: string;
  bUserId: string;
  kind: 'voice' | 'video';
  state: string;
  direction: 'outgoing' | 'incoming';
  otherUserId: string;
  other?: PublicUser | null;
  startedAt: string;
}

export interface GameProfile {
  userId: string;
  played: number;
  won: number;
  xp: number;
  level: number;
}

export interface RoomState {
  code: string;
  hostUserId: string;
  configPlayers: 2 | 3 | 4;
  theme: string;
  status: 'waiting' | 'countdown' | 'playing' | 'finished';
  players: {
    seat: number;
    color: string;
    connected: boolean;
    isHost: boolean;
    profile: PublicUser | null;
  }[];
  game: any | null;
  chat: { userId: string; text: string; at: string }[];
  countdown: number | null;
}
