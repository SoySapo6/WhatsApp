export interface User {
  id: string; // JID
  name: string;
  avatar: string;
  status?: string;
}

export interface Participant {
  id: string;
  admin?: 'admin' | 'superadmin' | null;
}

export interface GroupMetadata {
  id: string;
  subject: string;
  owner: string;
  creation: number;
  participants: Participant[];
  desc?: string;
}

export interface Message {
  id: string;
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
    participant?: string;
  };
  text: string; // Caption or text
  senderId: string; 
  timestamp: number;
  status: 'sent' | 'delivered' | 'read' | 'pending';
  type: 'text' | 'image' | 'audio' | 'video' | 'sticker' | 'call';
  pushName?: string;
  mediaUrl?: string; // Base64 or URL for display
}

export interface ChatSession {
  id: string; // JID
  contact: User;
  messages: Message[];
  unreadCount: number;
  lastMessageTime: number;
  isGroup: boolean;
  groupMetadata?: GroupMetadata; // If it's a group
  presence?: 'composing' | 'recording' | 'available' | 'unavailable';
}

export enum ViewState {
  CONNECTING,
  LOGIN,
  MAIN
}

export enum SideBarView {
  CHATS,
  STATUS,
  CHANNELS,
  COMMUNITIES,
  NEW_CHAT,
  PROFILE,
  SETTINGS
}

export interface Presence {
  lastKnownPresence: 'composing' | 'recording' | 'available' | 'unavailable';
  lastSeen?: number;
}