import { ChatSession, User } from './types';

export const CURRENT_USER: User = {
  id: 'me',
  name: 'Me',
  avatar: 'https://picsum.photos/id/64/200/200',
  status: 'Available'
};

export const MOCK_CHATS: ChatSession[] = [
  {
    id: '1',
    contact: {
      id: 'gemini',
      name: 'Gemini AI',
      avatar: 'https://picsum.photos/id/23/200/200',
      status: 'Online'
    },
    messages: [
      {
        id: 'm1',
        key: {
          remoteJid: 'gemini',
          fromMe: false,
          id: 'm1'
        },
        text: 'Hello! I am connected to the Gemini API. Chat with me just like a real person.',
        senderId: 'gemini',
        timestamp: Date.now() - 100000,
        status: 'read',
        type: 'text'
      }
    ],
    unreadCount: 0,
    lastMessageTime: Date.now() - 100000,
    isGroup: false
  },
  {
    id: '2',
    contact: {
      id: 'mom',
      name: 'Mom',
      avatar: 'https://picsum.photos/id/65/200/200',
      status: 'Last seen today at 10:00'
    },
    messages: [
      {
        id: 'm2',
        key: {
          remoteJid: 'mom',
          fromMe: false,
          id: 'm2'
        },
        text: 'Don\'t forget dinner tonight!',
        senderId: 'mom',
        timestamp: Date.now() - 3600000,
        status: 'read',
        type: 'text'
      }
    ],
    unreadCount: 1,
    lastMessageTime: Date.now() - 3600000,
    isGroup: false
  },
  {
    id: '3',
    contact: {
      id: 'work',
      name: 'Dev Team',
      avatar: 'https://picsum.photos/id/2/200/200',
      status: 'You, Alice, Bob'
    },
    messages: [
      {
        id: 'm3',
        key: {
          remoteJid: 'work',
          fromMe: false,
          id: 'm3'
        },
        text: 'Production is down, who pushed to master?',
        senderId: 'bob',
        timestamp: Date.now() - 7200000,
        status: 'read',
        type: 'text'
      }
    ],
    unreadCount: 3,
    lastMessageTime: Date.now() - 7200000,
    isGroup: true
  }
];