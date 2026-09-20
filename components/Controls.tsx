

import React, { useState } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, MonitorUp, MessageSquare, Smile, Settings, PictureInPicture, PenTool, Aperture, Captions } from 'lucide-react';

interface ControlsProps {
  isMuted: boolean;
  isVideoStopped: boolean;
  isScreenSharing: boolean;
  isBlurEnabled: boolean;
  isCaptionsEnabled: boolean;
  showChat: boolean;
  showWhiteboard: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleBlur: () => void;
  onToggleCaptions: () => void;
  onTogglePiP: () => void;
  onToggleChat: () => void;
  onToggleWhiteboard: () => void;
  onOpenSettings: () => void;
  onLeave: () => void;
  onReaction: (emoji: string) => void;
}

const Controls: React.FC<ControlsProps> = ({
  isMuted,
  isVideoStopped,
  isScreenSharing,
  isBlurEnabled,
  isCaptionsEnabled,
  showChat,
  showWhiteboard,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onToggleBlur,
  onToggleCaptions,
  onTogglePiP,
  onToggleChat,
  onToggleWhiteboard,
  onOpenSettings,
  onLeave,
  onReaction
}) => {
  const [showReactions, setShowReactions] = useState(false);

  const buttonBase = "p-3.5 rounded-2xl transition-all duration-200 transform active:scale-95 flex items-center justify-center relative";
  const buttonNormal = "bg-white/[0.06] text-zinc-200 hover:bg-white/[0.12] hover:text-white border border-white/10 hover:border-white/20 backdrop-blur-md";
  const buttonActive = "bg-white text-black shadow-lg shadow-white/20 border border-white";
  const buttonDanger = "bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/30 shadow-lg shadow-rose-500/10";
  
  const handleReaction = (emoji: string) => {
    onReaction(emoji);
    setShowReactions(false);
  };

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-3 z-50">
      
      {/* Reaction Popover */}
      {showReactions && (
          <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-zinc-950/80 backdrop-blur-2xl border border-white/15 ring-1 ring-white/10 rounded-2xl p-2 flex gap-2 shadow-2xl animate-in slide-in-from-bottom-5 fade-in duration-200">
              <button onClick={() => handleReaction('❤️')} className="p-2 hover:bg-white/10 rounded-xl text-2xl transition-colors">❤️</button>
              <button onClick={() => handleReaction('👍')} className="p-2 hover:bg-white/10 rounded-xl text-2xl transition-colors">👍</button>
              <button onClick={() => handleReaction('😂')} className="p-2 hover:bg-white/10 rounded-xl text-2xl transition-colors">😂</button>
              <button onClick={() => handleReaction('🎉')} className="p-2 hover:bg-white/10 rounded-xl text-2xl transition-colors">🎉</button>
          </div>
      )}

      <div className="flex items-center gap-2 bg-zinc-950/60 backdrop-blur-3xl p-2 sm:p-2.5 rounded-3xl border border-white/15 ring-1 ring-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.6),inset_0_1px_1px_0_rgba(255,255,255,0.15)]">
        
        <button
          onClick={onToggleMute}
          className={`${buttonBase} ${isMuted ? buttonDanger : buttonNormal}`}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        <button
          onClick={onToggleVideo}
          className={`${buttonBase} ${isVideoStopped ? buttonDanger : buttonNormal}`}
          title={isVideoStopped ? "Start Video" : "Stop Video"}
        >
          {isVideoStopped ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </button>

        <button
            onClick={onToggleScreenShare}
            className={`${buttonBase} ${isScreenSharing ? 'bg-green-500/10 text-green-400 border-green-500/20' : buttonNormal}`}
            title="Share Screen"
        >
            <MonitorUp className="w-5 h-5" />
        </button>

        <button
            onClick={onToggleBlur}
            className={`${buttonBase} ${isBlurEnabled ? buttonActive : buttonNormal}`}
            title="Blur Background"
        >
            <Aperture className="w-5 h-5" />
        </button>

        <button
            onClick={onToggleCaptions}
            className={`${buttonBase} ${isCaptionsEnabled ? buttonActive : buttonNormal}`}
            title="Live Captions"
        >
            <Captions className="w-5 h-5" />
        </button>
        
        <button
            onClick={onOpenSettings}
            className={`${buttonBase} ${buttonNormal}`}
            title="Settings"
        >
            <Settings className="w-5 h-5" />
        </button>

        <button
            onClick={onTogglePiP}
            className={`${buttonBase} ${buttonNormal}`}
            title="Picture in Picture"
        >
            <PictureInPicture className="w-5 h-5" />
        </button>

        <div className="w-px h-8 bg-zinc-800 mx-2"></div>

        <button
            onClick={onToggleWhiteboard}
            className={`${buttonBase} ${showWhiteboard ? buttonActive : buttonNormal}`}
            title="Whiteboard"
        >
            <PenTool className="w-5 h-5" />
        </button>

        <button
            onClick={() => setShowReactions(!showReactions)}
            className={`${buttonBase} ${showReactions ? buttonActive : buttonNormal}`}
            title="Reactions"
        >
            <Smile className="w-5 h-5" />
        </button>

        <button
            onClick={onToggleChat}
            className={`${buttonBase} ${showChat ? buttonActive : buttonNormal}`}
            title="Chat"
        >
            <MessageSquare className="w-5 h-5" />
        </button>

        <div className="w-px h-8 bg-zinc-800 mx-2"></div>

        <button
          onClick={onLeave}
          className={`${buttonBase} bg-red-600 hover:bg-red-500 text-white border-none w-14`}
          title="Leave Call"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default Controls;