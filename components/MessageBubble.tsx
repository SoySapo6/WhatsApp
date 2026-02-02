import React from 'react';
import { format } from 'date-fns';
import { Icons } from './Icons';
import { Message } from '../types';

interface MessageBubbleProps {
  message: Message;
  isMe: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isMe }) => {
  return (
    <div className={`flex w-full mb-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
      <div 
        className={`
            relative max-w-[65%] rounded-lg px-1 py-1 shadow-sm text-[14.2px] leading-[19px]
            ${isMe ? 'bg-wa-outgoing rounded-tr-none' : 'bg-wa-incoming rounded-tl-none'}
        `}
      >
        <div className={`absolute top-0 w-3 h-3 ${isMe ? '-right-2 bg-wa-outgoing' : '-left-2 bg-wa-incoming'}`} 
             style={{ 
                 clipPath: isMe ? 'polygon(0 0, 100% 0, 0 100%)' : 'polygon(0 0, 100% 0, 100% 100%)' 
             }} 
        />
        
        <div className="flex flex-col">
            {message.type === 'image' && message.mediaUrl && (
                <div className="p-1 pb-0">
                    <img src={message.mediaUrl} alt="Sent media" className="rounded-lg max-w-full max-h-[300px] object-cover" />
                </div>
            )}

            {message.type === 'video' && message.mediaUrl && (
                <div className="p-1 pb-0">
                    <video src={message.mediaUrl} controls className="rounded-lg max-w-full max-h-[300px]" />
                </div>
            )}

            {message.type === 'audio' && message.mediaUrl && (
                <div className="p-2 pb-0 min-w-[200px] flex items-center gap-2">
                    <Icons.Mic className={`w-6 h-6 ${isMe ? 'text-white' : 'text-[#8696a0]'}`} />
                    <audio src={message.mediaUrl} controls className="h-8 w-full max-w-[200px]" />
                </div>
            )}
            
            {(message.text || (!message.mediaUrl && message.type === 'text')) && (
                <div className="px-2 pt-1 pb-4 text-[#e9edef] min-w-[80px]">
                    {message.text}
                </div>
            )}
            
            <div className="absolute bottom-1 right-2 flex items-center gap-1">
                <span className="text-[11px] text-[#8696a0]">
                    {format(message.timestamp, 'HH:mm')}
                </span>
                {isMe && (
                    <span className={`${message.status === 'read' ? 'text-[#53bdeb]' : 'text-[#8696a0]'}`}>
                        {message.status === 'read' ? <Icons.DoubleCheck className="w-4 h-4" /> : <Icons.Check className="w-4 h-4" />}
                    </span>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};