import React, { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { Routes, Route, useNavigate, useParams, useLocation, Navigate } from 'react-router-dom';
import { ViewState, ChatSession, Message, User, SideBarView, GroupMetadata } from './types';
import { Login } from './components/Login';
import { Sidebar } from './components/Sidebar';
import { ChatWindow } from './components/ChatWindow';
import { GroupInfo } from './components/GroupInfo';
import { CallModal } from './components/CallModal';
import { socket, normalizeMessage } from './services/socket';
import { Icons } from './components/Icons';

// WebRTC Configuration
const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
    ]
};

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { jid: paramJid } = useParams();

  const [viewState, setViewState] = useState<ViewState>(ViewState.CONNECTING);
  const [sideView, setSideView] = useState<SideBarView>(SideBarView.CHATS);
  
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [contacts, setContacts] = useState<User[]>([]);
  const [statusUpdates, setStatusUpdates] = useState<Record<string, any[]>>({});
  const [presences, setPresences] = useState<Record<string, any>>({});
  const [currentUser, setCurrentUser] = useState<User>({ id: '', name: '', avatar: '' });
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState<any[] | null>(null);
  const [currentStatusIndex, setCurrentStatusIndex] = useState(0);
  const [privacySettings, setPrivacySettings] = useState<Record<string, string>>({});
  
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState('Connecting to backend...');
  
  // Call State
  const [activeCall, setActiveCall] = useState<{
      isActive: boolean;
      isIncoming: boolean;
      isVideo: boolean;
      remoteUser?: string;
      localStream?: MediaStream;
  } | null>(null);

  const peerConnection = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    socket.connect();

    socket.on('connect', () => setConnectionStatus('Connected to server'));
    socket.on('disconnect', () => {
      setConnectionStatus('Disconnected from server');
      setViewState(ViewState.LOGIN);
      setQrCode(null);
    });

    socket.on('qr', (dataUrl: string) => {
      setQrCode(dataUrl);
      setViewState(ViewState.LOGIN);
      setConnectionStatus('Scan QR Code');
    });

    socket.on('connection_update', (update: any) => {
        if (update.connection === 'connecting') {
            setConnectionStatus('Connecting to WhatsApp...');
        } else if (update.connection === 'close') {
            setConnectionStatus('Connection closed. Reconnecting...');
        }
    });

    socket.on('pairing_code', (code: string) => {
        setPairingCode(code);
    });

    socket.on('error', (msg: string) => {
        setConnectionStatus('Error: ' + msg);
    });

    socket.on('ready', (user: any) => {
      setCurrentUser({
        id: user.id,
        name: user.name,
        avatar: user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'Me')}&background=random&color=fff`
      });
      setViewState(ViewState.MAIN);
      setConnectionStatus('Online');
      socket.emit('fetch_my_status');
      socket.emit('get_privacy_settings');
    });

    socket.on('contacts', (rawContacts: any[]) => {
        const formatted: User[] = rawContacts.map(c => ({
            id: c.id,
            name: c.name || c.id.split('@')[0],
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name || c.id.split('@')[0])}&background=random&color=fff`
        }));
        setContacts(formatted);
    });

    socket.on('chats', (rawChats: any[]) => {
      setChats(prev => {
          const merged = [...prev];
          rawChats.forEach(c => {
              const index = merged.findIndex(p => p.id === c.id);
              const name = c.name || c.id.split('@')[0];
              const formattedChat: ChatSession = {
                id: c.id,
                contact: {
                    id: c.id,
                    name: name,
                    avatar: merged[index]?.contact.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff`
                },
                messages: merged[index]?.messages || [],
                unreadCount: typeof c.unreadCount === 'number' ? c.unreadCount : (merged[index]?.unreadCount || 0),
                lastMessageTime: c.conversationTimestamp ? c.conversationTimestamp * 1000 : (merged[index]?.lastMessageTime || Date.now()),
                isGroup: c.id.includes('@g.us')
              };
              if (index !== -1) {
                  merged[index] = { ...merged[index], ...formattedChat };
              } else {
                  merged.push(formattedChat);
              }
          });
          return merged.sort((a,b) => b.lastMessageTime - a.lastMessageTime);
      });
      
      // Request avatars for all chats
      rawChats.forEach(c => {
          socket.emit('get_profile_pic', c.id);
      });
    });

    socket.on('profile_pic', ({ jid, url }: { jid: string, url: string | null }) => {
        if (!url) return;

        setChats(prev => prev.map(c =>
            c.id === jid ? {
                ...c,
                contact: { ...c.contact, avatar: url }
            } : c
        ));

        setContacts(prev => prev.map(c =>
            c.id === jid ? { ...c, avatar: url } : c
        ));

        setCurrentUser(prev => {
            if (prev.id === jid || (prev.id.split(':')[0] === jid.split(':')[0])) {
                return { ...prev, avatar: url };
            }
            return prev;
        });
    });

    socket.on('profile_updated', (update: any) => {
        setCurrentUser(prev => ({ ...prev, ...update }));
    });

    socket.on('my_status', (data: any) => {
        setCurrentUser(prev => ({ ...prev, status: data?.status }));
    });

    socket.on('privacy_settings', (settings: any) => {
        setPrivacySettings(settings);
    });

    socket.on('messages', ({ jid, messages }: { jid: string, messages: any[] }) => {
        const normalized = messages.map(m => normalizeMessage(m));
        setChats(prev => prev.map(c =>
            c.id === jid ? { ...c, messages: normalized } : c
        ));
    });

    socket.on('presence', (update: any) => {
        setPresences(prev => ({
            ...prev,
            [update.id]: update.presences
        }));
    });

    socket.on('message', async (payload: any) => {
      const msg = normalizeMessage(payload);
      const chatId = msg.key.remoteJid;

      setChats(prevChats => {
        const chatExists = prevChats.find(c => c.id === chatId);
        
        // Request avatar if not present
        if (!chatExists || !chatExists.contact.avatar.includes('data:image') && chatExists.contact.avatar.includes('ui-avatars')) {
            socket.emit('get_profile_pic', chatId);
        }

        if (chatExists) {
            return prevChats.map(c => {
                if (c.id === chatId) {
                    return {
                        ...c,
                        messages: [...c.messages, msg],
                        lastMessageTime: msg.timestamp,
                        unreadCount: (activeChatId !== chatId && !msg.key.fromMe) ? c.unreadCount + 1 : 0
                    };
                }
                return c;
            }).sort((a, b) => b.lastMessageTime - a.lastMessageTime);
        } else {
            const name = msg.pushName || chatId.replace('@s.whatsapp.net', '');
            const newChat: ChatSession = {
                id: chatId,
                contact: {
                    id: chatId,
                    name: name,
                    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff`
                },
                messages: [msg],
                unreadCount: msg.key.fromMe ? 0 : 1,
                lastMessageTime: msg.timestamp,
                isGroup: chatId.includes('@g.us')
            };
            return [newChat, ...prevChats];
        }
      });
    });
    
    socket.on('status_update', (payload) => {
         const msg = normalizeMessage(payload);
         const jid = msg.key.participant || msg.key.remoteJid;
         setStatusUpdates(prev => ({
             ...prev,
             [jid]: [msg, ...(prev[jid] || [])].sort((a,b) => b.timestamp - a.timestamp)
         }));
    });

    socket.on('group_info', (metadata: GroupMetadata) => {
        setChats(prev => prev.map(c => 
            c.id === metadata.id ? { ...c, groupMetadata: metadata } : c
        ));
    });

    // --- Signal Handling ---
    socket.on('call_made', async (data) => {
        // Simple implementation: Auto-accept incoming call setup for demo
        // In reality, we would show "Incoming" UI first.
        setActiveCall({
            isActive: true,
            isIncoming: true,
            isVideo: true,
            remoteUser: data.from
        });
        // We will need to set remote description here
    });

    socket.on('call_ended', () => {
        endCall();
    });

    // Native WhatsApp call notification
    socket.on('native_call', (callInfo) => {
         // Show notification but don't hijack stream (encryption limit)
         console.log("Native call incoming:", callInfo);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('qr');
      socket.off('connection_update');
      socket.off('error');
      socket.off('ready');
      socket.off('chats');
      socket.off('message');
      socket.off('status_update');
      socket.off('group_info');
      socket.off('profile_pic');
      socket.off('messages');
      socket.off('presence');
      socket.off('native_call');
      socket.off('call_made');
      socket.off('call_ended');
      socket.disconnect();
    };
  }, [activeChatId]);

  useEffect(() => {
      if (activeChatId && activeChatId.includes('@g.us')) {
          socket.emit('get_group_info', activeChatId);
      }
  }, [activeChatId]);

  const handleSelectChat = (id: string) => {
    setActiveChatId(id);
    setSideView(SideBarView.CHATS);
    socket.emit('fetch_messages', id);
    socket.emit('send_presence', { jid: id, presence: 'available' });
    setChats(prev => prev.map(c => 
        c.id === id ? { ...c, unreadCount: 0 } : c
    ));
    navigate(`/chat/${id}`);
  };

  const handleSendMessage = useCallback(async (chatId: string, text: string) => {
    socket.emit('send_message', { jid: chatId, text });
  }, []);

  const handleSendImage = useCallback((chatId: string, base64: string, caption: string, type: 'image'|'video') => {
    socket.emit('send_media', { jid: chatId, fileBase64: base64, caption, type });
  }, []);

  const handleSendAudio = useCallback((chatId: string, base64: string) => {
    socket.emit('send_media', { jid: chatId, fileBase64: base64, type: 'audio', isVoice: true });
  }, []);
  
  const handleUploadStatus = (base64: string, type: 'image'|'video') => {
      socket.emit('post_status', { fileBase64: base64, type, caption: 'Status Update' });
  };

  const handleRequestPairing = (phone: string) => {
      socket.emit('request_pairing_code', phone);
  };

  const handleUpdateProfile = (data: { name?: string, status?: string, photo?: string }) => {
      if (data.name) socket.emit('update_profile_name', data.name);
      if (data.status) socket.emit('update_profile_status', data.status);
      if (data.photo) socket.emit('update_profile_pic', data.photo);
  };

  const handleUpdatePrivacy = (type: string, value: string) => {
      socket.emit('update_privacy_setting', { type, value });
  };

  const handleNewChat = (phone: string) => {
      const jid = phone.replace(/\D/g, '') + '@s.whatsapp.net';
      const chatExists = chats.find(c => c.id === jid);
      if (!chatExists) {
          const newChat: ChatSession = {
              id: jid,
              contact: {
                  id: jid,
                  name: phone,
                  avatar: 'https://via.placeholder.com/50'
              },
              messages: [],
              unreadCount: 0,
              lastMessageTime: Date.now(),
              isGroup: false
          };
          setChats(prev => [newChat, ...prev]);
          socket.emit('get_profile_pic', jid);
      }
      handleSelectChat(jid);
  };

  const handleGroupAction = (action: string, participantId?: string) => {
      if (!activeChatId || !participantId) return;
      socket.emit('group_action', { 
          jid: activeChatId, 
          action, 
          participants: [participantId] 
      });
      setTimeout(() => socket.emit('get_group_info', activeChatId), 1000);
  };

  // --- Call Logic ---
  const startCall = async (isVideo: boolean) => {
      const targetJid = activeCall?.remoteUser || activeChatId;
      if (!targetJid) return;

      try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true });
          
          setActiveCall({
              isActive: true,
              isIncoming: false,
              isVideo,
              remoteUser: targetJid,
              localStream: stream
          });

          // Signaling Logic would go here (Create Offer)
          socket.emit('call_user', {
              userToCall: targetJid,
              signalData: { type: 'offer', sdp: 'dummy-sdp' },
              from: currentUser.id,
              toJid: targetJid
          });

      } catch (err) {
          console.error("Error accessing media devices", err);
          alert("Could not access camera/microphone");
      }
  };

  const endCall = () => {
      if (activeCall?.localStream) {
          activeCall.localStream.getTracks().forEach(track => track.stop());
      }
      if (peerConnection.current) {
          peerConnection.current.close();
          peerConnection.current = null;
      }
      setActiveCall(null);
      socket.emit('end_call');
  };

  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith('/chat/')) {
        const jid = path.replace('/chat/', '');
        if (jid && jid !== activeChatId) {
            setActiveChatId(jid);
            socket.emit('fetch_messages', jid);
        }
    } else if (path === '/status') {
        setSideView(SideBarView.STATUS);
        setActiveChatId(null);
    } else if (path === '/calls') {
        setSideView(SideBarView.CALLS);
        setActiveChatId(null);
    } else if (path === '/profile') {
        setSideView(SideBarView.PROFILE);
    } else if (path === '/settings') {
        setSideView(SideBarView.SETTINGS);
    } else if (path === '/') {
        setSideView(SideBarView.CHATS);
        setActiveChatId(null);
    }
  }, [location.pathname, chats]);

  const handleBack = () => {
      setActiveChatId(null);
      navigate('/');
  };

  const handleChangeView = (view: SideBarView) => {
      setSideView(view);
      switch(view) {
          case SideBarView.CHATS: navigate('/'); break;
          case SideBarView.STATUS: navigate('/status'); break;
          case SideBarView.CALLS: navigate('/calls'); break;
          case SideBarView.PROFILE: navigate('/profile'); break;
          case SideBarView.SETTINGS: navigate('/settings'); break;
          case SideBarView.NEW_CHAT: navigate('/new'); break;
      }
  };

  const handleViewStatus = (statuses: any[]) => {
      setActiveStatus(statuses);
      setCurrentStatusIndex(0);
  };

  const nextStatus = () => {
      if (!activeStatus) return;
      if (currentStatusIndex < activeStatus.length - 1) {
          setCurrentStatusIndex(currentStatusIndex + 1);
      } else {
          setActiveStatus(null);
      }
  };

  if (viewState === ViewState.LOGIN || viewState === ViewState.CONNECTING) {
    return (
        <Login
            qrCode={qrCode}
            status={connectionStatus}
            pairingCode={pairingCode}
            onRequestPairing={handleRequestPairing}
        />
    );
  }

  const activeChat = activeChatId ? chats.find(c => c.id === activeChatId) : null;

  const isMainList = location.pathname === '/' || location.pathname === '/status' || location.pathname === '/calls' || location.pathname === '/profile' || location.pathname === '/settings' || location.pathname === '/new';

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#111b21] md:p-4">
      <div className="w-full max-w-[1600px] mx-auto h-full flex shadow-lg relative bg-[#111b21] overflow-hidden">
        
        {/* Sidebar - Hidden on mobile if a chat is active */}
        <div className={`
            w-full md:w-[400px] flex-shrink-0 h-full bg-[#111b21] z-20 transition-all duration-300
            ${!isMainList && window.innerWidth < 768 ? 'hidden md:block' : 'block'}
        `}>
          <Sidebar 
            currentUser={currentUser}
            chats={chats}
            contacts={contacts}
            statusUpdates={statusUpdates}
            activeChatId={activeChatId}
            presences={presences}
            currentView={sideView}
            onChangeView={handleChangeView}
            onSelectChat={handleSelectChat}
            onUploadStatus={handleUploadStatus}
            onNewChat={handleNewChat}
            onViewStatus={handleViewStatus}
            onUpdateProfile={handleUpdateProfile}
            privacySettings={privacySettings}
            onUpdatePrivacy={handleUpdatePrivacy}
          />
        </div>

        {/* Main Content Area */}
        <div className={`
            flex-1 h-full bg-[#222e35] relative flex flex-col
            ${isMainList && window.innerWidth < 768 ? 'hidden md:flex' : 'flex'}
        `}>
          <Routes>
            <Route path="/" element={
                 <div className="flex-1 flex flex-col items-center justify-center border-b-[6px] border-[#00a884] bg-[#222e35] text-[#e9edef]">
                    <div className="max-w-[560px] text-center">
                        <img
                            src="https://static.whatsapp.net/rsrc.php/v3/y6/r/wa66945d.svg"
                            alt="WhatsApp Web"
                            className="w-[300px] mx-auto mb-10 opacity-60 filter invert grayscale"
                        />
                        <h1 className="text-3xl font-light text-[#e9edef] mb-5">WhatsApp Web Real</h1>
                        <p className="text-[#8696a0] text-sm leading-6">
                            Send and receive messages without keeping your phone online.<br/>
                            Connected to Baileys Backend.
                        </p>
                    </div>
                </div>
            } />

            <Route path="/chat/:jid" element={
                activeChat ? (
                    <div className="flex-1 flex flex-col relative">
                        <ChatWindow
                            chat={activeChat}
                            onBack={handleBack}
                            onSendMessage={handleSendMessage}
                            onSendImage={handleSendImage}
                            onSendAudio={handleSendAudio}
                            onOpenInfo={() => setShowGroupInfo(true)}
                            onCall={() => startCall(true)}
                            presence={presences[activeChat.id]}
                        />
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-[#8696a0]">Loading chat...</div>
                )
            } />

            <Route path="/status" element={<div className="flex-1 bg-[#111b21] md:bg-[#222e35]"></div>} />
            <Route path="/profile" element={<div className="flex-1 bg-[#111b21] md:bg-[#222e35]"></div>} />
            <Route path="/settings" element={<div className="flex-1 bg-[#111b21] md:bg-[#222e35]"></div>} />
            <Route path="/calls" element={<div className="flex-1 bg-[#111b21] md:bg-[#222e35]"></div>} />
            <Route path="/new" element={<div className="flex-1 bg-[#111b21] md:bg-[#222e35]"></div>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          
          {activeChat && showGroupInfo && (
              <GroupInfo 
                chat={activeChat} 
                onClose={() => setShowGroupInfo(false)} 
                currentUserJid={currentUser.id}
                onAction={handleGroupAction}
              />
          )}

          {/* Call Modal - Global */}
          {activeCall && activeCall.isActive && (
              <CallModal
                  contactName={chats.find(c => c.id === activeCall.remoteUser)?.contact.name || activeCall.remoteUser || 'Unknown'}
                  contactAvatar={chats.find(c => c.id === activeCall.remoteUser)?.contact.avatar || ''}
                  isVideo={activeCall.isVideo}
                  isIncoming={activeCall.isIncoming}
                  onEndCall={endCall}
                  stream={activeCall.localStream}
                  onAnswer={() => {
                      startCall(activeCall.isVideo);
                  }}
              />
          )}

          {activeStatus && (
              <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-10" onClick={nextStatus}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setActiveStatus(null); }}
                    className="absolute top-10 right-10 text-white hover:text-gray-300 z-50"
                  >
                      <Icons.Close className="w-8 h-8" />
                  </button>

                  <div className="absolute top-4 left-1/2 -translate-x-1/2 w-full max-w-md flex gap-1 px-4">
                      {activeStatus.map((_, i) => (
                          <div key={i} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
                              <div className={`h-full bg-white transition-all duration-300 ${i <= currentStatusIndex ? 'w-full' : 'w-0'}`} />
                          </div>
                      ))}
                  </div>

                  <div className="max-w-2xl w-full h-full flex flex-col items-center justify-center relative" onClick={e => e.stopPropagation()}>
                      <div className="absolute top-10 left-0 w-full mb-4 flex items-center gap-4 px-4 z-10">
                          <div className="w-10 h-10 rounded-full border border-white p-0.5 overflow-hidden">
                              <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(activeStatus[currentStatusIndex].pushName || 'User')}`} className="w-full h-full object-cover" />
                          </div>
                          <div>
                              <p className="text-white font-medium">{activeStatus[currentStatusIndex].pushName || 'Unknown User'}</p>
                              <p className="text-white/60 text-xs">{format(activeStatus[currentStatusIndex].timestamp, 'HH:mm')}</p>
                          </div>
                      </div>

                      <div className="flex-1 w-full bg-[#111b21] flex items-center justify-center rounded-xl overflow-hidden shadow-2xl border border-white/10 relative">
                          {activeStatus[currentStatusIndex].type === 'video' ? (
                              <video src={activeStatus[currentStatusIndex].mediaUrl} controls autoPlay className="max-w-full max-h-full" />
                          ) : activeStatus[currentStatusIndex].mediaUrl ? (
                              <img src={activeStatus[currentStatusIndex].mediaUrl} className="max-w-full max-h-full object-contain" />
                          ) : (
                              <div className="w-full h-full flex items-center justify-center bg-wa-outgoing p-10 text-center text-2xl font-medium">
                                  {activeStatus[currentStatusIndex].text}
                              </div>
                          )}
                      </div>

                      {activeStatus[currentStatusIndex].text && activeStatus[currentStatusIndex].mediaUrl && (
                          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-white text-center text-lg bg-black/40 px-6 py-3 rounded-xl backdrop-blur-md max-w-[90%]">
                              {activeStatus[currentStatusIndex].text}
                          </div>
                      )}

                      <button
                        className="absolute left-[-60px] top-1/2 -translate-y-1/2 text-white/50 hover:text-white hidden md:block"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (currentStatusIndex > 0) setCurrentStatusIndex(currentStatusIndex - 1);
                        }}
                      >
                          <Icons.Back className="w-10 h-10" />
                      </button>
                      <button
                        className="absolute right-[-60px] top-1/2 -translate-y-1/2 text-white/50 hover:text-white hidden md:block"
                        onClick={(e) => { e.stopPropagation(); nextStatus(); }}
                      >
                          <Icons.Back className="w-10 h-10 rotate-180" />
                      </button>
                  </div>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;