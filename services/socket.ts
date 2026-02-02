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

    const extractContent = (msg: any): { type: string, content: string, buttons?: any } => {
        if (!msg) return { type: 'text', content: '' };
        if (msg.conversation) return { type: 'text', content: msg.conversation };
        if (msg.extendedTextMessage) return { type: 'text', content: msg.extendedTextMessage.text };
        if (msg.imageMessage) return { type: 'image', content: msg.imageMessage.caption || '' };
        if (msg.videoMessage) return { type: 'video', content: msg.videoMessage.caption || '' };
        if (msg.audioMessage) return { type: 'audio', content: '' };
        if (msg.stickerMessage) return { type: 'sticker', content: '' };
        if (msg.documentMessage) return { type: 'document', content: msg.documentMessage.title || msg.documentMessage.fileName || '' };
        if (msg.viewOnceMessage) return extractContent(msg.viewOnceMessage.message);
        if (msg.viewOnceMessageV2) return extractContent(msg.viewOnceMessageV2.message);
        if (msg.ephemeralMessage) return extractContent(msg.ephemeralMessage.message);
        if (msg.protocolMessage && msg.protocolMessage.type === 14) return extractContent(msg.protocolMessage.editedMessage);

        if (msg.buttonsMessage) return { type: 'buttons', content: msg.buttonsMessage.contentText, buttons: msg.buttonsMessage.buttons };
        if (msg.buttonsResponseMessage) return { type: 'text', content: msg.buttonsResponseMessage.selectedDisplayText };
        if (msg.listMessage) return { type: 'list', content: msg.listMessage.description };
        if (msg.listResponseMessage) return { type: 'text', content: msg.listResponseMessage.title };
        if (msg.templateMessage) return extractContent(msg.templateMessage.hydratedTemplate || msg.templateMessage.hydratedFourRowTemplate);
        if (msg.templateButtonReplyMessage) return { type: 'text', content: msg.templateButtonReplyMessage.selectedDisplayText };

        if (msg.reactionMessage) return { type: 'reaction', content: msg.reactionMessage.text };
        if (msg.call) return { type: 'call', content: 'Llamada' };

        return { type: 'text', content: '' };
    };

    const { type, content, buttons } = extractContent(rawMsg.message);

    return {
        id: rawMsg.key.id,
        key: rawMsg.key,
        text: content,
        senderId: isMe ? 'me' : (rawMsg.key.participant || rawMsg.key.remoteJid),
        timestamp: (rawMsg.messageTimestamp?.low || rawMsg.messageTimestamp || Date.now() / 1000) * 1000,
        status: 'read',
        type: type,
        pushName: rawMsg.pushName,
        mediaUrl: media,
        buttons: buttons
    };
};