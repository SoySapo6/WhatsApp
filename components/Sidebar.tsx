import React, { useRef } from 'react';
import { ChatSession, User, SideBarView, Presence } from '../types';
import { Icons } from './Icons';
import { format } from 'date-fns';

interface SidebarProps {
  currentUser: User;
  chats: ChatSession[];
  statusUpdates: any[];
  activeChatId: string | null;
  presences: Record<string, any>;
  currentView: SideBarView;
  onSelectChat: (id: string) => void;
  onChangeView: (view: SideBarView) => void;
  onUploadStatus: (file: string, type: 'image'|'video') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentUser, chats, statusUpdates, activeChatId, presences, currentView, onSelectChat, onChangeView, onUploadStatus }) => {
  const statusInputRef = useRef<HTMLInputElement>(null);

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
            className="w-10 h-10 rounded-full cursor-pointer hover:opacity-80 transition-opacity"
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
             <button title="New Chat" onClick={() => onChangeView(SideBarView.CHATS)}>
                <Icons.Plus className="w-6 h-6" />
            </button>
            <Icons.Menu className="w-6 h-6 cursor-pointer" />
        </div>
    </div>
  );

  const renderContent = () => {
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
                {statusUpdates.map((status, i) => (
                    <div key={i} className="flex items-center gap-4 py-3 cursor-pointer">
                        <div className="w-10 h-10 rounded-full border-2 border-[#00a884] p-0.5 overflow-hidden">
                            {status.type === 'video' ? (
                                <video src={status.mediaUrl} className="w-full h-full object-cover" />
                            ) : (
                                <img src={status.mediaUrl || 'https://via.placeholder.com/50'} className="w-full h-full object-cover" />
                            )}
                        </div>
                        <div>
                             <p className="text-[#e9edef]">{status.pushName || 'Unknown User'}</p>
                             <p className="text-xs text-[#8696a0]">{format(status.timestamp, 'HH:mm')}</p>
                        </div>
                    </div>
                ))}
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
                    placeholder="Search or start new chat" 
                    className="bg-transparent text-[#d1d7db] text-sm w-full focus:outline-none placeholder-[#8696a0]"
                />
            </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
            {chats.map((chat) => {
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