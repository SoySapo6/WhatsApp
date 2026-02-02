import { io, Socket } from 'socket.io-client';

const URL = window.location.origin;

export const socket: Socket = io(URL, {
  autoConnect: false,
  reconnectionAttempts: 5,
  transports: ['websocket', 'polling'] 
});

export const normalizeMessage = (payload: any): any => {
    const rawMsg = payload.raw || payload; 
    const media = payload.media; 

    const isMe = rawMsg.key.fromMe;
    let type = 'text';
    let content = "";
    
    if (rawMsg.message?.imageMessage) {
        type = 'image';
        content = rawMsg.message.imageMessage.caption || "";
    } else if (rawMsg.message?.videoMessage) {
        type = 'video';
        content = rawMsg.message.videoMessage.caption || "";
    } else if (rawMsg.message?.audioMessage) {
        type = 'audio';
    } else if (rawMsg.message?.conversation) {
        content = rawMsg.message.conversation;
    } else if (rawMsg.message?.extendedTextMessage) {
        content = rawMsg.message.extendedTextMessage.text;
    }

    return {
        id: rawMsg.key.id,
        key: rawMsg.key,
        text: content,
        senderId: isMe ? 'me' : (rawMsg.key.participant || rawMsg.key.remoteJid),
        timestamp: (rawMsg.messageTimestamp?.low || rawMsg.messageTimestamp || Date.now() / 1000) * 1000,
        status: 'read',
        type: type,
        pushName: rawMsg.pushName,
        mediaUrl: media 
    };
};