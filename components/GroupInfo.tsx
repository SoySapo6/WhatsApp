import React from 'react';
import { ChatSession, Participant } from '../types';
import { Icons } from './Icons';

interface GroupInfoProps {
  chat: ChatSession;
  onClose: () => void;
  onAction: (action: string, participantId?: string) => void;
  currentUserJid: string;
}

export const GroupInfo: React.FC<GroupInfoProps> = ({ chat, onClose, onAction, currentUserJid }) => {
  const isGroup = chat.id.includes('@g.us');
  const participants = chat.groupMetadata?.participants || [];
  const meAdmin = participants.find(p => p.id === currentUserJid)?.admin;

  return (
    <div className="w-[400px] h-full bg-[#111b21] border-l border-wa-border flex flex-col animate-in slide-in-from-right">
      <div className="h-16 bg-wa-header px-4 flex items-center gap-4 shrink-0">
        <Icons.Close className="w-6 h-6 text-[#aebac1] cursor-pointer" onClick={onClose} />
        <span className="text-[#e9edef] text-base font-medium">{isGroup ? 'Group Info' : 'Contact Info'}</span>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
         <div className="flex flex-col items-center mb-6">
            <img src={chat.contact.avatar || 'https://via.placeholder.com/200'} className="w-48 h-48 rounded-full mb-4 object-cover" />
            <h2 className="text-[#e9edef] text-2xl">{chat.contact.name}</h2>
            <p className="text-[#8696a0] mt-1">{chat.id}</p>
         </div>

         {isGroup && (
             <div className="bg-[#111b21]">
                 <div className="text-[#8696a0] text-sm mb-4">{participants.length} participants</div>
                 <div className="space-y-4">
                     {participants.map(p => {
                         const isAdmin = p.admin === 'admin' || p.admin === 'superadmin';
                         return (
                            <div key={p.id} className="flex items-center justify-between group">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center text-white text-xs">
                                        {p.id.substring(0,2)}
                                    </div>
                                    <div>
                                        <p className="text-[#e9edef] text-sm">{p.id === currentUserJid ? 'You' : p.id.split('@')[0]}</p>
                                        {isAdmin && <span className="text-[#00a884] text-xs border border-[#00a884] px-1 rounded">Group Admin</span>}
                                    </div>
                                </div>
                                {meAdmin && p.id !== currentUserJid && (
                                    <div className="hidden group-hover:flex gap-2">
                                        <button onClick={() => onAction(isAdmin ? 'demote' : 'promote', p.id)} className="text-[#8696a0] hover:text-white text-xs">
                                            {isAdmin ? 'Dismiss' : 'Make Admin'}
                                        </button>
                                        <button onClick={() => onAction('remove', p.id)} className="text-red-500 hover:text-red-400">
                                            <Icons.Trash className="w-4 h-4"/>
                                        </button>
                                    </div>
                                )}
                            </div>
                         )
                     })}
                 </div>
                 
                 <div className="mt-8 border-t border-wa-border pt-4 space-y-4">
                     <button className="flex items-center gap-3 text-red-500 w-full hover:bg-[#202c33] p-2 rounded">
                        <Icons.Logout className="w-5 h-5" />
                        <span>Exit group</span>
                     </button>
                     <button className="flex items-center gap-3 text-red-500 w-full hover:bg-[#202c33] p-2 rounded">
                        <Icons.Shield className="w-5 h-5" />
                        <span>Report group</span>
                     </button>
                 </div>
             </div>
         )}
      </div>
    </div>
  );
};