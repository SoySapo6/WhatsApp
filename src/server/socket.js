const { getSock, getStore, getLastQr, getMedia } = require('./whatsapp');
const Baileys = require('@whiskeysockets/baileys');
const { isJidBroadcast } = Baileys;

function registerHandlers(io, socket) {
  const sock = getSock();
  const store = getStore();
  const lastQr = getLastQr();

  if (sock?.user) {
      socket.emit('ready', {
          id: sock.user.id.split(':')[0] + '@s.whatsapp.net',
          name: sock.user.name || 'Me'
      });
      const chats = store.chats.all()
        .filter(c => !isJidBroadcast(c.id) && c.id !== 'status@broadcast')
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
  } else if (lastQr) {
      socket.emit('qr', lastQr);
  }

  socket.on('get_profile_pic', async (jid) => {
      const s = getSock();
      if (!s) return;
      try {
          const url = await s.profilePictureUrl(jid, 'image');
          socket.emit('profile_pic', { jid, url });
      } catch (e) {
          socket.emit('profile_pic', { jid, url: null });
      }
  });

  socket.on('fetch_messages', async (jid) => {
      try {
          const messages = await getStore().loadMessages(jid, 50);
          if (messages.length > 0) {
              await getSock().readMessages([messages[messages.length - 1].key]);
          }

          const messagesWithMedia = await Promise.all(messages.map(async (msg) => {
              let mediaData = null;
              try { mediaData = await getMedia(msg); } catch(e) {}
              return { raw: msg, media: mediaData };
          }));
          socket.emit('messages', { jid, messages: messagesWithMedia });
      } catch (e) {
          console.error('Error fetching messages', e);
      }
  });

  socket.on('request_pairing_code', async (phoneNumber) => {
      const s = getSock();
      if (!s) return;
      try {
          const cleanedPhone = phoneNumber.replace(/\D/g, '');
          const code = await s.requestPairingCode(cleanedPhone);
          socket.emit('pairing_code', code);
      } catch (e) {
          socket.emit('error', 'Could not request pairing code: ' + e.message);
      }
  });

  socket.on('check_number', async (phone) => {
      const s = getSock();
      if (!s) return;
      try {
          const result = await s.onWhatsApp(phone);
          if (result && result.length > 0) {
              socket.emit('number_status', { ...result[0], exists: true });
          } else {
              socket.emit('number_status', { exists: false, jid: phone });
          }
      } catch (e) {
          socket.emit('number_status', { exists: false, error: e.message });
      }
  });

  socket.on('send_message', async ({ jid, text }) => {
     const s = getSock();
     if (!s) return;
     try {
         const targetJid = jid.includes('@') ? jid : `${jid}@s.whatsapp.net`;

         await s.presenceSubscribe(targetJid);
         await Baileys.delay(200);
         await s.sendPresenceUpdate('composing', targetJid);
         await Baileys.delay(500);
         await s.sendPresenceUpdate('paused', targetJid);
         const sent = await s.sendMessage(targetJid, { text });
         socket.emit('message_sent', { jid, message: sent });
     }
     catch (e) {
         console.error(e);
         socket.emit('error', 'Failed to send message: ' + e.message);
     }
  });

  socket.on('send_media', async ({ jid, fileBase64, type, caption, isVoice }) => {
      const s = getSock();
      if (!s) return;
      try {
          const targetJid = jid.includes('@') ? jid : `${jid}@s.whatsapp.net`;
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

          await s.sendMessage(targetJid, messageContent);
      } catch(e) { console.error('Error sending media', e); }
  });

  socket.on('post_status', async ({ fileBase64, type, caption }) => {
      const s = getSock();
      if (!s) return;
      try {
          const jid = 'status@broadcast';
          if (type === 'text') {
               await s.sendMessage(jid, { text: caption });
          } else {
              const b64 = fileBase64.replace(/^data:.*?;base64,/, "");
              const buff = Buffer.from(b64, 'base64');
              let content = type === 'video' ? { video: buff, caption } : { image: buff, caption };
              await s.sendMessage(jid, content);
          }
      } catch(e) { console.error(e); }
  });

  socket.on('get_group_info', async (jid) => {
      const s = getSock();
      if (!s) return;
      try {
          const metadata = await s.groupMetadata(jid);
          socket.emit('group_info', metadata);
      } catch(e) { console.error(e); }
  });

  socket.on('group_action', async ({ jid, action, participants }) => {
      const s = getSock();
      if (!s) return;
      try {
          await s.groupParticipantsUpdate(jid, participants, action);
      } catch(e) { console.error(e); }
  });

  socket.on('update_profile_name', async (name) => {
      const s = getSock();
      if (!s) return;
      try {
          await s.updateProfileName(name);
          socket.emit('profile_updated', { name });
      } catch (e) { console.error(e); }
  });

  socket.on('update_profile_status', async (status) => {
      const s = getSock();
      if (!s) return;
      try {
          await s.updateProfileStatus(status);
          socket.emit('profile_updated', { status });
      } catch (e) { console.error(e); }
  });

  socket.on('update_profile_pic', async (fileBase64) => {
      const s = getSock();
      if (!s) return;
      try {
          const b64 = fileBase64.replace(/^data:.*?;base64,/, "");
          const buff = Buffer.from(b64, 'base64');
          await s.updateProfilePicture(s.user.id, buff);
          const url = await s.profilePictureUrl(s.user.id, 'image');
          socket.emit('profile_pic', { jid: s.user.id, url });
      } catch (e) { console.error(e); }
  });

  socket.on('get_privacy_settings', async () => {
      const s = getSock();
      if (!s) return;
      try {
          const settings = await s.fetchPrivacySettings();
          socket.emit('privacy_settings', settings);
      } catch(e) { console.error(e); }
  });

  socket.on('get_blocklist', async () => {
      const s = getSock();
      if (!s) return;
      try {
          const blocklist = await s.fetchBlocklist();
          socket.emit('blocklist', blocklist);
      } catch (e) { console.error(e); }
  });

  socket.on('update_privacy_setting', async ({ type, value }) => {
      const s = getSock();
      if (!s) return;
      try {
          switch(type) {
              case 'last': await s.updateLastSeenPrivacy(value); break;
              case 'online': await s.updateOnlinePrivacy(value); break;
              case 'photo': await s.updateProfilePicturePrivacy(value); break;
              case 'status': await s.updateStatusPrivacy(value); break;
              case 'readreceipts': await s.updateReadReceiptsPrivacy(value); break;
              case 'groupadd': await s.updateGroupsAddPrivacy(value); break;
          }
          const settings = await s.fetchPrivacySettings();
          socket.emit('privacy_settings', settings);
      } catch(e) { console.error(e); }
  });

  // Call Signaling
  socket.on("call_user", (data) => {
      socket.broadcast.emit("call_made", {
          signal: data.signalData,
          from: data.from,
          isVideo: data.isVideo
      });
  });

  socket.on("answer_call", (data) => {
      socket.broadcast.emit("call_answered", {
          signal: data.signal,
          to: data.to
      });
  });

  socket.on("reject_call", (data) => {
      socket.broadcast.emit("call_rejected", data);
  });

  socket.on("ice_candidate", (data) => {
      socket.broadcast.emit("ice_candidate_received", data);
  });

  socket.on("end_call", () => {
      socket.broadcast.emit("call_ended");
  });
}

module.exports = { registerHandlers };
