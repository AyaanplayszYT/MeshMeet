
import React, { useState, useEffect } from 'react';
import { Copy, Check, MicOff, VideoOff } from 'lucide-react';
import { signaling } from '../services/socket';

interface DynamicIslandProps {
  roomId: string;
  participantCount: number;
  isMuted: boolean;
  isVideoStopped: boolean;
}

const DynamicIsland: React.FC<DynamicIslandProps> = ({
  roomId,
  participantCount,
  isMuted,
  isVideoStopped
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [timer, setTimer] = useState(0);
  const [ping, setPing] = useState(0);
  const [packetLoss, setPacketLoss] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTimer(t => t + 1), 1000);
    
    // Ping/Latency Check
    const pingInterval = setInterval(async () => {
        const latency = await signaling.getLatency();
        setPing(latency);

        // Simulate packet loss based on latency for visual feedback
        let loss = 0;
        if (latency > 150) loss = Number((Math.random() * 0.5).toFixed(1));
        if (latency > 300) loss = Number((Math.random() * 2 + 1).toFixed(1));
        if (latency < 0) loss = 0; 
        setPacketLoss(loss);
    }, 2000);

    return () => {
        clearInterval(interval);
        clearInterval(pingInterval);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const copyRoomId = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getQualityColor = (p: number) => {
      if (p < 0) return 'text-zinc-500';
      if (p < 100) return 'text-green-500';
      if (p < 250) return 'text-yellow-500';
      return 'text-red-500';
  };

  const getSignalBars = (p: number) => {
      // 4 bars visual logic
      const strength = p < 0 ? 0 : p < 100 ? 4 : p < 250 ? 3 : p < 400 ? 2 : 1;
      const colorClass = getQualityColor(p).replace('text-', 'bg-');
      
      return (
          <div className="flex items-end gap-0.5 h-3">
              {[1, 2, 3, 4].map(bar => (
                  <div 
                    key={bar} 
                    className={`w-1 rounded-sm transition-all duration-300 ${bar <= strength ? colorClass : 'bg-zinc-800'} ${bar === 1 ? 'h-1' : bar === 2 ? 'h-1.5' : bar === 3 ? 'h-2.5' : 'h-3'}`}
                  />
              ))}
          </div>
      );
  };

  return (
    <div
      className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 flex justify-center"
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div
        className={`
          relative bg-zinc-950/70 backdrop-blur-3xl border border-white/15 ring-1 ring-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.6),inset_0_1px_1px_0_rgba(255,255,255,0.15)] rounded-full
          transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] overflow-hidden
          ${isExpanded ? 'w-[520px] h-[64px]' : 'w-[120px] h-[32px]'}
        `}
      >
        {/* Collapsed State */}
        <div 
          className={`absolute inset-0 flex items-center justify-center gap-2 transition-all duration-300
            ${isExpanded ? 'opacity-0 scale-90 blur-sm pointer-events-none' : 'opacity-100 scale-100 blur-0'}
          `}
        >
          {/* Mini Status Dot */}
          <div className={`w-2 h-2 rounded-full bg-green-500`} />
          <span className="text-[10px] font-bold text-zinc-300 font-mono tracking-wider">{formatTime(timer)}</span>
        </div>

        {/* Expanded State */}
        <div 
          className={`absolute inset-0 flex items-center justify-between px-6 transition-all duration-500 delay-75
            ${isExpanded ? 'opacity-100 scale-100 blur-0' : 'opacity-0 scale-110 blur-md pointer-events-none'}
          `}
        >
           {/* Left: Time */}
           <div className="flex items-center gap-3 min-w-[100px]">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-zinc-900/50 border-zinc-800">
                  <span className="text-xs font-mono text-zinc-300">{formatTime(timer)}</span>
              </div>
           </div>

           {/* Center: Room Code */}
           <div 
             onClick={copyRoomId}
             className="flex flex-col items-center cursor-pointer group px-4 py-1 rounded-xl hover:bg-white/5 transition-colors"
           >
              <div className="flex items-center gap-2">
                 <span className="text-sm font-semibold text-white tracking-wide font-mono group-hover:text-blue-400 transition-colors">{roomId}</span>
                 {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-zinc-600 group-hover:text-blue-400" />}
              </div>
              <span className="text-[9px] text-zinc-600 uppercase tracking-widest font-bold">Room Code</span>
           </div>

           {/* Right: Network Stats & Participants */}
           <div className="flex items-center gap-4 min-w-[100px] justify-end">
             
             {/* Connection Quality Block */}
             <div className="flex flex-col items-end">
                 <div className="flex items-center gap-2">
                     <span className={`text-[10px] font-bold uppercase ${getQualityColor(ping)}`}>
                         {ping < 100 ? 'Excellent' : ping < 250 ? 'Good' : 'Weak'}
                     </span>
                     {getSignalBars(ping)}
                 </div>
                 <div className="flex items-center gap-2 text-[9px] font-mono text-zinc-500">
                     <span title="Latency">{ping}ms</span>
                     <span className="text-zinc-700">|</span>
                     <span title="Est. Packet Loss">{packetLoss}% loss</span>
                 </div>
             </div>

             <div className="w-px h-6 bg-zinc-800" />

             <div className="flex -space-x-2">
                 {isMuted && <div className="w-7 h-7 rounded-full bg-zinc-900 border border-black flex items-center justify-center"><MicOff className="w-3.5 h-3.5 text-red-400"/></div>}
                 {isVideoStopped && <div className="w-7 h-7 rounded-full bg-zinc-900 border border-black flex items-center justify-center"><VideoOff className="w-3.5 h-3.5 text-red-400"/></div>}
                 <div className="w-7 h-7 rounded-full bg-zinc-900 border border-black flex items-center justify-center text-[10px] text-zinc-400 font-bold">
                    {participantCount}
                 </div>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default DynamicIsland;
