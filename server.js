const Baileys = require('@whiskeysockets/baileys');
const makeWASocket = Baileys.default || Baileys;
const { 
  useMultiFileAuthState, 
  DisconnectReason, 
  fetchLatestBaileysVersion, 
  makeInMemoryStore,
  getContentType,
  downloadContentFromMessage,
  isJidBroadcast,
  isJidNewsletter
} = Baileys;
const { Boom } = require('@hapi/boom');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const qrcode = require('qrcode');
const cors = require('cors');
const fs = require('fs');
const mime = require('mime-types');
const path = require('path');

const store = makeInMemoryStore({ logger: console });
store.readFromFile('./baileys_store_multi.json');
setInterval(() => {
    store.writeToFile('./baileys_store_multi.json');
}, 10_000);

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'dist')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  maxHttpBufferSize: 1e8
});

let sock;
let lastQr = null;

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
    } else if (msgType === 'documentMessage') {
        stream = await downloadContentFromMessage(msg.message.documentMessage, 'document');
        type = 'document';
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
    if(type === 'document') mimeType = msg.message.documentMessage.mimetype || 'application/octet-stream';

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
    browser: ["Ubuntu", "Chrome", "20.0.04"],
    markOnlineOnConnect: true,
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

  const isExcluded = (jid) => {
      if (!jid) return true;
      if (isJidBroadcast(jid)) return true;
      if (jid === 'status@broadcast') return true;
      if (jid.endsWith('@newsletter')) return true;
      return false;
  };

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
          connectToWhatsApp();
      } else {
          lastQr = null;
          io.emit('logged_out');
      }
    } else if (connection === 'open') {
      let avatar = '';
      try {
          avatar = await sock.profilePictureUrl(sock.user.id, 'image').catch(() => '');
      } catch(e) {}

      const user = {
         id: sock.user.id.split(':')[0] + '@s.whatsapp.net',
         name: sock.user.name || 'Me',
         avatar: avatar
      };
      io.emit('ready', user);
      
      const chats = store.chats.all()
        .filter(c => !isExcluded(c.id))
        .map(chat => {
            const contact = store.contacts[chat.id];
            return {
                ...chat,
                name: chat.name || chat.subject || contact?.name || contact?.notify || chat.id.split('@')[0]
            };
        });
      io.emit('chats', chats);

      const contacts = Object.values(store.contacts).map(c => ({
          ...c,
          name: c.name || c.notify || c.id.split('@')[0]
      }));
      io.emit('contacts', contacts);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type === 'notify' || type === 'append') {
      for (const msg of messages) {
        if (isExcluded(msg.key.remoteJid) && msg.key.remoteJid !== 'status@broadcast') continue;

        const isStatus = msg.key.remoteJid === 'status@broadcast';
        
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

  sock.ev.on('chats.upsert', (newChats) => {
      const formatted = newChats.map(chat => {
          const contact = store.contacts[chat.id];
          return {
              ...chat,
              name: chat.name || chat.subject || contact?.name || contact?.notify || chat.id.split('@')[0]
          };
      });
      io.emit('chats', formatted);
  });

  sock.ev.on('chats.update', (updates) => {
      const formatted = updates.map(chat => {
          const contact = store.contacts[chat.id];
          return {
              ...chat,
              name: chat.name || chat.subject || contact?.name || contact?.notify || chat.id?.split('@')[0]
          };
      });
      io.emit('chats', formatted);
  });

  sock.ev.on('contacts.upsert', (contacts) => {
      const formatted = contacts.map(c => ({
          ...c,
          name: c.name || c.notify || c.id.split('@')[0]
      }));
      io.emit('contacts', formatted);
  });

  sock.ev.on('contacts.update', (updates) => {
      const formatted = updates.map(c => ({
          ...c,
          name: c.name || c.notify || c.id?.split('@')[0]
      }));
      io.emit('contacts', formatted);
  });

}

connectToWhatsApp();

io.on('connection', (socket) => {
  
  if (sock?.user) {
      socket.emit('ready', {
          id: sock.user.id.split(':')[0] + '@s.whatsapp.net',
          name: sock.user.name || 'Me' 
      });
      const chats = store.chats.all()
        .filter(c => !isExcluded(c.id))
        .sort((a,b) => (b.conversationTimestamp || 0) - (a.conversationTimestamp || 0))
        .map(chat => {
            const contact = store.contacts[chat.id];
            return {
                ...chat,
                name: chat.name || chat.subject || contact?.name || contact?.notify || chat.id.split('@')[0]
            };
        });
      socket.emit('chats', chats.slice(0, 50));

      const contacts = Object.values(store.contacts).map(c => ({
          ...c,
          name: c.name || c.notify || c.id.split('@')[0]
      }));
      socket.emit('contacts', contacts);

      // Fetch status history
      store.loadMessages('status@broadcast', 20).then(msgs => {
          msgs.forEach(async m => {
              const media = await getMedia(m).catch(() => null);
              socket.emit('status_update', { raw: m, media, isStatus: true });
          });
      }).catch(() => {});

  } else if (lastQr) {
      socket.emit('qr', lastQr);
  }

  socket.on('get_profile_pic', async (jid) => {
      if (!sock) return;
      try {
          const url = await sock.profilePictureUrl(jid, 'image').catch(() => null);
          socket.emit('profile_pic', { jid, url });
      } catch (e) {
          socket.emit('profile_pic', { jid, url: null });
      }
  });

  socket.on('fetch_messages', async (jid) => {
      try {
          const messages = await store.loadMessages(jid, 50);

          // Mark as read
          if (messages.length > 0) {
              const lastMsg = messages[messages.length - 1];
              await sock.readMessages([lastMsg.key]);
          }

          const messagesWithMedia = await Promise.all(messages.map(async (msg) => {
              let mediaData = null;
              try {
                  mediaData = await getMedia(msg);
              } catch(e) {}
              return { raw: msg, media: mediaData };
          }));
          socket.emit('messages', { jid, messages: messagesWithMedia });
      } catch (e) {
          console.error('Error fetching messages', e);
      }
  });

  socket.on('request_pairing_code', async (phoneNumber) => {
      if (!sock) return socket.emit('error', 'Socket not initialized');
      try {
          // Ensure number is in international format without + or spaces
          const cleanedPhone = phoneNumber.replace(/\D/g, '');
          if (!cleanedPhone) return socket.emit('error', 'Invalid phone number');

          console.log('Requesting pairing code for:', cleanedPhone);
          const code = await sock.requestPairingCode(cleanedPhone);
          socket.emit('pairing_code', code);
      } catch (e) {
          console.error('Error requesting pairing code', e);
          socket.emit('error', 'Could not request pairing code: ' + e.message);
      }
  });

  socket.on('send_message', async ({ jid, text }) => {
     if (!sock) return;
     try {
         await sock.presenceSubscribe(jid);
         await Baileys.delay(500);
         await sock.sendPresenceUpdate('composing', jid);
         await Baileys.delay(1000);
         await sock.sendPresenceUpdate('paused', jid);
         await sock.sendMessage(jid, { text });
     }
     catch (e) { console.error(e); }
  });

  socket.on('send_presence', async ({ jid, presence }) => {
      if (!sock) return;
      try {
          await sock.sendPresenceUpdate(presence, jid);
      } catch(e) {}
  });

  socket.on('send_media', async ({ jid, fileBase64, type, caption, isVoice, fileName }) => {
      if (!sock) return;
      try {
          const b64 = fileBase64.replace(/^data:.*?;base64,/, "");
          const buff = Buffer.from(b64, 'base64');
          
          let messageContent = {};

          if (type === 'audio') {
              messageContent = { audio: buff, ptt: isVoice, mimetype: 'audio/mp4' };
          } else if (type === 'video') {
              messageContent = { video: buff, caption, mimetype: 'video/mp4' };
          } else if (type === 'document') {
              messageContent = {
                  document: buff,
                  mimetype: mime.lookup(fileName) || 'application/octet-stream',
                  fileName: fileName || 'document'
              };
          } else {
              messageContent = { image: buff, caption };
          }

          await sock.sendMessage(jid, messageContent);
      } catch(e) { console.error('Error sending media', e); }
  });

  socket.on('search_contact', async (number) => {
      if (!sock) return;
      try {
          const [result] = await sock.onWhatsApp(number);
          socket.emit('search_result', result);
      } catch (e) { console.error(e); }
  });

  socket.on('post_status', async ({ fileBase64, type, caption, background }) => {
      if (!sock) return;
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
      if (!sock) return;
      try {
          const metadata = await sock.groupMetadata(jid);
          socket.emit('group_info', metadata);
      } catch(e) { console.error(e); }
  });

  socket.on('group_action', async ({ jid, action, participants }) => {
      if (!sock) return;
      try {
          await sock.groupParticipantsUpdate(jid, participants, action);
      } catch(e) { console.error(e); }
  });

  socket.on('update_profile_name', async (name) => {
      if (!sock) return;
      try {
          await sock.updateProfileName(name);
          socket.emit('profile_updated', { name });
      } catch (e) { console.error(e); }
  });

  socket.on('update_profile_status', async (status) => {
      if (!sock) return;
      try {
          await sock.updateProfileStatus(status);
          socket.emit('profile_updated', { status });
      } catch (e) { console.error(e); }
  });

  socket.on('update_profile_pic', async (fileBase64) => {
      if (!sock) return;
      try {
          const b64 = fileBase64.replace(/^data:.*?;base64,/, "");
          const buff = Buffer.from(b64, 'base64');
          await sock.updateProfilePicture(sock.user.id, buff);
          const url = await sock.profilePictureUrl(sock.user.id, 'image');
          socket.emit('profile_pic', { jid: sock.user.id, url });
      } catch (e) { console.error(e); }
  });

  socket.on('fetch_my_status', async () => {
      if (!sock) return;
      try {
          const status = await sock.fetchStatus(sock.user.id);
          socket.emit('my_status', status);
      } catch(e) {}
  });

  socket.on('get_privacy_settings', async () => {
      if (!sock) return;
      try {
          const settings = await sock.fetchPrivacySettings();
          socket.emit('privacy_settings', settings);
      } catch(e) { console.error(e); }
  });

  socket.on('update_privacy_setting', async ({ type, value }) => {
      if (!sock) return;
      try {
          switch(type) {
              case 'last': await sock.updateLastSeenPrivacy(value); break;
              case 'online': await sock.updateOnlinePrivacy(value); break;
              case 'photo': await sock.updateProfilePicturePrivacy(value); break;
              case 'status': await sock.updateStatusPrivacy(value); break;
              case 'readreceipts': await sock.updateReadReceiptsPrivacy(value); break;
              case 'groupadd': await sock.updateGroupsAddPrivacy(value); break;
          }
          const settings = await sock.fetchPrivacySettings();
          socket.emit('privacy_settings', settings);
      } catch(e) { console.error(e); }
  });

  // --- WebRTC Signaling Logic ---
  // This allows calls between users connected to this web interface
  
  socket.on("call_user", (data) => {
      // data: { userToCall, signalData, from, toJid }
      socket.broadcast.emit("call_made", {
          signal: data.signalData,
          from: data.from,
          toJid: data.toJid
      });
  });

  socket.on("answer_call", (data) => {
      // data: { to, signal, fromJid }
      socket.broadcast.emit("call_answered", {
          signal: data.signal,
          to: data.to,
          fromJid: data.fromJid
      });
  });

  socket.on("ice_candidate", (data) => {
      socket.broadcast.emit("ice_candidate_received", data);
  });

  socket.on("end_call", () => {
      socket.broadcast.emit("call_ended");
  });
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const PORT = process.env.PORT || 3001;

// Catch-all to serve index.html for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

server.listen(PORT, () => {
    console.log(`Unified Server running on port ${PORT}`);
    console.log(`Access the app at http://localhost:${PORT}`);
});