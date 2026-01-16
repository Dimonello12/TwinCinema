import React, { useState } from 'react';
import { Film, Crown, Hash, Check, Copy } from 'lucide-react';

interface HeaderProps {
    isHost?: boolean;
    partyCode?: string;
}

export const Header: React.FC<HeaderProps> = ({ isHost, partyCode }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (partyCode) {
      navigator.clipboard.writeText(partyCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <header className="h-16 bg-[#2f3136] border-b border-[#202225] flex items-center px-4 justify-between shrink-0 shadow-md z-10">
      <div className="flex items-center gap-2">
        <div className="bg-[#5865F2] p-2 rounded-lg">
           <Film className="text-white" size={20} />
        </div>
        <div>
          <h1 className="font-bold text-white tracking-wide hidden sm:block">TwinCinema</h1>
          <p className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">HLS Sync Activity</p>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        {/* Party Code Chip */}
        {partyCode && (
            <div 
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1 bg-[#202225] hover:bg-[#292b2f] border border-[#2f3136] rounded-full cursor-pointer transition-colors group"
              title="Click to copy Party Code"
            >
                <Hash size={14} className="text-gray-400 group-hover:text-white" />
                <span className="text-xs font-mono font-medium text-gray-300 group-hover:text-white select-all">{partyCode}</span>
                {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} className="text-gray-500 group-hover:text-white opacity-0 group-hover:opacity-100 transition-opacity" />}
            </div>
        )}

        {isHost && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-full">
                <Crown size={14} className="text-yellow-500" />
                <span className="text-xs font-bold text-yellow-500">HOST</span>
            </div>
        )}
        <div className="flex items-center gap-1.5 px-3 py-1 bg-[#202225] rounded-full hidden sm:flex">
           <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
           <span className="text-xs font-medium text-gray-300">Connected</span>
        </div>
      </div>
    </header>
  );
};