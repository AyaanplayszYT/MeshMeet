import React, { useState, useEffect } from 'react';
import { Copy, Check, MicOff, VideoOff, Disc, Share2 } from 'lucide-react';
import { signaling } from '../services/socket';
import { sound } from '../services/sound';

interface DynamicIslandProps {
  roomId: string;
  participantCount: number;
  isMuted: boolean;
  isVideoStopped: boolean;
  isRecording?: boolean;
  recordingDuration?: number;
  handRaiseCount?: number;
  onCopyInvite?: () => void;
}

const DynamicIsland: React.FC<DynamicIslandProps> = ({
  roomId,
  participantCount,
  isMuted,
  isVideoStopped,
  isRecording = false,
  recordingDuration = 0,
  handRaiseCount = 0,
  onCopyInvite
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
    if (onCopyInvite) {
      onCopyInvite();
    } else {
      navigator.clipboard.writeText(roomId);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getQualityColor = (p: number) => {
    if (p < 0) return 'text-zinc-500';
    if (p < 100) return 'text-emerald-400';
    if (p < 250) return 'text-amber-400';
    return 'text-rose-400';
  };

  const getSignalBars = (p: number) => {
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
      className="fixed top-3 sm:top-4 left-1/2 transform -translate-x-1/2 z-50 flex justify-center max-w-[calc(100vw-1rem)] pointer-events-auto"
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div
        className={`
          relative max-w-[calc(100vw-1rem)] bg-zinc-950/80 backdrop-blur-3xl border border-white/15 ring-1 ring-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.6),inset_0_1px_1px_0_rgba(255,255,255,0.15)] rounded-full
          transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] overflow-hidden
          ${isExpanded 
            ? 'w-[min(540px,calc(100vw-1rem))] h-[64px]'
            : isRecording || handRaiseCount > 0
            ? 'w-[200px] h-[34px]' 
            : 'w-[130px] h-[32px]'
          }
        `}
      >
        {/* Collapsed State */}
        <div 
          className={`absolute inset-0 flex items-center justify-center gap-2 px-3 transition-all duration-300
            ${isExpanded ? 'opacity-0 scale-90 blur-sm pointer-events-none' : 'opacity-100 scale-100 blur-0'}
          `}
        >
          {isRecording ? (
            <div className="flex items-center gap-1.5 text-rose-400">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span className="text-[10px] font-bold font-mono">REC {formatTime(recordingDuration)}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-[10px] font-bold text-zinc-300 font-mono tracking-wider">{formatTime(timer)}</span>
            </div>
          )}

          {handRaiseCount > 0 && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/40 rounded-full text-[10px] text-amber-300 font-bold">
              <span>✋</span>
              <span>{handRaiseCount}</span>
            </div>
          )}
        </div>

        {/* Expanded State */}
        <div 
          className={`absolute inset-0 flex items-center justify-between px-6 transition-all duration-500 delay-75
            ${isExpanded ? 'opacity-100 scale-100 blur-0' : 'opacity-0 scale-110 blur-md pointer-events-none'}
          `}
        >
          {/* Left: Time & Recording */}
          <div className="flex items-center gap-2.5 min-w-[110px]">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl border bg-black/40 border-white/10">
              <span className="text-xs font-mono text-zinc-300">{formatTime(timer)}</span>
            </div>
            {isRecording && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-rose-500/20 border border-rose-500/30 rounded-xl text-[10px] text-rose-300 font-mono font-bold animate-pulse">
                <Disc className="w-3 h-3 text-rose-400" />
                <span>REC {formatTime(recordingDuration)}</span>
              </div>
            )}
          </div>

          {/* Center: Room Code & 1-Click Copy */}
          <div 
            onClick={copyRoomId}
            className="flex flex-col items-center cursor-pointer group px-4 py-1 rounded-xl hover:bg-white/5 transition-colors"
            title="Click to copy invite link"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white tracking-wide font-mono group-hover:text-blue-400 transition-colors">{roomId}</span>
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-500 group-hover:text-blue-400" />}
            </div>
            <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">
              {copied ? 'Link Copied!' : 'Room Code'}
            </span>
          </div>

          {/* Right: Network Stats, Hand Raises & Participants */}
          <div className="flex items-center gap-3 min-w-[110px] justify-end">
            {handRaiseCount > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 border border-amber-500/40 rounded-xl text-xs text-amber-300 font-bold">
                <span>✋</span>
                <span>{handRaiseCount}</span>
              </div>
            )}

            {/* Connection Quality Block */}
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold uppercase ${getQualityColor(ping)}`}>
                  {ping < 100 ? 'Excellent' : ping < 250 ? 'Good' : 'Weak'}
                </span>
                {getSignalBars(ping)}
              </div>
              <div className="flex items-center gap-1 text-[9px] font-mono text-zinc-500">
                <span title="Latency">{ping}ms</span>
              </div>
            </div>

            <div className="w-px h-6 bg-white/10" />

            <div className="flex -space-x-2">
              {isMuted && (
                <div className="w-7 h-7 rounded-full bg-zinc-900 border border-black flex items-center justify-center" title="Muted">
                  <MicOff className="w-3.5 h-3.5 text-rose-400"/>
                </div>
              )}
              {isVideoStopped && (
                <div className="w-7 h-7 rounded-full bg-zinc-900 border border-black flex items-center justify-center" title="Camera off">
                  <VideoOff className="w-3.5 h-3.5 text-rose-400"/>
                </div>
              )}
              <div className="w-7 h-7 rounded-full bg-zinc-800 border border-black flex items-center justify-center text-[10px] text-zinc-300 font-bold">
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
