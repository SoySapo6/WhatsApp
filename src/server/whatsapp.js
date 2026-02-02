const Baileys = require('@whiskeysockets/baileys');
const makeWASocket = Baileys.default || Baileys;
const {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeInMemoryStore,
  getContentType,
  downloadContentFromMessage,
  isJidBroadcast
} = Baileys;
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

const store = makeInMemoryStore({ logger: console });
store.readFromFile('./baileys_store_multi.json');
setInterval(() => {
    store.writeToFile('./baileys_store_multi.json');
}, 10_000);

let sock;
let lastQr = null;
let io;

async function getMedia(msg) {
    const msgType = getContentType(msg.message);
    let stream;
    let type = 'text';

    if (msgType === 'imageMessage') {
        stream = await downloadContentFromMessage(msg.message.imageMessage, 'image');
        type = 'image';
    } else if (msgType === 'videoMessage') {
        stream = await downloadContentFromMessage(msg.message.videoMessage, 'video');
        type = 'video';
    } else if (msgType === 'audioMessage') {
        stream = await downloadContentFromMessage(msg.message.audioMessage, 'audio');
        type = 'audio';
    } else if (msgType === 'stickerMessage') {
        stream = await downloadContentFromMessage(msg.message.stickerMessage, 'sticker');
        type = 'sticker';
    }

    if (!stream) return null;

    let buffer = Buffer.from([]);
    for await(const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }

    let mimeType = 'image/jpeg';
    if(type === 'video') mimeType = 'video/mp4';
    if(type === 'audio') mimeType = 'audio/ogg';
    if(type === 'sticker') mimeType = 'image/webp';

    return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

async function connectToWhatsApp(socketIo) {
  io = socketIo;
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`);

  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
    syncFullHistory: false,
    generateHighQualityLinkPreview: true,
    browser: ["Ubuntu", "Chrome", "20.0.04"],
  });

  store.bind(sock.ev);

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('call', async (call) => {
      io.emit('native_call', call[0]);
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    io.emit('connection_update', update);

    if (qr) {
      lastQr = await qrcode.toDataURL(qr);
      io.emit('qr', lastQr);
    } else if (connection === 'open') {
        lastQr = null;
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect.error instanceof Boom) ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut : true;
      if (shouldReconnect) {
          connectToWhatsApp(io);
      } else {
          lastQr = null;
          io.emit('logged_out');
      }
    } else if (connection === 'open') {
      const user = {
         id: sock.user.id.split(':')[0] + '@s.whatsapp.net',
         name: sock.user.name || 'Me'
      };
      io.emit('ready', user);

      const chats = store.chats.all()
        .filter(c => !isJidBroadcast(c.id) && c.id !== 'status@broadcast')
        .map(chat => {
            const contact = store.contacts[chat.id];
            return {
                ...chat,
                name: chat.name || chat.subject || contact?.name || contact?.notify || chat.id.split('@')[0]
            };
        });
      io.emit('chats', chats);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type === 'notify' || type === 'append') {
      for (const msg of messages) {
        const isStatus = isJidBroadcast(msg.key.remoteJid) || msg.key.remoteJid === 'status@broadcast';

        let mediaData = null;
        try {
            mediaData = await getMedia(msg);
        } catch(e) {}

        const payload = {
            raw: msg,
            media: mediaData,
            isStatus
        };

        if (isStatus) {
            io.emit('status_update', payload);
        } else {
            io.emit('message', payload);
        }
      }
    }
  });

  sock.ev.on('presence.update', (update) => io.emit('presence', update));
  sock.ev.on('groups.update', (updates) => io.emit('group_update', updates));
  sock.ev.on('group-participants.update', (update) => io.emit('group_participants_update', update));

  sock.ev.on('contacts.update', (updates) => {
      io.emit('contacts', updates.map(c => ({
          ...c,
          name: c.name || c.notify || c.id?.split('@')[0]
      })));
  });

  return sock;
}

const getSock = () => sock;
const getStore = () => store;
const getLastQr = () => lastQr;

module.exports = {
    connectToWhatsApp,
    getSock,
    getStore,
    getLastQr,
    getMedia
};
