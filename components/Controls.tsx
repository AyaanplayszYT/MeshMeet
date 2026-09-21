import React, { useState } from 'react';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  PhoneOff, 
  MessageSquare, 
  Share2, 
  PenTool, 
  Settings, 
  PictureInPicture,
  Aperture,
  Captions,
  MonitorUp,
  Disc,
  Square,
  Smile
} from 'lucide-react';

interface ControlsProps {
  isMuted: boolean;
  isVideoStopped: boolean;
  isScreenSharing: boolean;
  isBlurEnabled: boolean;
  isCaptionsEnabled: boolean;
  isHandRaised: boolean;
  isRecording: boolean;
  recordingDuration: number;
  showChat: boolean;
  showWhiteboard: boolean;
  roomId: string;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleBlur: () => void;
  onToggleCaptions: () => void;
  onTogglePiP: () => void;
  onToggleRaiseHand: () => void;
  onToggleRecord: () => void;
  onCopyInvite: () => void;
  onToggleChat: () => void;
  onToggleWhiteboard: () => void;
  onOpenSettings: () => void;
  onLeave: () => void;
  onReaction: (emoji: string) => void;
}

const ControlButton: React.FC<{
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  className?: string;
  children: React.ReactNode;
}> = ({ label, onClick, active, danger, className = '', children }) => (
  <div className="group/dock relative flex items-center justify-center">
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`p-3 rounded-2xl transition-all duration-200 transform active:scale-95 flex items-center justify-center ${
        active 
          ? 'bg-white text-black shadow-lg shadow-white/20 border border-white'
          : danger
          ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/30 shadow-lg shadow-rose-500/10'
          : 'bg-white/[0.06] text-zinc-300 hover:bg-white/[0.14] hover:text-white border border-white/10 hover:border-white/20 backdrop-blur-md'
      } ${className}`}
    >
      {children}
    </button>
    
    {/* Floating Glass Tooltip */}
    <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-zinc-900/95 backdrop-blur-xl text-white text-[11px] font-medium rounded-xl border border-white/15 shadow-2xl opacity-0 group-hover/dock:opacity-100 transition-all duration-150 pointer-events-none whitespace-nowrap z-50 transform group-hover/dock:-translate-y-0.5">
      {label}
    </div>
  </div>
);

export const Controls: React.FC<ControlsProps> = ({
  isMuted,
  isVideoStopped,
  isScreenSharing,
  isBlurEnabled,
  isCaptionsEnabled,
  isHandRaised,
  isRecording,
  recordingDuration,
  showChat,
  showWhiteboard,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onToggleBlur,
  onToggleCaptions,
  onTogglePiP,
  onToggleRaiseHand,
  onToggleRecord,
  onCopyInvite,
  onToggleChat,
  onToggleWhiteboard,
  onOpenSettings,
  onLeave,
  onReaction
}) => {
  const [showReactions, setShowReactions] = useState(false);

  const handleReaction = (emoji: string) => {
    onReaction(emoji);
    setShowReactions(false);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed bottom-5 left-1/2 transform -translate-x-1/2 flex items-center gap-3 z-50">
      
      {/* Reaction Popover */}
      {showReactions && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-zinc-950/90 backdrop-blur-2xl border border-white/15 ring-1 ring-white/10 rounded-2xl p-2 flex gap-2 shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-150">
          {['❤️', '👍', '😂', '🎉', '🔥', '👏'].map((emoji) => (
            <button 
              key={emoji}
              type="button"
              onClick={() => handleReaction(emoji)} 
              className="p-2 hover:bg-white/10 rounded-xl text-2xl transition-transform hover:scale-125 select-none"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Main Glass Control Dock */}
      <div className="flex items-center gap-1.5 sm:gap-2 bg-zinc-950/75 backdrop-blur-3xl p-2 sm:p-2.5 rounded-3xl border border-white/15 ring-1 ring-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.7),inset_0_1px_1px_0_rgba(255,255,255,0.15)] overflow-visible">
        
        {/* Mute Mic */}
        <ControlButton
          label={isMuted ? "Unmute Microphone" : "Mute Microphone"}
          onClick={onToggleMute}
          danger={isMuted}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </ControlButton>

        {/* Video Camera */}
        <ControlButton
          label={isVideoStopped ? "Turn Camera On" : "Turn Camera Off"}
          onClick={onToggleVideo}
          danger={isVideoStopped}
        >
          {isVideoStopped ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </ControlButton>

        {/* Screen Share */}
        <ControlButton
          label={isScreenSharing ? "Stop Sharing Screen" : "Share Your Screen"}
          onClick={onToggleScreenShare}
          active={isScreenSharing}
        >
          <MonitorUp className="w-5 h-5" />
        </ControlButton>

        {/* Raise Hand */}
        <ControlButton
          label={isHandRaised ? "Lower Your Hand" : "Raise Hand"}
          onClick={onToggleRaiseHand}
          className={isHandRaised ? "bg-amber-500 text-black font-bold shadow-lg shadow-amber-500/30" : ""}
        >
          <span className="text-base leading-none">✋</span>
        </ControlButton>

        {/* Local Meeting Recording */}
        <ControlButton
          label={isRecording ? "Stop & Save Recording" : "Record Meeting Locally"}
          onClick={onToggleRecord}
          className={isRecording ? "bg-rose-600 text-white font-bold shadow-lg shadow-rose-600/40 animate-pulse px-3.5" : ""}
        >
          {isRecording ? (
            <div className="flex items-center gap-1.5">
              <Square className="w-4 h-4 fill-current" />
              <span className="text-xs font-mono">{formatTime(recordingDuration)}</span>
            </div>
          ) : (
            <Disc className="w-5 h-5" />
          )}
        </ControlButton>

        {/* Background Blur */}
        <ControlButton
          label={isBlurEnabled ? "Remove Background Blur" : "Virtual Background Blur"}
          onClick={onToggleBlur}
          active={isBlurEnabled}
        >
          <Aperture className="w-5 h-5" />
        </ControlButton>

        {/* Live Captions */}
        <ControlButton
          label={isCaptionsEnabled ? "Turn Off Live Captions" : "Live AI Captions"}
          onClick={onToggleCaptions}
          active={isCaptionsEnabled}
        >
          <Captions className="w-5 h-5" />
        </ControlButton>

        {/* Copy Invite Link */}
        <ControlButton
          label="Copy 1-Click Invite Link"
          onClick={onCopyInvite}
        >
          <Share2 className="w-5 h-5" />
        </ControlButton>
        
        {/* Device Settings */}
        <ControlButton
          label="Audio & Video Settings"
          onClick={onOpenSettings}
        >
          <Settings className="w-5 h-5" />
        </ControlButton>

        {/* Picture in Picture */}
        <ControlButton
          label="Picture in Picture (Floating Window)"
          onClick={onTogglePiP}
        >
          <PictureInPicture className="w-5 h-5" />
        </ControlButton>

        <div className="w-px h-7 bg-white/10 mx-0.5 hidden sm:block" />

        {/* Whiteboard */}
        <ControlButton
          label={showWhiteboard ? "Close Whiteboard" : "Collaborative Whiteboard"}
          onClick={onToggleWhiteboard}
          active={showWhiteboard}
        >
          <PenTool className="w-5 h-5" />
        </ControlButton>

        {/* Reactions */}
        <ControlButton
          label="Floating Emoji Reactions"
          onClick={() => setShowReactions(!showReactions)}
          active={showReactions}
        >
          <Smile className="w-5 h-5" />
        </ControlButton>

        {/* Chat */}
        <ControlButton
          label={showChat ? "Close Chat" : "Meeting Chat"}
          onClick={onToggleChat}
          active={showChat}
        >
          <MessageSquare className="w-5 h-5" />
        </ControlButton>

        <div className="w-px h-7 bg-white/10 mx-0.5" />

        {/* Leave Call */}
        <ControlButton
          label="Leave Meeting"
          onClick={onLeave}
          className="bg-rose-600 hover:bg-rose-500 text-white border-none w-12 sm:w-14 shadow-lg shadow-rose-600/30"
        >
          <PhoneOff className="w-5 h-5" />
        </ControlButton>

      </div>
    </div>
  );
};

export default Controls;