import React from 'react';
import { Icons } from './Icons';

interface LoginProps {
  qrCode: string | null;
  status: string;
}

export const Login: React.FC<LoginProps> = ({ qrCode, status }) => {
  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-[#111b21] text-[#e9edef] relative overflow-hidden">
        {/* Green Header Strip */}
        <div className="absolute top-0 w-full h-56 bg-[#00a884] z-0">
            <div className="max-w-[1000px] mx-auto p-5 flex items-center gap-3 text-white">
                <div className="flex items-center gap-2 font-semibold uppercase tracking-wider text-sm">
                    <Icons.Chat className="w-6 h-6" /> WhatsApp Web
                </div>
            </div>
        </div>

        {/* White Card */}
        <div className="z-10 bg-white rounded-lg shadow-lg flex w-[90%] max-w-[1000px] h-[70vh] mt-24 overflow-hidden text-gray-800">
            <div className="p-12 flex-1 flex flex-col justify-between hidden md:flex">
                <div>
                    <h1 className="text-3xl font-light mb-10 text-[#41525d]">Use WhatsApp on your computer</h1>
                    <ol className="list-decimal pl-6 space-y-4 text-lg text-[#3b4a54]">
                        <li>Open WhatsApp on your phone</li>
                        <li>Tap <strong>Menu</strong> <Icons.Menu className="inline w-4 h-4"/> or <strong>Settings</strong> and select <strong>Linked Devices</strong></li>
                        <li>Tap on <strong>Link a Device</strong></li>
                        <li>Point your phone to this screen to capture the code</li>
                    </ol>
                </div>
                <div className="text-[#00a884] font-medium mt-8 hover:underline cursor-pointer">
                    Link with phone number
                </div>
            </div>
            
            <div className="flex-1 flex flex-col items-center justify-center p-12 border-l border-gray-100">
                <div className="relative">
                    {qrCode ? (
                         <img 
                            src={qrCode} 
                            alt="Scan QR Code" 
                            className="w-64 h-64 border-4 border-white shadow-sm"
                        />
                    ) : (
                        <div className="w-64 h-64 flex items-center justify-center bg-gray-100 border border-gray-200">
                            {status === 'Connected to server' ? (
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#00a884]"></div>
                            ) : (
                                <div className="text-center text-gray-500 px-4">
                                    <p className="mb-2 font-bold text-red-500">Backend Disconnected</p>
                                    <p className="text-xs">Run 'node server.js' locally</p>
                                </div>
                            )}
                        </div>
                    )}
                   
                    {qrCode && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/90 pointer-events-none" style={{ opacity: 0, animation: 'pulse 1.5s infinite' }}>
                           <div className="bg-[#00a884] rounded-full p-4 shadow-xl">
                                <Icons.Chat className="w-8 h-8 text-white" />
                           </div>
                        </div>
                    )}
                </div>
                <p className="mt-6 text-[#41525d] text-sm font-medium">
                    {status}
                </p>
                <div className="mt-4 flex items-center gap-2 text-gray-400 text-xs">
                    <input type="checkbox" defaultChecked className="accent-[#00a884]" /> Keep me signed in
                </div>
            </div>
        </div>
    </div>
  );
};