import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  const [viewState, setViewState] = useState<ViewState>(ViewState.CONNECTING);
  const [sideView, setSideView] = useState<SideBarView>(SideBarView.CHATS);
  
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [contacts, setContacts] = useState<User[]>([]);
  const [statusUpdates, setStatusUpdates] = useState<any[]>([]);
  const [presences, setPresences] = useState<Record<string, any>>({});
  const [currentUser, setCurrentUser] = useState<User>({ id: '', name: '', avatar: '' });
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState<any>(null);
  
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
    });

    socket.on('contacts', (rawContacts: any[]) => {
        const formatted: User[] = rawContacts.map(c => ({
            id: c.id,
            name: c.name || c.id.split('@')[0],
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name || c.id)}&background=random&color=fff`
        }));
        setContacts(formatted);
    });

    socket.on('chats', (rawChats: any[]) => {
      setChats(prev => {
          const newChats: ChatSession[] = rawChats.map(c => {
              const existing = prev.find(p => p.id === c.id);
              return {
                id: c.id,
                contact: {
                    id: c.id,
                    name: c.name || c.id.split('@')[0],
                    avatar: existing?.contact.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name || c.id)}&background=random&color=fff`
                },
                messages: existing?.messages || [],
                unreadCount: c.unreadCount || 0,
                lastMessageTime: c.conversationTimestamp ? c.conversationTimestamp * 1000 : (existing?.lastMessageTime || Date.now()),
                isGroup: c.id.includes('@g.us')
              };
          });
          return newChats;
      });
      
      // Request avatars for all chats
      rawChats.forEach(c => {
          socket.emit('get_profile_pic', c.id);
      });
    });

    socket.on('profile_pic', ({ jid, url }: { jid: string, url: string | null }) => {
        setChats(prev => prev.map(c =>
            c.id === jid ? {
                ...c,
                contact: {
                    ...c.contact,
                    avatar: url || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.contact.name)}&background=random&color=fff`
                }
            } : c
        ));
        if (currentUser.id === jid) {
            setCurrentUser(prev => ({ ...prev, avatar: url || prev.avatar }));
        }
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
            const newChat: ChatSession = {
                id: chatId,
                contact: {
                    id: chatId,
                    name: msg.pushName || chatId.replace('@s.whatsapp.net', ''),
                    avatar: 'https://via.placeholder.com/50'
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
         setStatusUpdates(prev => [msg, ...prev]);
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
      if (!activeChatId) return;

      try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true });
          
          setActiveCall({
              isActive: true,
              isIncoming: false,
              isVideo,
              remoteUser: activeChatId,
              localStream: stream
          });

          // Signaling Logic would go here (Create Offer)
          // For now, we simulate the local experience of starting a call
          socket.emit('call_user', {
              userToCall: activeChatId,
              signalData: { type: 'offer', sdp: 'dummy-sdp' }, // In real app, use PC.createOffer()
              from: currentUser.id
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

  const activeChat = chats.find(c => c.id === activeChatId);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#111b21]">
      <div className="container mx-auto max-w-[1700px] h-full flex shadow-lg relative">
        
        <div className={`
            w-full md:w-[400px] flex-shrink-0 h-full bg-[#111b21] z-20 transition-all duration-300
            ${activeChatId ? 'hidden md:block' : 'block'}
        `}>
          <Sidebar 
            currentUser={currentUser}
            chats={chats}
            contacts={contacts}
            statusUpdates={statusUpdates}
            activeChatId={activeChatId}
            presences={presences}
            currentView={sideView}
            onChangeView={setSideView}
            onSelectChat={handleSelectChat}
            onUploadStatus={handleUploadStatus}
            onNewChat={handleNewChat}
            onViewStatus={setActiveStatus}
          />
        </div>

        <div className={`
            flex-1 h-full bg-[#222e35] relative flex
            ${!activeChatId ? 'hidden md:flex' : 'flex'}
        `}>
          {activeChat ? (
             <div className="flex-1 flex flex-col relative">
                <ChatWindow 
                    chat={activeChat} 
                    onBack={() => {
                        setActiveChatId(null);
                        socket.emit('send_presence', { jid: activeChat.id, presence: 'unavailable' });
                    }}
                    onSendMessage={handleSendMessage}
                    onSendImage={handleSendImage}
                    onSendAudio={handleSendAudio}
                    onOpenInfo={() => setShowGroupInfo(true)}
                    onCall={() => startCall(true)}
                    presence={presences[activeChat.id]}
                />
                
                {/* Full Featured Call Modal */}
                {activeCall && activeCall.isActive && (
                    <CallModal 
                        contactName={activeChat.contact.name}
                        contactAvatar={activeChat.contact.avatar}
                        isVideo={activeCall.isVideo}
                        isIncoming={activeCall.isIncoming}
                        onEndCall={endCall}
                        stream={activeCall.localStream}
                        onAnswer={() => { /* Logic to answer and get local stream */ }}
                    />
                )}
             </div>
          ) : (
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
          )}
          
          {activeChat && showGroupInfo && (
              <GroupInfo 
                chat={activeChat} 
                onClose={() => setShowGroupInfo(false)} 
                currentUserJid={currentUser.id}
                onAction={handleGroupAction}
              />
          )}

          {activeStatus && (
              <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-10">
                  <button
                    onClick={() => setActiveStatus(null)}
                    className="absolute top-10 right-10 text-white hover:text-gray-300"
                  >
                      <Icons.Close className="w-8 h-8" />
                  </button>
                  <div className="max-w-2xl w-full h-full flex flex-col items-center justify-center">
                      <div className="w-full mb-4 flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full border border-white p-0.5 overflow-hidden">
                              <img src="https://via.placeholder.com/50" className="w-full h-full object-cover" />
                          </div>
                          <div>
                              <p className="text-white font-medium">{activeStatus.pushName || 'Unknown User'}</p>
                          </div>
                      </div>
                      <div className="flex-1 w-full bg-[#111b21] flex items-center justify-center rounded-xl overflow-hidden shadow-2xl border border-white/10">
                          {activeStatus.type === 'video' ? (
                              <video src={activeStatus.mediaUrl} controls autoPlay className="max-w-full max-h-full" />
                          ) : (
                              <img src={activeStatus.mediaUrl} className="max-w-full max-h-full object-contain" />
                          )}
                      </div>
                      {activeStatus.text && (
                          <div className="mt-6 text-white text-center text-lg bg-black/40 px-6 py-3 rounded-full backdrop-blur-md">
                              {activeStatus.text}
                          </div>
                      )}
                  </div>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;