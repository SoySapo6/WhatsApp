import React, { useEffect, useRef, useState } from 'react';
import { Icons } from './Icons';
import { socket } from '../services/socket';

interface CallModalProps {
  contactName: string;
  contactAvatar: string;
  isVideo: boolean;
  isIncoming: boolean;
  onEndCall: () => void;
  // WebRTC Props
  stream?: MediaStream;
  onAnswer?: () => void;
}

export const CallModal: React.FC<CallModalProps> = ({ 
    contactName, 
    contactAvatar, 
    isVideo, 
    isIncoming,
    onEndCall,
    stream,
    onAnswer
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(!isVideo);
  const [callStatus, setCallStatus] = useState(isIncoming ? "Incoming call..." : "Calling...");

  // Attach streams to video elements
  useEffect(() => {
    if (localVideoRef.current && stream) {
        localVideoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Handle stream tracks toggling
  const toggleMute = () => {
    if (stream) {
        stream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
        setIsMuted(!isMuted);
    }
  };

  const toggleCamera = () => {
    if (stream) {
        stream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
        setIsCameraOff(!isCameraOff);
    }
  };

  // Expose function to set remote stream from parent if needed, 
  // or use the global peer connection logic.
  // For this component, we assume the parent manages the PeerConnection 
  // and we might need to attach the remote stream via ID or prop.
  // To keep it simple, we'll listen for the 'track' event in App.tsx and pass a remoteStream prop,
  // but for now let's visualize the "Active" state.

  return (
    <div className="fixed inset-0 z-50 bg-[#0b141a] flex flex-col items-center justify-center animate-in fade-in duration-300">
        
        {/* Remote Video (Main) */}
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
            {/* If we had a remote stream, it would go here. For now, we show the avatar pulsing if waiting */}
            <div className="absolute inset-0 flex items-center justify-center z-0">
                 {/* Placeholder for remote stream */}
                 <video 
                    ref={remoteVideoRef} 
                    autoPlay 
                    playsInline 
                    className="w-full h-full object-cover hidden" // Hidden until connected
                 />
                 
                 <div className="flex flex-col items-center z-10">
                     <img 
                        src={contactAvatar || 'https://via.placeholder.com/150'} 
                        className="w-32 h-32 rounded-full mb-6 border-4 border-[#25d366] shadow-2xl animate-pulse"
                     />
                     <h2 className="text-[#e9edef] text-3xl font-light mb-2">{contactName}</h2>
                     <p className="text-[#8696a0] text-lg">{callStatus}</p>
                 </div>
            </div>

            {/* Local Video (PiP) */}
            <div className="absolute bottom-24 right-6 w-32 h-48 bg-black rounded-xl border border-gray-800 overflow-hidden shadow-2xl z-20">
                <video 
                    ref={localVideoRef} 
                    autoPlay 
                    muted 
                    playsInline
                    className={`w-full h-full object-cover ${isCameraOff ? 'hidden' : 'block'}`} 
                />
                {isCameraOff && (
                    <div className="w-full h-full flex items-center justify-center bg-[#202c33]">
                        <Icons.Video className="w-8 h-8 text-[#8696a0]" />
                    </div>
                )}
            </div>
        </div>

        {/* Controls Bar */}
        <div className="absolute bottom-0 w-full bg-[#111b21]/90 backdrop-blur-md p-6 flex justify-center items-center gap-8 z-50 border-t border-wa-border">
            
            <button 
                onClick={toggleMute}
                className={`p-4 rounded-full transition-all ${isMuted ? 'bg-white text-black' : 'bg-[#202c33] text-[#e9edef] hover:bg-[#374248]'}`}
            >
                {isMuted ? <div className="relative"><Icons.Mic className="w-6 h-6"/><div className="absolute inset-0 border-l border-black rotate-45 left-1/2"></div></div> : <Icons.Mic className="w-6 h-6"/>}
            </button>
            
            <button 
                onClick={toggleCamera}
                className={`p-4 rounded-full transition-all ${isCameraOff ? 'bg-white text-black' : 'bg-[#202c33] text-[#e9edef] hover:bg-[#374248]'}`}
            >
                {isCameraOff ? <div className="relative"><Icons.Video className="w-6 h-6"/><div className="absolute inset-0 border-l border-black rotate-45 left-1/2"></div></div> : <Icons.Video className="w-6 h-6"/>}
            </button>

            {isIncoming ? (
                <button 
                    onClick={onAnswer}
                    className="p-4 bg-[#00a884] rounded-full text-white hover:bg-[#008f6f] shadow-lg scale-110"
                >
                    <Icons.Phone className="w-8 h-8"/>
                </button>
            ) : null}

            <button 
                onClick={onEndCall}
                className="p-4 bg-red-500 rounded-full text-white hover:bg-red-600 shadow-lg scale-110"
            >
                 <Icons.Phone className="w-8 h-8 transform rotate-[135deg]"/>
            </button>
        </div>
    </div>
  );
};