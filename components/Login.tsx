import React from 'react';
import { Icons } from './Icons';

interface LoginProps {
  qrCode: string | null;
  status: string;
  pairingCode?: string | null;
  onRequestPairing?: (phone: string) => void;
}

export const Login: React.FC<LoginProps> = ({ qrCode, status, pairingCode, onRequestPairing }) => {
  const [phone, setPhone] = React.useState('');
  const [showPairing, setShowPairing] = React.useState(false);

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
        <div className="z-10 bg-white md:rounded-lg shadow-lg flex flex-col md:flex-row w-full md:w-[90%] max-w-[1000px] h-full md:h-auto md:min-h-[70vh] md:mt-12 overflow-y-auto md:overflow-hidden text-gray-800">
            <div className="p-8 md:p-12 flex-1 flex flex-col justify-between hidden md:flex">
                <div>
                    <h1 className="text-2xl md:text-3xl font-light mb-6 md:mb-10 text-[#41525d]">Use WhatsApp on your computer</h1>
                    <ol className="list-decimal pl-6 space-y-4 text-lg text-[#3b4a54]">
                        <li>Open WhatsApp on your phone</li>
                        <li>Tap <strong>Menu</strong> <Icons.Menu className="inline w-4 h-4"/> or <strong>Settings</strong> and select <strong>Linked Devices</strong></li>
                        <li>Tap on <strong>Link a Device</strong></li>
                        <li>Point your phone to this screen to capture the code</li>
                    </ol>
                </div>
                {!showPairing ? (
                    <div 
                        className="text-[#00a884] font-medium mt-8 hover:underline cursor-pointer"
                        onClick={() => setShowPairing(true)}
                    >
                        Link with phone number
                    </div>
                ) : (
                    <div 
                        className="text-[#00a884] font-medium mt-8 hover:underline cursor-pointer"
                        onClick={() => setShowPairing(false)}
                    >
                        Use QR Code instead
                    </div>
                )}
            </div>
            
            <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 border-l border-gray-100 min-h-[500px]">
                <div className="relative w-full flex flex-col items-center">
                    {!showPairing ? (
                        <div className="flex md:hidden text-[#00a884] font-medium mb-6 hover:underline cursor-pointer" onClick={() => setShowPairing(true)}>
                            Link with phone number
                        </div>
                    ) : (
                        <div className="flex md:hidden text-[#00a884] font-medium mb-6 hover:underline cursor-pointer" onClick={() => setShowPairing(false)}>
                            Use QR Code instead
                        </div>
                    )}

                    {showPairing ? (
                        <div className="w-full max-w-xs md:w-64 h-64 flex flex-col items-center justify-center bg-gray-50 border border-gray-200 p-4 rounded-lg">
                            {pairingCode ? (
                                <div className="text-center">
                                    <p className="text-xs text-gray-500 mb-2 uppercase tracking-widest">Your Pairing Code</p>
                                    <div className="flex gap-1 justify-center">
                                        {pairingCode.split('').map((char, i) => (
                                            <span key={i} className="text-2xl font-mono font-bold border-b-2 border-[#00a884] px-1">{char}</span>
                                        ))}
                                    </div>
                                    <p className="mt-4 text-[10px] text-gray-400">Enter this code on your phone</p>
                                </div>
                            ) : (
                                <div className="w-full">
                                    <p className="text-xs text-gray-500 mb-2">Enter phone number with country code</p>
                                    <input 
                                        type="text" 
                                        placeholder="e.g. 1234567890" 
                                        className="w-full p-2 border rounded mb-3 text-sm outline-none focus:border-[#00a884]"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                    />
                                    <button 
                                        className="w-full bg-[#00a884] text-white p-2 rounded text-sm font-medium hover:bg-[#009677] transition-colors"
                                        onClick={() => onRequestPairing?.(phone)}
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            {qrCode ? (
                                <img 
                                    src={qrCode} 
                                    alt="Scan QR Code" 
                                    className="w-full max-w-[256px] aspect-square border-4 border-white shadow-sm"
                                />
                            ) : (
                                <div className="w-full max-w-[256px] aspect-square flex items-center justify-center bg-gray-100 border border-gray-200">
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
                        </>
                    )}
                   
                    {qrCode && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/90 pointer-events-none" style={{ opacity: 0, animation: 'pulse 1.5s infinite' }}>
                           <div className="bg-[#00a884] rounded-full p-4 shadow-xl">
                                <Icons.Chat className="w-8 h-8 text-white" />
                           </div>
                        </div>
                    )}
                </div>
                <p className={`mt-6 text-sm font-medium ${status.startsWith('Error') ? 'text-red-500' : 'text-[#41525d]'}`}>
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