

import React, { useEffect, useRef, useState } from 'react';
import { MicOff, User, Signal, SignalMedium, SignalLow, Activity, MonitorUp, FileBarChart2 } from 'lucide-react';
import { signaling } from '../services/socket';
import { Reaction, ConnectionStats } from '../types';

interface VideoTileProps {
  stream: MediaStream;
  isLocal?: boolean;
  userId?: string;
  userName?: string;
  muted?: boolean;
  stats?: ConnectionStats;
  isCompact?: boolean;
  caption?: string;
  isScreenShare?: boolean;
}

const VideoTile: React.FC<VideoTileProps> = ({ stream, isLocal, userId, userName, muted, stats, isCompact = false, caption, isScreenShare }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasVideo, setHasVideo] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0); // 0 to 100
  const [reactions, setReactions] = useState<{ id: number, emoji: string }[]>([]);

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
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.5;
        
        source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const checkVolume = () => {
          if (!analyser) return;

          analyser.getByteFrequencyData(dataArray);
          
          // Calculate RMS (Root Mean Square) for better accuracy than average
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i] * dataArray[i];
          }
          const rms = Math.sqrt(sum / bufferLength);
          
          // Normalized level (0-100) for visualizer
          const normalized = Math.min(100, (rms / 50) * 100);
          setAudioLevel(normalized);

          // Threshold for "Is Speaking" state
          setIsSpeaking(rms > 10); 
          
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
         setHasVideo(videoTrack && videoTrack.enabled && videoTrack.readyState === 'live');
      };
      
      checkVideo();
      // Listen to track events
      stream.getVideoTracks().forEach(track => {
          track.onmute = () => setHasVideo(false);
          track.onunmute = () => setHasVideo(true);
          track.onended = () => setHasVideo(false);
      });

      const interval = setInterval(checkVideo, 1000);
      return () => clearInterval(interval);
    }
  }, [stream]);

  // Listen for reactions
  useEffect(() => {
    const handleReaction = (reaction: Reaction) => {
      if (reaction.senderId === userId) {
        const id = Date.now();
        setReactions(prev => [...prev, { id, emoji: reaction.emoji }]);
        setTimeout(() => {
          setReactions(prev => prev.filter(r => r.id !== id));
        }, 2000);
      }
    };

    const handleLocalReaction = (e: CustomEvent) => {
        if (e.detail.userId === userId) {
             const id = Date.now();
             setReactions(prev => [...prev, { id, emoji: e.detail.emoji }]);
             setTimeout(() => {
                setReactions(prev => prev.filter(r => r.id !== id));
             }, 2000);
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
  }, [userId, isLocal]);

  // Helper for Stats Icon Color
  const getStatsColor = (rtt: number) => {
      if (rtt < 100) return 'text-green-500';
      if (rtt < 200) return 'text-yellow-500';
      return 'text-red-500';
  };

  const StatsIcon = () => {
      if (!stats) return <Signal className="w-3 h-3 text-zinc-600" />;
      if (stats.rtt < 100) return <Signal className="w-3 h-3 text-green-500" />;
      if (stats.rtt < 200) return <SignalMedium className="w-3 h-3 text-yellow-500" />;
      return <SignalLow className="w-3 h-3 text-red-500" />;
  };

  return (
    <div 
      className={`relative w-full h-full bg-zinc-900 rounded-2xl overflow-hidden transition-all duration-300 group
        ${isSpeaking 
          ? 'border-2 border-green-500 shadow-[0_0_25px_rgba(34,197,94,0.4)] ring-1 ring-green-400' 
          : 'border border-zinc-800 shadow-xl'
        }
      `}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal || muted} // Always mute local video to prevent echo
        // Mirror ONLY if it's local camera. Do NOT mirror screen share.
        className={`w-full h-full object-cover transition-opacity duration-300 ${isLocal && !isScreenShare ? 'scale-x-[-1]' : ''} ${!hasVideo ? 'opacity-0' : 'opacity-100'}`}
      />
      
      {!hasVideo && (
        <div className="absolute inset-0 flex items-center justify-center">
           <div className={`${isCompact ? 'w-16 h-16' : 'w-24 h-24'} rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700 shadow-inner`}>
              <User className={`${isCompact ? 'w-6 h-6' : 'w-10 h-10'} text-zinc-500`} />
           </div>
        </div>
      )}

      {/* Floating Reactions */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {reactions.map((r) => (
           <div key={r.id} className="absolute bottom-10 left-1/2 text-5xl animate-float-up opacity-0">
              {r.emoji}
           </div>
        ))}
      </div>

      {/* Screen Share Indicator Badge */}
      {isScreenShare && (
          <div className="absolute top-3 left-3 px-2 py-1 bg-blue-600/20 backdrop-blur-md border border-blue-500/30 rounded-lg flex items-center gap-1.5 z-20">
              <MonitorUp className="w-3 h-3 text-blue-400" />
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wide">Presenting</span>
          </div>
      )}

      {/* Live Captions Overlay */}
      {caption && (
          <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 w-[90%] pointer-events-none flex justify-center z-30">
              <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl text-center border border-white/10 shadow-lg animate-in slide-in-from-bottom-2 fade-in duration-200">
                  <p className="text-white text-sm md:text-base font-medium leading-snug drop-shadow-md">
                      {caption}
                  </p>
              </div>
          </div>
      )}

      {/* Network Stats Indicator (Top Right) - Only for remote peers */}
      {!isLocal && stats && (
         <div className={`absolute top-3 right-3 z-20 group/stats ${isCompact ? 'opacity-0 group-hover:opacity-100 transition-opacity' : ''}`}>
            <div className="p-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 hover:bg-black/60 transition-colors cursor-help">
                <StatsIcon />
            </div>
            
            {/* Tooltip */}
            <div className="hidden group-hover/stats:block absolute top-8 right-0 bg-black/90 backdrop-blur-xl border border-zinc-800 rounded-xl p-3 min-w-[140px] shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200 pointer-events-none">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
                    <Activity className="w-3 h-3 text-blue-400" />
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Network Stats</span>
                </div>
                <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-zinc-500">Ping</span>
                        <span className={getStatsColor(stats.rtt)}>{stats.rtt.toFixed(0)}ms</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-zinc-500">Jitter</span>
                        <span className="text-zinc-300">{stats.jitter.toFixed(1)}ms</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-zinc-500">Loss</span>
                        <span className={stats.packetLossPercentage > 5 ? 'text-red-400' : 'text-zinc-300'}>{stats.packetLossPercentage.toFixed(1)}%</span>
                    </div>
                    {stats.resolution && (
                         <div className="flex justify-between text-[10px] font-mono border-t border-white/5 pt-1.5 mt-1">
                             <span className="text-zinc-500">Res</span>
                             <span className="text-blue-300">{stats.resolution}</span>
                         </div>
                    )}
                    {stats.frameRate !== undefined && (
                         <div className="flex justify-between text-[10px] font-mono">
                             <span className="text-zinc-500">FPS</span>
                             <span className="text-green-300">{stats.frameRate}</span>
                         </div>
                    )}
                </div>
            </div>
         </div>
      )}

      {/* Name Tag & Audio Visualizer */}
      <div className={`absolute left-3 flex items-center gap-2 max-w-[80%] ${isCompact ? 'bottom-2 left-2' : 'bottom-3 left-3'}`}>
          <div className={`bg-black/40 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-2 shadow-sm ${isCompact ? 'px-2 py-1' : 'px-3 py-1.5'}`}>
            {/* Dynamic Audio Bar Visualizer */}
            {!muted && (
                <div className={`flex items-end gap-[2px] ${isCompact ? 'h-2 w-2' : 'h-3 w-3'}`}>
                    <div className="w-[3px] bg-green-500 rounded-full transition-all duration-100" style={{ height: `${Math.max(20, audioLevel)}%` }}></div>
                    <div className="w-[3px] bg-green-500 rounded-full transition-all duration-100" style={{ height: `${Math.max(20, audioLevel * 0.6)}%` }}></div>
                    <div className="w-[3px] bg-green-500 rounded-full transition-all duration-100" style={{ height: `${Math.max(20, audioLevel * 0.3)}%` }}></div>
                </div>
            )}
            
            <span className={`${isCompact ? 'text-[10px]' : 'text-xs'} font-medium text-white/90 truncate`}>
                {isLocal ? (userName || 'You') : (userName || `Peer ${userId?.slice(0, 4)}`)}
            </span>
            
            {muted && <MicOff className={`${isCompact ? 'w-2.5 h-2.5' : 'w-3 h-3'} text-red-400 ml-1`} />}
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
  isLocalScreenShare 
}) => {
  const streams = [
      ...(localStream ? [{ 
          id: myUserId, 
          stream: localStream, 
          isLocal: true, 
          stats: undefined, 
          userName: myUserName,
          isScreenShare: isLocalScreenShare
      }] : []),
      ...Array.from(remoteStreams.entries()).map(([id, stream]) => ({ 
          id, 
          stream, 
          isLocal: false,
          stats: connectionStats?.get(id),
          userName: peerNames?.get(id),
          isScreenShare: peerScreenShares?.get(id)
      }))
  ];
  
  const count = streams.length;
  const isCompact = count > 9;
  
  // Check if anyone is screen sharing
  const screenShareStream = streams.find(s => s.isScreenShare);
  const hasScreenShare = !!screenShareStream;

  // Dimension helper for auto-centering and balanced layouts
  const getTileClasses = (n: number) => {
    if (n === 1) {
      return 'w-full max-w-4xl max-h-full';
    }
    if (n === 2) {
      return 'w-full md:w-[calc(50%-0.75rem)] max-w-2xl max-h-full';
    }
    if (n === 3) {
      return 'w-full sm:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-0.75rem)] max-w-xl max-h-[calc(50vh-5rem)]';
    }
    if (n === 4) {
      return 'w-[calc(50%-0.5rem)] sm:w-[calc(50%-0.75rem)] max-w-xl max-h-[calc(50vh-5rem)]';
    }
    if (n <= 6) {
      return 'w-[calc(50%-0.5rem)] md:w-[calc(33.333%-0.75rem)] max-w-lg max-h-[calc(50vh-5rem)]';
    }
    if (n <= 9) {
      return 'w-[calc(50%-0.5rem)] sm:w-[calc(33.333%-0.75rem)] max-w-md max-h-[calc(33.333vh-4rem)]';
    }
    return 'w-[calc(33.333%-0.5rem)] md:w-[calc(25%-0.75rem)] max-w-sm max-h-[calc(25vh-3rem)]';
  };

  // Screen share layout: presenter takes main area, others in sidebar
  if (hasScreenShare && count > 1) {
    const otherStreams = streams.filter(s => s.id !== screenShareStream.id);
    
    return (
      <div className="w-full h-full flex flex-col md:flex-row gap-3 md:gap-4 overflow-hidden p-2 items-center justify-center">
        {/* Main screen share area */}
        <div className="flex-1 min-h-0 min-w-0 w-full h-full flex items-center justify-center">
          <div className="w-full max-h-full aspect-video flex items-center justify-center">
            <VideoTile 
              stream={screenShareStream.stream} 
              isLocal={screenShareStream.isLocal} 
              userId={screenShareStream.id} 
              userName={screenShareStream.userName}
              stats={screenShareStream.stats}
              muted={screenShareStream.stream.getAudioTracks()[0]?.enabled === false}
              isCompact={false}
              caption={captions?.get(screenShareStream.id)}
              isScreenShare={true}
            />
          </div>
        </div>
        
        {/* Sidebar with other participants */}
        <div className="flex md:flex-col gap-2.5 md:w-52 lg:w-60 xl:w-64 overflow-x-auto md:overflow-y-auto md:overflow-x-hidden shrink-0 items-center justify-center md:justify-start max-h-full">
          {otherStreams.map(p => (
            <div key={p.id} className="w-36 h-24 md:w-full md:h-auto md:aspect-video shrink-0">
              <VideoTile 
                stream={p.stream} 
                isLocal={p.isLocal} 
                userId={p.id} 
                userName={p.userName}
                stats={p.stats}
                muted={p.stream.getAudioTracks()[0]?.enabled === false}
                isCompact={true}
                caption={captions?.get(p.id)}
                isScreenShare={p.isScreenShare}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Standard auto-centering grid layout
  return (
    <div className="w-full h-full flex items-center justify-center p-2 sm:p-4 overflow-hidden">
      <div 
        className="w-full h-full flex flex-wrap items-center justify-center content-center gap-3 sm:gap-4 overflow-hidden transition-all duration-300"
        style={{
          maxWidth: count === 1 ? '1100px' : count === 2 ? '1300px' : count <= 4 ? '1200px' : '100%',
        }}
      >
        {streams.map((p) => (
          <div
            key={p.id}
            className={`aspect-video flex items-center justify-center transition-all duration-300 ease-out shrink-0 ${getTileClasses(count)}`}
          >
            <VideoTile 
              stream={p.stream} 
              isLocal={p.isLocal} 
              userId={p.id} 
              userName={p.userName}
              stats={p.stats}
              muted={p.stream.getAudioTracks()[0]?.enabled === false}
              isCompact={isCompact}
              caption={captions?.get(p.id)}
              isScreenShare={p.isScreenShare}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default VideoGrid;