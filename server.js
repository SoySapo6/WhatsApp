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
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const qrcode = require('qrcode');
const cors = require('cors');
const fs = require('fs');
const mime = require('mime-types');

const store = makeInMemoryStore({ logger: console });
store.readFromFile('./baileys_store_multi.json');
setInterval(() => {
    store.writeToFile('./baileys_store_multi.json');
}, 10_000);

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  maxHttpBufferSize: 1e8
});

let sock;

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
    }

    if (!stream) return null;

    let buffer = Buffer.from([]);
    for await(const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    
    let mimeType = 'image/jpeg';
    if(type === 'video') mimeType = 'video/mp4';
    if(type === 'audio') mimeType = 'audio/ogg';

    return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

async function connectToWhatsApp() {
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`);

  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
  
  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    syncFullHistory: false,
    generateHighQualityLinkPreview: true,
    browser: ["WhatsApp Clone", "Chrome", "10.0"],
  });

  store.bind(sock.ev);

  sock.ev.on('creds.update', saveCreds);

  // Native WhatsApp Call Detection (Notification only)
  sock.ev.on('call', async (call) => {
      console.log('Native Call received', call);
      // We inform frontend, but we can't hijack the stream due to encryption
      io.emit('native_call', {
          id: call[0].id,
          from: call[0].from,
          status: call[0].status,
          isVideo: call[0].isVideo
      });
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      const qrImage = await qrcode.toDataURL(qr);
      io.emit('qr', qrImage);
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect.error instanceof Boom) ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut : true;
      if (shouldReconnect) connectToWhatsApp();
      else io.emit('logged_out');
    } else if (connection === 'open') {
      const user = {
         id: sock.user.id.split(':')[0] + '@s.whatsapp.net',
         name: sock.user.name || 'Me',
         avatar: ''
      };
      io.emit('ready', user);
      
      const chats = store.chats.all().map(chat => ({
         ...chat,
         name: chat.name || chat.subject || chat.id.replace('@s.whatsapp.net', '')
      }));
      io.emit('chats', chats);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type === 'notify' || type === 'append') {
      for (const msg of messages) {
        const isStatus = isJidBroadcast(msg.key.remoteJid);
        
        let mediaData = null;
        try {
            mediaData = await getMedia(msg);
        } catch(e) { console.log(e); }

        const payload = { 
            raw: msg, 
            media: mediaData,
            isStatus: isStatus || msg.key.remoteJid === 'status@broadcast'
        };

        if (isStatus || msg.key.remoteJid === 'status@broadcast') {
            io.emit('status_update', payload);
        } else {
            io.emit('message', payload);
        }
      }
    }
  });
  
  sock.ev.on('presence.update', (update) => {
     io.emit('presence', update);
  });

  sock.ev.on('groups.update', (updates) => {
     io.emit('group_update', updates);
  });

}

connectToWhatsApp();

io.on('connection', (socket) => {

  if (sock?.user) {
      socket.emit('ready', {
          id: sock.user.id.split(':')[0] + '@s.whatsapp.net',
          name: sock.user.name || 'Me'
      });
      const chats = store.chats.all().sort((a,b) => b.conversationTimestamp - a.conversationTimestamp);
      socket.emit('chats', chats.slice(0, 50));
  }

  socket.on('request_pairing_code', async (phoneNumber) => {
      try {
          const code = await sock.requestPairingCode(phoneNumber);
          socket.emit('pairing_code', code);
      } catch (e) {
          console.error('Error requesting pairing code', e);
          socket.emit('error', 'Could not request pairing code');
      }
  });

  socket.on('send_message', async ({ jid, text }) => {
     try { await sock.sendMessage(jid, { text }); }
     catch (e) { console.error(e); }
  });

  socket.on('send_media', async ({ jid, fileBase64, type, caption, isVoice }) => {
      try {
          const b64 = fileBase64.replace(/^data:.*?;base64,/, "");
          const buff = Buffer.from(b64, 'base64');

          let messageContent = {};

          if (type === 'audio') {
              messageContent = { audio: buff, ptt: isVoice, mimetype: 'audio/mp4' };
          } else if (type === 'video') {
              messageContent = { video: buff, caption, mimetype: 'video/mp4' };
          } else {
              messageContent = { image: buff, caption };
          }

          await sock.sendMessage(jid, messageContent);
      } catch(e) { console.error('Error sending media', e); }
  });

  socket.on('post_status', async ({ fileBase64, type, caption, background }) => {
      try {
          const jid = 'status@broadcast';
          if (type === 'text') {
               await sock.sendMessage(jid, { text: caption, backgroundArgb: 0xFF000000 });
          } else {
              const b64 = fileBase64.replace(/^data:.*?;base64,/, "");
              const buff = Buffer.from(b64, 'base64');
              let content = type === 'video' ? { video: buff, caption } : { image: buff, caption };
              await sock.sendMessage(jid, content);
          }
      } catch(e) { console.error(e); }
  });

  socket.on('get_group_info', async (jid) => {
      try {
          const metadata = await sock.groupMetadata(jid);
          socket.emit('group_info', metadata);
      } catch(e) { console.error(e); }
  });

  socket.on('group_action', async ({ jid, action, participants }) => {
      try {
          await sock.groupParticipantsUpdate(jid, participants, action);
      } catch(e) { console.error(e); }
  });

  // --- WebRTC Signaling Logic ---
  // This allows calls between users connected to this web interface

  socket.on("call_user", (data) => {
      // data: { userToCall, signalData, from }
      // Broadcast to all clients (in a real app, emit to specific socket ID)
      socket.broadcast.emit("call_made", {
          signal: data.signalData,
          from: data.from
      });
  });

  socket.on("answer_call", (data) => {
      // data: { to, signal }
      socket.broadcast.emit("call_answered", {
          signal: data.signal,
          to: data.to
      });
  });

  socket.on("ice_candidate", (data) => {
      socket.broadcast.emit("ice_candidate_received", data);
  });

  socket.on("end_call", () => {
      socket.broadcast.emit("call_ended");
  });
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`Backend Server running on port ${PORT}`);
    console.log(`Frontend should be running on http://localhost:3000`);
});