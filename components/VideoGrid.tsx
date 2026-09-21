import React, { useEffect, useRef, useState } from 'react';
import { MicOff, Signal, SignalMedium, SignalLow, Activity, MonitorUp, Pin, PinOff } from 'lucide-react';
import { signaling } from '../services/socket';
import { Reaction, ConnectionStats } from '../types';

interface VideoTileProps {
  stream: MediaStream;
  isLocal?: boolean;
  userId?: string;
  userName?: string;
  muted?: boolean;
  isVideoStopped?: boolean;
  stats?: ConnectionStats;
  isCompact?: boolean;
  caption?: string;
  isScreenShare?: boolean;
  isHandRaised?: boolean;
  isPinned?: boolean;
  onTogglePin?: () => void;
}

const VideoTile: React.FC<VideoTileProps> = ({ 
  stream, 
  isLocal, 
  userId, 
  userName, 
  muted = false, 
  isVideoStopped = false,
  stats, 
  isCompact = false, 
  caption, 
  isScreenShare,
  isHandRaised = false,
  isPinned = false,
  onTogglePin
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [trackHasVideo, setTrackHasVideo] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0); // 0 to 100
  const [reactions, setReactions] = useState<{ id: string; emoji: string; drift: number; left: number }[]>([]);

  // Audio analysis for Active Speaker detection
  useEffect(() => {
    if (!stream || muted) {
      setIsSpeaking(false);
      setAudioLevel(0);
      return;
    }

    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode;
    let source: MediaStreamAudioSourceNode;
    let animationFrame: number;

    const setupAudioAnalysis = () => {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      
      try {
        audioContext = new AudioContextClass();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.5;
        
        source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const checkVolume = () => {
          if (!analyser || muted) {
            setIsSpeaking(false);
            setAudioLevel(0);
            return;
          }

          analyser.getByteFrequencyData(dataArray);
          
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i] * dataArray[i];
          }
          const rms = Math.sqrt(sum / bufferLength);
          
          const normalized = Math.min(100, (rms / 50) * 100);
          setAudioLevel(normalized);
          setIsSpeaking(rms > 12); 
          
          animationFrame = requestAnimationFrame(checkVolume);
        };
        
        checkVolume();
      } catch (e) {
        console.error("Audio analysis failed", e);
      }
    };

    setupAudioAnalysis();

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
      }
    };
  }, [stream, muted]);

  // Video Track monitoring
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      
      const checkVideo = () => {
        const videoTrack = stream.getVideoTracks()[0];
        setTrackHasVideo(!!(videoTrack && videoTrack.enabled && videoTrack.readyState === 'live'));
      };
      
      checkVideo();
      stream.getVideoTracks().forEach(track => {
        track.onmute = () => setTrackHasVideo(false);
        track.onunmute = () => setTrackHasVideo(true);
        track.onended = () => setTrackHasVideo(false);
      });

      const interval = setInterval(checkVideo, 1000);
      return () => clearInterval(interval);
    }
  }, [stream]);

  // Listen for reactions
  useEffect(() => {
    const triggerReaction = (emoji: string) => {
      const id = `${Date.now()}-${Math.random()}`;
      const drift = (Math.random() - 0.5) * 80;
      const left = 35 + Math.random() * 30;
      setReactions(prev => [...prev.slice(-8), { id, emoji, drift, left }]);
      setTimeout(() => {
        setReactions(prev => prev.filter(r => r.id !== id));
      }, 2700);
    };

    const handleReaction = (reaction: Reaction) => {
      if (reaction.senderId === userId || (userName && reaction.senderId === userName)) {
        triggerReaction(reaction.emoji);
      }
    };

    const handleLocalReaction = (e: CustomEvent) => {
      if (isLocal) {
        triggerReaction(e.detail.emoji);
      }
    };

    if (!isLocal) {
      signaling.on('reaction', handleReaction);
      return () => {
        signaling.off('reaction', handleReaction);
      };
    } else {
      window.addEventListener('local-reaction' as any, handleLocalReaction);
      return () => {
        window.removeEventListener('local-reaction' as any, handleLocalReaction);
      };
    }
  }, [userId, userName, isLocal]);

  // Helper for Stats Icon Color
  const getStatsColor = (rtt: number) => {
    if (rtt < 100) return 'text-emerald-400';
    if (rtt < 200) return 'text-amber-400';
    return 'text-rose-400';
  };

  const StatsIcon = () => {
    if (!stats) return <Signal className="w-3 h-3 text-zinc-600" />;
    if (stats.rtt < 100) return <Signal className="w-3 h-3 text-emerald-400" />;
    if (stats.rtt < 200) return <SignalMedium className="w-3 h-3 text-amber-400" />;
    return <SignalLow className="w-3 h-3 text-rose-400" />;
  };

  const showVideo = !isVideoStopped && trackHasVideo;

  return (
    <div 
      className={`relative w-full h-full bg-zinc-950 rounded-2xl overflow-hidden transition-all duration-300 group
        ${isSpeaking && !muted
          ? 'border-2 border-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.35)] ring-2 ring-emerald-500/40' 
          : isPinned
          ? 'border-2 border-blue-500 shadow-[0_0_25px_rgba(59,130,246,0.3)]'
          : isHandRaised
          ? 'border-2 border-amber-500/80 shadow-[0_0_25px_rgba(245,158,11,0.3)]'
          : 'border border-white/10 shadow-xl'
        }
      `}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal || muted}
        className={`w-full h-full object-cover transition-opacity duration-300 ${isLocal && !isScreenShare ? 'scale-x-[-1]' : ''} ${!showVideo ? 'opacity-0' : 'opacity-100'}`}
      />
      
      {!showVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/95 backdrop-blur-md">
          <div className={`${isCompact ? 'w-12 h-12 text-base' : 'w-20 h-20 text-2xl'} rounded-full bg-zinc-800/90 border border-white/10 flex items-center justify-center font-bold text-white shadow-inner`}>
            {(userName || (isLocal ? 'You' : 'Peer')).charAt(0).toUpperCase()}
          </div>
        </div>
      )}

      {/* Floating Reactions */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
        {reactions.map((r) => (
          <div 
            key={r.id} 
            style={{
              left: `${r.left}%`,
              ['--drift' as any]: `${r.drift}px`
            }}
            className="absolute bottom-8 text-4xl sm:text-5xl animate-float-up pointer-events-none select-none drop-shadow-xl"
          >
            {r.emoji}
          </div>
        ))}
      </div>

      {/* Top Left Badges (Screen Share, Hand Raised) */}
      <div className="absolute top-3 left-3 flex items-center gap-2 z-20">
        {isScreenShare && (
          <div className="px-2 py-1 bg-blue-600/30 backdrop-blur-md border border-blue-500/40 rounded-lg flex items-center gap-1.5 shadow-md">
            <MonitorUp className="w-3 h-3 text-blue-400" />
            <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wide">Presenting</span>
          </div>
        )}

        {isHandRaised && (
          <div className="px-2 py-1 bg-amber-500/25 backdrop-blur-md border border-amber-500/40 rounded-lg flex items-center gap-1.5 shadow-md animate-bounce">
            <span className="text-xs">✋</span>
            <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wide">Hand Raised</span>
          </div>
        )}
      </div>

      {/* Pin / Unpin Button (Top-Right Action) */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
        {onTogglePin && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin();
            }}
            className={`p-1.5 rounded-full backdrop-blur-md border transition-all ${
              isPinned
                ? 'bg-blue-600 text-white border-blue-400 shadow-lg'
                : 'bg-black/50 text-zinc-300 border-white/15 hover:bg-black/80 hover:text-white'
            }`}
            title={isPinned ? 'Unpin participant' : 'Pin participant'}
          >
            {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
          </button>
        )}

        {/* Network Stats Indicator (Only for remote peers) */}
        {!isLocal && stats && (
          <div className="group/stats relative">
            <div className="p-1.5 rounded-full bg-black/50 backdrop-blur-md border border-white/15 hover:bg-black/80 transition-colors cursor-help">
              <StatsIcon />
            </div>
            
            {/* Tooltip */}
            <div className="hidden group-hover/stats:block absolute top-8 right-0 bg-zinc-950/95 backdrop-blur-xl border border-white/15 rounded-xl p-3 min-w-[140px] shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200 pointer-events-none">
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
                <Activity className="w-3 h-3 text-blue-400" />
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Network</span>
              </div>
              <div className="space-y-1.5 font-mono text-[10px]">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Ping</span>
                  <span className={getStatsColor(stats.rtt)}>{stats.rtt.toFixed(0)}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Jitter</span>
                  <span className="text-zinc-300">{stats.jitter.toFixed(1)}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Loss</span>
                  <span className={stats.packetLossPercentage > 5 ? 'text-rose-400' : 'text-zinc-300'}>{stats.packetLossPercentage.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Live Captions Overlay */}
      {caption && (
        <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 w-[90%] pointer-events-none flex justify-center z-30">
          <div className="bg-black/75 backdrop-blur-md px-4 py-2 rounded-xl text-center border border-white/15 shadow-lg animate-in slide-in-from-bottom-2 fade-in duration-200">
            <p className="text-white text-sm md:text-base font-medium leading-snug drop-shadow-md">
              {caption}
            </p>
          </div>
        </div>
      )}

      {/* Glass Name Tag & Audio Visualizer */}
      <div className={`absolute left-3 flex items-center gap-2 max-w-[80%] ${isCompact ? 'bottom-2 left-2' : 'bottom-3 left-3'}`}>
        <div className={`bg-zinc-950/60 backdrop-blur-md rounded-full border border-white/15 flex items-center gap-2 shadow-sm ${isCompact ? 'px-2 py-1' : 'px-3 py-1.5'}`}>
          {!muted && (
            <div className={`flex items-end gap-[2px] ${isCompact ? 'h-2 w-2' : 'h-3 w-3'}`}>
              <div className="w-[3px] bg-emerald-400 rounded-full transition-all duration-100" style={{ height: `${Math.max(20, audioLevel)}%` }}></div>
              <div className="w-[3px] bg-emerald-400 rounded-full transition-all duration-100" style={{ height: `${Math.max(20, audioLevel * 0.6)}%` }}></div>
              <div className="w-[3px] bg-emerald-400 rounded-full transition-all duration-100" style={{ height: `${Math.max(20, audioLevel * 0.3)}%` }}></div>
            </div>
          )}
          
          <span className={`${isCompact ? 'text-[10px]' : 'text-xs'} font-medium text-white/90 truncate`}>
            {isLocal ? (userName || 'You') : (userName || `Peer ${userId?.slice(0, 4)}`)}
          </span>
          
          {muted && <MicOff className={`${isCompact ? 'w-2.5 h-2.5' : 'w-3 h-3'} text-rose-400 ml-0.5`} />}
        </div>
      </div>
    </div>
  );
};

interface VideoGridProps {
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  myUserId: string;
  myUserName?: string;
  connectionStats?: Map<string, ConnectionStats>;
  captions?: Map<string, string>;
  peerNames?: Map<string, string>;
  peerScreenShares?: Map<string, boolean>;
  isLocalScreenShare?: boolean;
  raisedHands?: Set<string>;
  localIsMuted?: boolean;
  localIsVideoStopped?: boolean;
  peerMediaStates?: Map<string, { isMuted: boolean; isVideoStopped: boolean }>;
}

const VideoGrid: React.FC<VideoGridProps> = ({ 
  localStream, 
  remoteStreams, 
  myUserId, 
  myUserName, 
  connectionStats, 
  captions, 
  peerNames,
  peerScreenShares,
  isLocalScreenShare,
  raisedHands,
  localIsMuted = false,
  localIsVideoStopped = false,
  peerMediaStates
}) => {
  const [pinnedPeerId, setPinnedPeerId] = useState<string | null>(null);

  const streams = [
    ...(localStream ? [{ 
      id: myUserId, 
      stream: localStream, 
      isLocal: true, 
      stats: undefined, 
      userName: myUserName,
      isScreenShare: isLocalScreenShare,
      isMuted: localIsMuted,
      isVideoStopped: localIsVideoStopped
    }] : []),
    ...Array.from(remoteStreams.entries()).map(([id, stream]) => {
      const media = peerMediaStates?.get(id);
      return { 
        id, 
        stream, 
        isLocal: false,
        stats: connectionStats?.get(id),
        userName: peerNames?.get(id),
        isScreenShare: peerScreenShares?.get(id),
        isMuted: media !== undefined ? media.isMuted : (stream.getAudioTracks().length === 0 || !stream.getAudioTracks()[0]?.enabled),
        isVideoStopped: media !== undefined ? media.isVideoStopped : (stream.getVideoTracks().length === 0 || !stream.getVideoTracks()[0]?.enabled)
      };
    })
  ];
  
  const count = streams.length;
  const isCompact = count > 6;
  
  // Check if anyone is screen sharing
  const screenShareStream = streams.find(s => s.isScreenShare);
  const hasScreenShare = !!screenShareStream;

  // Active spotlight item: pinned stream has highest priority, then screen share
  const spotlightStream = pinnedPeerId 
    ? streams.find(s => s.id === pinnedPeerId)
    : hasScreenShare 
    ? screenShareStream 
    : null;

  const togglePin = (id: string) => {
    setPinnedPeerId(prev => (prev === id ? null : id));
  };

  // Spotlight Layout (either Pinned participant or Screen Share)
  if (spotlightStream && count > 1) {
    const otherStreams = streams.filter(s => s.id !== spotlightStream.id);
    
    return (
      <div className="w-full h-full flex flex-col md:flex-row gap-3 md:gap-4 overflow-hidden p-2 items-center justify-center">
        {/* Main stage spotlight area */}
        <div className="flex-1 min-h-0 min-w-0 w-full h-full flex items-center justify-center">
          <div className="w-full max-h-full aspect-video flex items-center justify-center relative">
            <VideoTile 
              stream={spotlightStream.stream} 
              isLocal={spotlightStream.isLocal} 
              userId={spotlightStream.id} 
              userName={spotlightStream.userName}
              stats={spotlightStream.stats}
              muted={spotlightStream.isMuted}
              isVideoStopped={spotlightStream.isVideoStopped}
              isCompact={false}
              caption={captions?.get(spotlightStream.id)}
              isScreenShare={spotlightStream.isScreenShare}
              isHandRaised={raisedHands?.has(spotlightStream.id)}
              isPinned={pinnedPeerId === spotlightStream.id}
              onTogglePin={() => togglePin(spotlightStream.id)}
            />
          </div>
        </div>
        
        {/* Sidebar strip with other participants */}
        <div className="flex md:flex-col gap-2.5 md:w-52 lg:w-60 xl:w-64 overflow-x-auto md:overflow-y-auto md:overflow-x-hidden shrink-0 items-center justify-center md:justify-start max-h-full py-1">
          {otherStreams.map(p => (
            <div key={p.id} className="w-36 h-24 md:w-full md:h-auto md:aspect-video shrink-0">
              <VideoTile 
                stream={p.stream} 
                isLocal={p.isLocal} 
                userId={p.id} 
                userName={p.userName}
                stats={p.stats}
                muted={p.isMuted}
                isVideoStopped={p.isVideoStopped}
                isCompact={true}
                caption={captions?.get(p.id)}
                isScreenShare={p.isScreenShare}
                isHandRaised={raisedHands?.has(p.id)}
                isPinned={pinnedPeerId === p.id}
                onTogglePin={() => togglePin(p.id)}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Standard auto-centering grid layout
  return (
    <div className="w-full h-full min-h-0 flex items-center justify-center p-1 sm:p-3 overflow-hidden">
      <div 
        className={`w-full h-full min-h-0 grid items-center justify-items-center gap-2 sm:gap-3 overflow-hidden transition-all duration-300 ${
          count === 1 ? 'grid-cols-1 grid-rows-1' :
          count === 2 ? 'grid-cols-1 sm:grid-cols-2 grid-rows-1' :
          count <= 4 ? 'grid-cols-2 grid-rows-2' :
          count <= 6 ? 'grid-cols-2 sm:grid-cols-3 grid-rows-2' :
          count <= 9 ? 'grid-cols-2 sm:grid-cols-3 grid-rows-3' :
          'grid-cols-3 sm:grid-cols-4'
        }`}
        style={{
          maxWidth: count === 1 ? '1100px' : count === 2 ? '1300px' : count <= 4 ? '1200px' : '100%',
        }}
      >
        {streams.map((p) => (
          <div
            key={p.id}
            className="w-full h-full min-h-0 min-w-0 flex items-center justify-center transition-all duration-300 ease-out overflow-hidden"
          >
            <VideoTile 
              stream={p.stream} 
              isLocal={p.isLocal} 
              userId={p.id} 
              userName={p.userName}
              stats={p.stats}
              muted={p.isMuted}
              isVideoStopped={p.isVideoStopped}
              isCompact={isCompact}
              caption={captions?.get(p.id)}
              isScreenShare={p.isScreenShare}
              isHandRaised={raisedHands?.has(p.id)}
              isPinned={pinnedPeerId === p.id}
              onTogglePin={() => togglePin(p.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default VideoGrid;
