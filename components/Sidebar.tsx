import React, { useRef } from 'react';
import { ChatSession, User, SideBarView, Presence } from '../types';
import { Icons } from './Icons';
import { format } from 'date-fns';

interface SidebarProps {
  currentUser: User;
  chats: ChatSession[];
  contacts: User[];
  statusUpdates: Record<string, any[]>;
  activeChatId: string | null;
  presences: Record<string, any>;
  currentView: SideBarView;
  onSelectChat: (id: string) => void;
  onChangeView: (view: SideBarView) => void;
  onUploadStatus: (file: string, type: 'image'|'video') => void;
  onNewChat: (phone: string) => void;
  onViewStatus: (statuses: any[]) => void;
  onUpdateProfile: (data: { name?: string, status?: string, photo?: string }) => void;
  privacySettings?: Record<string, string>;
  onUpdatePrivacy?: (type: string, value: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentUser, chats, contacts, statusUpdates, activeChatId, presences, currentView, onSelectChat, onChangeView, onUploadStatus, onNewChat, onViewStatus, onUpdateProfile, privacySettings, onUpdatePrivacy }) => {
  const statusInputRef = useRef<HTMLInputElement>(null);
  const profilePicInputRef = useRef<HTMLInputElement>(null);
  const [newChatPhone, setNewChatPhone] = React.useState('');
  const [searchTerm, setSearchTerm] = React.useState('');

  const handleStatusFile = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
             const type = file.type.startsWith('video') ? 'video' : 'image';
             onUploadStatus(reader.result as string, type);
        }
        reader.readAsDataURL(file);
      }
  };

  const renderHeader = () => (
    <div className="h-16 bg-wa-header px-4 flex items-center justify-between shrink-0">
        <img 
            src={currentUser.avatar || 'https://via.placeholder.com/150'} 
            alt="Profile" 
            onClick={() => onChangeView(SideBarView.PROFILE)}
            className="w-10 h-10 rounded-full cursor-pointer hover:opacity-80 transition-opacity object-cover"
        />
        <div className="flex items-center gap-5 text-[#aebac1]">
            <button title="Communities" onClick={() => onChangeView(SideBarView.COMMUNITIES)}>
                <Icons.Users className={`w-6 h-6 ${currentView === SideBarView.COMMUNITIES ? 'text-[#00a884]' : ''}`} />
            </button>
            <button title="Status" onClick={() => onChangeView(SideBarView.STATUS)}>
                <Icons.Status className={`w-6 h-6 ${currentView === SideBarView.STATUS ? 'text-[#00a884]' : ''}`} />
            </button>
            <button title="Channels" onClick={() => onChangeView(SideBarView.CHANNELS)}>
                <Icons.Chat className={`w-6 h-6 ${currentView === SideBarView.CHANNELS ? 'text-[#00a884]' : ''}`} />
            </button>
             <button title="New Chat" onClick={() => onChangeView(SideBarView.NEW_CHAT)}>
                <Icons.Plus className={`w-6 h-6 ${currentView === SideBarView.NEW_CHAT ? 'text-[#00a884]' : ''}`} />
            </button>
            <button title="Settings" onClick={() => onChangeView(SideBarView.SETTINGS)}>
                <Icons.Settings className={`w-6 h-6 ${currentView === SideBarView.SETTINGS ? 'text-[#00a884]' : ''}`} />
            </button>
            <Icons.Menu className="w-6 h-6 cursor-pointer" />
        </div>
    </div>
  );

  const [isEditingName, setIsEditingName] = React.useState(false);
  const [isEditingStatus, setIsEditingStatus] = React.useState(false);
  const [editName, setEditName] = React.useState(currentUser.name);
  const [editStatus, setEditStatus] = React.useState(currentUser.status || 'At WhatsApp');

  const handleProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              onUpdateProfile({ photo: reader.result as string });
          };
          reader.readAsDataURL(file);
      }
  };

  const renderContent = () => {
    if (currentView === SideBarView.SETTINGS) {
        return (
            <div className="text-[#e9edef] h-full flex flex-col bg-[#111b21]">
                <div className="h-[108px] bg-wa-header flex items-end px-6 pb-4 shrink-0">
                    <div className="flex items-center gap-6">
                        <button onClick={() => onChangeView(SideBarView.CHATS)} className="text-[#aebac1] hover:text-white">
                            <Icons.Back className="w-6 h-6" />
                        </button>
                        <h2 className="text-xl font-medium">Settings</h2>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="p-4 border-b border-wa-border hover:bg-[#202c33] cursor-pointer flex items-center gap-4" onClick={() => onChangeView(SideBarView.PROFILE)}>
                        <img src={currentUser.avatar} className="w-[82px] h-[82px] rounded-full object-cover" />
                        <div>
                            <p className="text-lg">{currentUser.name}</p>
                            <p className="text-[#8696a0] text-sm">{currentUser.status || 'At WhatsApp'}</p>
                        </div>
                    </div>

                    <div className="mt-2">
                        <div className="px-6 py-4 flex items-center gap-6 hover:bg-[#202c33] cursor-pointer">
                            <Icons.Shield className="w-5 h-5 text-[#8696a0]" />
                            <div className="flex-1 border-b border-wa-border pb-4">
                                <p className="text-base">Privacy</p>
                            </div>
                        </div>

                        <div className="px-6 py-4 space-y-6">
                            <h3 className="text-[#00a884] font-medium text-sm">Who can see my personal info</h3>

                            {['last', 'photo', 'status'].map((type) => (
                                <div key={type} className="flex flex-col gap-1">
                                    <p className="capitalize">{type === 'last' ? 'Last Seen' : type === 'photo' ? 'Profile Photo' : 'Status'}</p>
                                    <select
                                        value={privacySettings?.[type] || 'all'}
                                        onChange={(e) => onUpdatePrivacy?.(type, e.target.value)}
                                        className="bg-transparent border-b border-[#8696a0]/30 py-1 focus:outline-none text-[#aebac1]"
                                    >
                                        <option value="all">Everyone</option>
                                        <option value="contacts">My Contacts</option>
                                        <option value="none">Nobody</option>
                                    </select>
                                </div>
                            ))}

                            <div className="flex items-center justify-between">
                                <div>
                                    <p>Read receipts</p>
                                    <p className="text-[#8696a0] text-xs">If turned off, you won't send or receive Read receipts.</p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={privacySettings?.readreceipts === 'all'}
                                    onChange={(e) => onUpdatePrivacy?.('readreceipts', e.target.checked ? 'all' : 'none')}
                                    className="accent-[#00a884] w-5 h-5"
                                />
                            </div>
                        </div>

                        <div className="px-6 py-4 flex items-center gap-6 hover:bg-[#202c33] cursor-pointer text-[#ea5455]">
                            <Icons.Logout className="w-5 h-5" />
                            <div className="flex-1 pb-4">
                                <p className="text-base">Log out</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (currentView === SideBarView.PROFILE) {
        return (
            <div className="text-[#e9edef] h-full flex flex-col bg-[#111b21]">
                <div className="h-[108px] bg-wa-header flex items-end px-6 pb-4 shrink-0">
                    <div className="flex items-center gap-6">
                        <button onClick={() => onChangeView(SideBarView.CHATS)} className="text-[#aebac1] hover:text-white">
                            <Icons.Back className="w-6 h-6" />
                        </button>
                        <h2 className="text-xl font-medium">Profile</h2>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="flex flex-col items-center py-7">
                        <div className="relative group cursor-pointer" onClick={() => profilePicInputRef.current?.click()}>
                            <img
                                src={currentUser.avatar}
                                className="w-[200px] h-[200px] rounded-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Icons.Image className="w-10 h-10 text-white mb-2" />
                                <span className="text-white text-xs uppercase text-center font-medium">Change Profile<br/>Photo</span>
                            </div>
                            <input type="file" ref={profilePicInputRef} hidden accept="image/*" onChange={handleProfilePicChange} />
                        </div>
                    </div>

                    <div className="bg-[#111b21] px-7 py-4">
                        <p className="text-[#00a884] text-sm mb-4">Your name</p>
                        <div className="flex items-center justify-between border-b border-transparent hover:border-[#8696a0]/30 pb-2 transition-colors">
                            {isEditingName ? (
                                <input
                                    autoFocus
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    onBlur={() => {
                                        setIsEditingName(false);
                                        onUpdateProfile({ name: editName });
                                    }}
                                    onKeyDown={e => e.key === 'Enter' && setIsEditingName(false)}
                                    className="bg-transparent text-lg w-full focus:outline-none"
                                />
                            ) : (
                                <span className="text-lg">{currentUser.name}</span>
                            )}
                            <button onClick={() => setIsEditingName(!isEditingName)} className="text-[#aebac1]">
                                <Icons.Edit className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-[#8696a0] text-sm mt-3">This is not your username or pin. This name will be visible to your WhatsApp contacts.</p>
                    </div>

                    <div className="bg-[#111b21] px-7 py-4 mt-2">
                        <p className="text-[#00a884] text-sm mb-4">About</p>
                        <div className="flex items-center justify-between border-b border-transparent hover:border-[#8696a0]/30 pb-2 transition-colors">
                            {isEditingStatus ? (
                                <input
                                    autoFocus
                                    value={editStatus}
                                    onChange={e => setEditStatus(e.target.value)}
                                    onBlur={() => {
                                        setIsEditingStatus(false);
                                        onUpdateProfile({ status: editStatus });
                                    }}
                                    onKeyDown={e => e.key === 'Enter' && setIsEditingStatus(false)}
                                    className="bg-transparent text-lg w-full focus:outline-none"
                                />
                            ) : (
                                <span className="text-lg">{currentUser.status || 'At WhatsApp'}</span>
                            )}
                            <button onClick={() => setIsEditingStatus(!isEditingStatus)} className="text-[#aebac1]">
                                <Icons.Edit className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (currentView === SideBarView.NEW_CHAT) {
        return (
            <div className="text-[#e9edef] h-full flex flex-col">
                <div className="h-[108px] bg-wa-header flex items-end px-6 pb-4 shrink-0">
                    <div className="flex items-center gap-6">
                        <button onClick={() => onChangeView(SideBarView.CHATS)} className="text-[#aebac1] hover:text-white">
                            <Icons.Back className="w-6 h-6" />
                        </button>
                        <h2 className="text-xl font-medium">New Chat</h2>
                    </div>
                </div>

                <div className="p-4 bg-[#111b21] shrink-0">
                    <div className="bg-[#202c33] rounded-lg p-3 flex flex-col gap-4">
                        <p className="text-sm text-[#8696a0]">Enter the phone number with country code to start a chat.</p>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newChatPhone}
                                onChange={(e) => setNewChatPhone(e.target.value)}
                                placeholder="e.g. 5491122334455"
                                className="flex-1 bg-transparent border-b border-[#00a884] text-[#e9edef] py-1 focus:outline-none placeholder-[#8696a0]"
                            />
                            <button
                                onClick={() => {
                                    if (newChatPhone.trim()) {
                                        onNewChat(newChatPhone);
                                        setNewChatPhone('');
                                    }
                                }}
                                className="bg-[#00a884] text-[#111b21] px-4 py-1 rounded font-medium hover:bg-[#009677] transition-colors"
                            >
                                Chat
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="px-6 py-4 text-[#00a884] text-sm uppercase font-medium">Contacts on WhatsApp</div>
                    {contacts.filter(c => !c.id.includes('@g.us')).map(contact => (
                        <div
                            key={contact.id}
                            onClick={() => onNewChat(contact.id)}
                            className="flex items-center px-6 py-3 cursor-pointer hover:bg-[#202c33] transition-colors"
                        >
                            <img src={contact.avatar} className="w-12 h-12 rounded-full object-cover" />
                            <div className="ml-4 border-b border-wa-border flex-1 pb-3">
                                <p className="text-[#e9edef] text-lg font-normal">{contact.name}</p>
                                <p className="text-[#8696a0] text-sm truncate">{contact.id.split('@')[0]}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    if (currentView === SideBarView.STATUS) {
        return (
            <div className="p-4 text-[#e9edef]">
                <h2 className="text-xl font-light mb-4">Status</h2>
                <div className="flex items-center gap-4 cursor-pointer mb-6" onClick={() => statusInputRef.current?.click()}>
                    <div className="relative">
                        <img src={currentUser.avatar || 'https://via.placeholder.com/50'} className="w-10 h-10 rounded-full opacity-50" />
                        <div className="absolute bottom-0 right-0 bg-[#00a884] rounded-full p-0.5"><Icons.Plus className="w-3 h-3 text-white"/></div>
                        <input type="file" ref={statusInputRef} hidden accept="image/*,video/*" onChange={handleStatusFile} />
                    </div>
                    <div>
                        <p>My Status</p>
                        <p className="text-xs text-[#8696a0]">Click to add status update</p>
                    </div>
                </div>
                <div className="text-[#8696a0] text-sm uppercase font-medium mb-4">Recent updates</div>
                {Object.entries(statusUpdates).map(([jid, statuses]) => {
                    const latest = statuses[0];
                    return (
                        <div key={jid} className="flex items-center gap-4 py-3 cursor-pointer" onClick={() => onViewStatus(statuses)}>
                            <div className="w-10 h-10 rounded-full border-2 border-[#00a884] p-0.5 overflow-hidden">
                                {latest.type === 'video' ? (
                                    <video src={latest.mediaUrl} className="w-full h-full object-cover" />
                                ) : latest.mediaUrl ? (
                                    <img src={latest.mediaUrl} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-wa-outgoing flex items-center justify-center text-[8px] text-center p-0.5">
                                        {latest.text}
                                    </div>
                                )}
                            </div>
                            <div>
                                <p className="text-[#e9edef]">{latest.pushName || jid.split('@')[0]}</p>
                                <p className="text-xs text-[#8696a0]">{format(latest.timestamp, 'HH:mm')}</p>
                            </div>
                        </div>
                    );
                })}
            </div>
        )
    }

    return (
      <>
        <div className="px-3 py-2 border-b border-wa-border">
            <div className="bg-[#202c33] rounded-lg h-9 flex items-center px-3 gap-3">
                <Icons.Search className="w-4 h-4 text-[#8696a0] min-w-[16px]" />
                <input 
                    type="text" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search or start new chat" 
                    className="bg-transparent text-[#d1d7db] text-sm w-full focus:outline-none placeholder-[#8696a0]"
                />
            </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
            {chats.filter(c =>
                c.contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.id.includes(searchTerm)
            ).map((chat) => {
                const lastMsg = chat.messages[chat.messages.length - 1];
                return (
                    <div 
                        key={chat.id}
                        onClick={() => onSelectChat(chat.id)}
                        className={`
                            flex items-center px-3 py-3 cursor-pointer transition-colors group
                            ${activeChatId === chat.id ? 'bg-[#2a3942]' : 'hover:bg-[#202c33]'}
                        `}
                    >
                        <div className="relative">
                            <img 
                                src={chat.contact.avatar} 
                                alt={chat.contact.name} 
                                className="w-12 h-12 rounded-full object-cover"
                            />
                            {presences[chat.id] && (Object.values(presences[chat.id])[0] as Presence)?.lastKnownPresence === 'available' && (
                                <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#00a884] rounded-full border-2 border-[#111b21]"></div>
                            )}
                        </div>
                        
                        <div className="flex-1 ml-3 border-b border-wa-border pb-3 flex flex-col justify-center h-full min-w-0">
                            <div className="flex items-center justify-between">
                                <span className="text-[#e9edef] text-[17px] leading-tight truncate font-normal">
                                    {chat.contact.name}
                                </span>
                                <span className={`text-xs ${chat.unreadCount > 0 ? 'text-[#00a884] font-medium' : 'text-[#8696a0]'}`}>
                                    {lastMsg ? format(lastMsg.timestamp, 'HH:mm') : ''}
                                </span>
                            </div>
                            
                            <div className="flex items-center justify-between mt-1">
                                <div className="flex items-center gap-1 overflow-hidden">
                                    {lastMsg?.senderId === 'me' && (
                                        <span className={`${lastMsg.status === 'read' ? 'text-[#53bdeb]' : 'text-[#8696a0]'}`}>
                                            <Icons.DoubleCheck className="w-4 h-4" />
                                        </span>
                                    )}
                                    <span className="text-[#8696a0] text-sm truncate">
                                        {lastMsg?.type === 'image' && <Icons.Image className="inline w-3 h-3 mr-1" />}
                                        {lastMsg?.type === 'video' && <Icons.Video className="inline w-3 h-3 mr-1" />}
                                        {lastMsg?.type === 'audio' && <Icons.Mic className="inline w-3 h-3 mr-1" />}
                                        {lastMsg?.text}
                                    </span>
                                </div>
                                
                                {chat.unreadCount > 0 && (
                                    <div className="min-w-[20px] h-5 rounded-full bg-[#00a884] flex items-center justify-center text-[#111b21] text-xs font-bold px-1 ml-2">
                                        {chat.unreadCount}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
      </>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#111b21] border-r border-wa-border">
      {renderHeader()}
      {renderContent()}
    </div>
  );
};