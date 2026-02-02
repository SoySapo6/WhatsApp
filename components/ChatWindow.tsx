import React, { useState, useEffect, useRef } from 'react';
import { ChatSession } from '../types';
import { Icons } from './Icons';
import { MessageBubble } from './MessageBubble';

interface ChatWindowProps {
  chat: ChatSession;
  onBack: () => void;
  onSendMessage: (chatId: string, text: string) => void;
  onSendImage: (chatId: string, base64: string, caption: string, type: 'image' | 'video') => void;
  onSendAudio: (chatId: string, base64: string) => void;
  onOpenInfo: () => void;
  onCall: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ chat, onBack, onSendMessage, onSendImage, onSendAudio, onOpenInfo, onCall }) => {
  const [inputText, setInputText] = useState('');
  const [showAttach, setShowAttach] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chat.messages]);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    onSendMessage(chat.id, inputText);
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result as string;
            const type = file.type.startsWith('video') ? 'video' : 'image';
            onSendImage(chat.id, base64, "", type);
            setShowAttach(false);
        };
        reader.readAsDataURL(file);
    }
  };

  const startRecording = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunksRef.current.push(event.data);
            }
        };

        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/ogg' });
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = () => {
                const base64 = reader.result as string;
                onSendAudio(chat.id, base64);
            };
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
    } catch (err) {
        console.error("Error accessing microphone:", err);
    }
  };

  const stopRecording = () => {
      if (mediaRecorderRef.current && isRecording) {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
      }
  };

  return (
    <div className="flex flex-col h-full bg-[#0b141a] relative">
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none" 
           style={{ backgroundImage: `url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")` }}>
      </div>

      <div className="h-16 bg-wa-header px-4 flex items-center justify-between shrink-0 z-10 border-l border-wa-border">
        <div className="flex items-center gap-4 cursor-pointer" onClick={onOpenInfo}>
            <button onClick={(e) => { e.stopPropagation(); onBack(); }} className="md:hidden text-[#aebac1]">
                <Icons.Back className="w-6 h-6" />
            </button>
            <img 
                src={chat.contact.avatar || 'https://via.placeholder.com/50'} 
                alt={chat.contact.name} 
                className="w-10 h-10 rounded-full object-cover"
            />
            <div className="flex flex-col justify-center">
                <span className="text-[#e9edef] text-base leading-tight">{chat.contact.name}</span>
                <span className="text-[#8696a0] text-xs mt-0.5">
                    {chat.presence === 'composing' ? 'typing...' : (chat.contact.status || 'click for info')}
                </span>
            </div>
        </div>
        <div className="flex items-center gap-6 text-[#aebac1]">
            <Icons.Video className="w-5 h-5 cursor-pointer hover:text-white transition-colors" onClick={onCall} />
            <Icons.Phone className="w-5 h-5 cursor-pointer hover:text-white transition-colors" onClick={onCall} />
            <div className="w-[1px] h-6 bg-[#8696a0]/30 mx-1"></div>
            <Icons.Search className="w-5 h-5 cursor-pointer hover:text-white transition-colors" />
            <Icons.Menu className="w-5 h-5 cursor-pointer hover:text-white transition-colors" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 z-10 flex flex-col gap-2 custom-scrollbar">
        {chat.messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} isMe={msg.key.fromMe || msg.senderId === 'me'} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="min-h-[62px] bg-wa-header px-4 py-2 flex items-end gap-3 shrink-0 z-10 border-l border-wa-border relative">
        {showAttach && (
            <div className="absolute bottom-16 left-2 bg-[#233138] rounded-xl py-2 shadow-lg flex flex-col gap-2 p-4">
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-3 p-2 hover:bg-[#182229] rounded-lg text-[#e9edef]">
                    <Icons.Image className="w-6 h-6 text-[#ac44cf]" />
                    <span>Photos & Videos</span>
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileSelect} />
            </div>
        )}

        <div className="pb-3 text-[#8696a0] cursor-pointer hover:text-white">
            <Icons.Emoji className="w-6 h-6" />
        </div>
        <div className="pb-3 text-[#8696a0] cursor-pointer hover:text-white" onClick={() => setShowAttach(!showAttach)}>
            <Icons.Attach className="w-6 h-6 transform -rotate-45" />
        </div>
        
        <div className="flex-1 bg-wa-dark-lighter rounded-lg flex items-center min-h-[42px] mb-1.5">
            <input 
                type="text" 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message"
                className="w-full bg-transparent text-[#e9edef] px-4 py-2 focus:outline-none placeholder-[#8696a0] text-[15px]"
            />
        </div>

        <div className="pb-3 text-[#8696a0] cursor-pointer hover:text-white">
            {inputText.length > 0 ? (
                <button onClick={handleSend} className="text-[#00a884]">
                    <Icons.Send className="w-6 h-6" />
                </button>
            ) : (
                <button 
                    onMouseDown={startRecording} 
                    onMouseUp={stopRecording}
                    onMouseLeave={stopRecording}
                    className={`${isRecording ? 'text-red-500 animate-pulse' : ''}`}
                >
                    <Icons.Mic className="w-6 h-6" />
                </button>
            )}
        </div>
      </div>
    </div>
  );
};