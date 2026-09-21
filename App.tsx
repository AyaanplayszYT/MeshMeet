import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Video, Plus, ArrowRight, Loader2, Sparkles, Keyboard, ShieldCheck, Mic, MicOff, Video as VideoIcon, VideoOff, Users, Globe, Lock, RotateCcw, Home, Copyright, User as UserIcon, Wifi, WifiOff, DoorOpen, Check, X, Clock, Github, ScrollText, Radio } from 'lucide-react';
import { useWebRTC } from './hooks/useWebRTC';
import { useBackgroundBlur } from './hooks/useBackgroundBlur';
import { useLiveCaptions } from './hooks/useLiveCaptions';
import { useMeetingRecorder } from './hooks/useMeetingRecorder';
import { sound } from './services/sound';
import VideoGrid from './components/VideoGrid';
import Controls from './components/Controls';
import DynamicIsland from './components/DynamicIsland';
import Chat from './components/Chat';
import Whiteboard from './components/Whiteboard';
import SettingsModal from './components/SettingsModal';
import Navbar from './components/Navbar';
import PublicRoomsHub from './components/PublicRoomsHub';
import HostControlsModal from './components/HostControlsModal';
import { signaling } from './services/socket';
import { RoomInfo, RoomSettings, WaitingUser } from './types';

const generateId = () => Math.random().toString(36).substr(2, 6);

const App = () => {
  // App State
  const [mode, setMode] = useState<'home' | 'join' | 'create' | 'preview' | 'room' | 'left' | 'waiting' | 'denied'>('home');
  
  const [roomId, setRoomId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [waitingRoomEnabled, setWaitingRoomEnabled] = useState(false);
  
  const [userId, setUserId] = useState('');
  const [username, setUsername] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isRefreshingRooms, setIsRefreshingRooms] = useState(false);
  
  // Host & Room Settings State
  const [isHost, setIsHost] = useState(false);
  const [roomSettings, setRoomSettings] = useState<RoomSettings>({ isLocked: false, waitingRoom: false });
  const [meetingStartedAt, setMeetingStartedAt] = useState<number | undefined>();
  const [waitingUsers, setWaitingUsers] = useState<WaitingUser[]>([]);
  const [showHostControls, setShowHostControls] = useState(false);

  // Hand Raise & Recording State
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [raisedHands, setRaisedHands] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // Media State
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoStopped, setIsVideoStopped] = useState(false);
  
  // Blur Hook
  const { finalStream, isBlurEnabled, toggleBlur } = useBackgroundBlur(localStream);
  
  // Live Captions Hook
  const { captions, isCaptionsEnabled, toggleCaptions } = useLiveCaptions(roomId, userId);

  // Meeting Recording Hook (100% Client-side MediaRecorder)
  const { isRecording, duration: recordingDuration, startRecording, stopRecording } = useMeetingRecorder();

  // UI State
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [whiteboardMode, setWhiteboardMode] = useState<'stage' | 'popup'>('popup');
  const [activeReactions, setActiveReactions] = useState<{ id: string; emoji: string; left: number; drift: number }[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [publicRooms, setPublicRooms] = useState<RoomInfo[]>([]);

  // Preview Video Ref
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 3000);
  };

  // 1-Click invite link detection in URL query string (?room=... or ?r=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room') || params.get('r');
    if (roomParam) {
      setRoomId(roomParam.trim());
      setMode('join');
      showToast(`Invited to join room #${roomParam.trim()}`);
    }
  }, []);

  useEffect(() => {
    const newUserId = generateId();
    setUserId(newUserId);
    
    // Connect initial socket
    signaling.connect(newUserId);
    
    // Listen for connection status
    const onConnect = () => {
        setIsConnected(true);
        signaling.emit('get-rooms'); // Fetch rooms on connect
    };
    const onDisconnect = () => setIsConnected(false);
    
    // Check initial state
    if (signaling.connected) setIsConnected(true);

    signaling.on('connect', onConnect);
    signaling.on('disconnect', onDisconnect);
    
    signaling.on('rooms-update', (rooms: RoomInfo[]) => {
      setPublicRooms(rooms);
      setIsRefreshingRooms(false);
    });
    
    // Waiting room & host events
    signaling.on('room-joined', (payload: { roomId: string; isHost: boolean; settings: RoomSettings }) => {
      setIsHost(payload.isHost);
      setRoomSettings(payload.settings);
      setMeetingStartedAt(payload.settings.startedAt);
      setMode('room');
    });
    
    signaling.on('room-locked', () => {
      setError('This room is locked. You cannot join.');
      setMode('home');
    });
    
    signaling.on('waiting-room', () => {
      setMode('waiting');
    });
    
    signaling.on('admitted', (payload: { roomId: string; isHost: boolean; settings: RoomSettings }) => {
      setIsHost(payload.isHost);
      setRoomSettings(payload.settings);
      setMeetingStartedAt(payload.settings.startedAt);
      setMode('room');
    });
    
    signaling.on('denied', () => {
      setMode('denied');
    });
    
    signaling.on('waiting-room-update', (payload: { roomId: string; waitingUsers: WaitingUser[] }) => {
      setWaitingUsers(payload.waitingUsers);
    });
    
    signaling.on('room-settings-update', (settings: RoomSettings) => {
      setRoomSettings(settings);
    });
    
    signaling.on('host-changed', (payload: { isHost: boolean }) => {
      setIsHost(payload.isHost);
    });
    
    signaling.on('room-closed', () => {
      setError('The room has been closed by the host.');
      setMode('home');
    });

    // Hand raise synchronization
    signaling.on('hand-raise-update', (payload: { userId: string; isRaised: boolean; userName: string }) => {
      setRaisedHands((prev) => {
        const next = new Set(prev);
        if (payload.isRaised) {
          next.add(payload.userId);
          sound.playHandRaiseChime();
          showToast(`✋ ${payload.userName || 'A participant'} raised their hand`);
        } else {
          next.delete(payload.userId);
        }
        return next;
      });
    });
    
    // Floating Emojis synchronization
    const triggerFloatingReaction = (emoji: string) => {
      if (!emoji) return;
      const id = `${Date.now()}-${Math.random()}`;
      const left = 20 + Math.random() * 60;
      const drift = (Math.random() - 0.5) * 80;
      setActiveReactions((prev) => [...prev.slice(-12), { id, emoji, left, drift }]);
      setTimeout(() => {
        setActiveReactions((prev) => prev.filter((r) => r.id !== id));
      }, 2600);
    };

    const handleReactionEvent = (reaction: Reaction) => {
      triggerFloatingReaction(reaction.emoji);
    };

    const handleLocalReactionEvent = (e: any) => {
      triggerFloatingReaction(e.detail?.emoji);
    };

    signaling.on('reaction', handleReactionEvent);
    window.addEventListener('local-reaction' as any, handleLocalReactionEvent);
    
    // Periodic refresh of rooms
    const interval = setInterval(() => {
        if (signaling.connected) {
            signaling.emit('get-rooms');
        }
    }, 5000);

    return () => {
      signaling.off('connect', onConnect);
      signaling.off('disconnect', onDisconnect);
      signaling.off('rooms-update');
      signaling.off('room-joined');
      signaling.off('room-locked');
      signaling.off('waiting-room');
      signaling.off('admitted');
      signaling.off('denied');
      signaling.off('waiting-room-update');
      signaling.off('room-settings-update');
      signaling.off('host-changed');
      signaling.off('room-closed');
      signaling.off('hand-raise-update');
      signaling.off('reaction', handleReactionEvent);
      window.removeEventListener('local-reaction' as any, handleLocalReactionEvent);
      clearInterval(interval);
    };
  }, []);

  const initMedia = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true
      });
      setLocalStream(stream);
      setIsLoading(false);
      return stream;
    } catch (err: any) {
      console.warn("Standard media constraints failed, falling back to basic audio/video", err);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        setIsLoading(false);
        return stream;
      } catch (e: any) {
        console.error("Camera access failed", e);
        setError("Camera/Microphone permission denied or device not found.");
        setIsLoading(false);
        return null;
      }
    }
  };

  useEffect(() => {
    if (mode === 'preview' && finalStream && previewVideoRef.current) {
        previewVideoRef.current.srcObject = finalStream;
    }
  }, [mode, finalStream]);

  const handleCreateRoomClick = () => {
      setRoomId(generateId());
      setRoomName('');
      setIsPublic(false);
      setWaitingRoomEnabled(false);
      setMode('create');
  };

  const handleProceedToPreview = async () => {
      if (!username.trim()) {
          setError('Please enter your name');
          return;
      }
      const stream = await initMedia();
      if (stream) setMode('preview');
  };

  const handleJoinPublicRoom = (room: RoomInfo) => {
    setRoomId(room.roomId);
    setRoomName(room.name || room.roomId);
    setIsPublic(true); 
    setWaitingRoomEnabled(!!room.waitingRoom);
    setMode('join'); 
  };

  const handleRefreshRooms = () => {
    setIsRefreshingRooms(true);
    if (signaling.connected) {
      signaling.emit('get-rooms');
    }
  };

  const handleEnterRoom = () => {
      if (localStream) {
          const config = { isPublic, name: roomName, waitingRoom: waitingRoomEnabled };
          signaling.emit('join-room', roomId, userId, config, username);
      }
  };
  
  // Host controls
  const handleAdmitUser = (odId: string) => {
    setWaitingUsers(prev => prev.filter(u => u.odId !== odId));
    signaling.emit('admit-user', { roomId, odId });
  };
  
  const handleDenyUser = (odId: string) => {
    setWaitingUsers(prev => prev.filter(u => u.odId !== odId));
    signaling.emit('deny-user', { roomId, odId });
  };

  const handleAdmitAll = () => {
    const list = [...waitingUsers];
    setWaitingUsers([]);
    list.forEach(u => {
      signaling.emit('admit-user', { roomId, odId: u.odId });
    });
  };
  
  const handleToggleLock = () => {
    signaling.emit('toggle-lock', { roomId });
  };
  
  const handleToggleWaitingRoom = () => {
    signaling.emit('toggle-waiting-room', { roomId });
  };

  const activeStream = useMemo(() => {
    if (screenStream) {
        const videoTrack = screenStream.getVideoTracks()[0];
        const audioTrack = localStream?.getAudioTracks()[0];
        
        const tracks = [];
        if (videoTrack) tracks.push(videoTrack);
        if (audioTrack) tracks.push(audioTrack);
        
        return new MediaStream(tracks);
    }
    return finalStream;
  }, [screenStream, finalStream, localStream]);

  const roomConfig = { isPublic, name: roomName, waitingRoom: waitingRoomEnabled };
  const { remoteStreams, connectionStats, peerNames, peerScreenShares, peerMediaStates } = useWebRTC(
      mode === 'room' ? roomId : '', 
      userId, 
      username, 
      activeStream, 
      !!screenStream, 
      isMuted,
      isVideoStopped,
      roomConfig
  );

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(t => t.enabled = !t.enabled);
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(t => t.enabled = !t.enabled);
      setIsVideoStopped(!isVideoStopped);
    }
  };

  const toggleScreenShare = async () => {
      if (screenStream) {
          screenStream.getTracks().forEach(t => t.stop());
          setScreenStream(null);
      } else {
          try {
              const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
              setScreenStream(stream);
              stream.getVideoTracks()[0].onended = () => {
                  setScreenStream(null);
              };
          } catch (e) {
              console.log("Cancelled screen share");
          }
      }
  };

  const switchMediaDevice = async (kind: 'videoinput' | 'audioinput', deviceId: string) => {
    if (!localStream) return;
    
    if (kind === 'videoinput') localStream.getVideoTracks().forEach(t => t.stop());
    if (kind === 'audioinput') localStream.getAudioTracks().forEach(t => t.stop());

    const constraints: MediaStreamConstraints = {
        audio: kind === 'audioinput' ? { deviceId: { exact: deviceId } } : { deviceId: localStream.getAudioTracks()[0]?.getSettings().deviceId },
        video: kind === 'videoinput' ? { deviceId: { exact: deviceId } } : { deviceId: localStream.getVideoTracks()[0]?.getSettings().deviceId }
    };
    
    try {
        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (isMuted) newStream.getAudioTracks().forEach(t => t.enabled = false);
        if (isVideoStopped) newStream.getVideoTracks().forEach(t => t.enabled = false);

        setLocalStream(newStream);
    } catch (e) {
        console.error("Failed to switch device", e);
    }
  };

  const togglePiP = async () => {
    try {
        if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
        } else {
            const videos = document.getElementsByTagName('video');
            if (videos.length > 0) {
                const target = videos.length > 1 ? videos[1] : videos[0];
                await target.requestPictureInPicture();
            }
        }
    } catch (e) {
        console.error("PiP failed", e);
    }
  };

  const handleReaction = (emoji: string) => {
      signaling.emit('reaction', {
          roomId,
          reaction: {
              senderId: userId,
              emoji,
              timestamp: Date.now()
          }
      });
      window.dispatchEvent(new CustomEvent('local-reaction', {
          detail: { userId, emoji }
      }));
  };

  const handleToggleRaiseHand = () => {
    const nextState = !isHandRaised;
    setIsHandRaised(nextState);
    if (nextState) sound.playHandRaiseChime();
    signaling.emit('raise-hand', {
      roomId,
      userId,
      isRaised: nextState,
      userName: username
    });
    setRaisedHands(prev => {
      const next = new Set(prev);
      if (nextState) next.add(userId);
      else next.delete(userId);
      return next;
    });
  };

  const handleToggleRecord = async () => {
    if (isRecording) {
      stopRecording();
      showToast('Meeting recording saved and downloaded (.webm)');
    } else {
      const started = await startRecording(activeStream);
      if (started) {
        showToast('Local meeting recording started');
      } else {
        showToast('Screen/Meeting capture cancelled or not allowed');
      }
    }
  };

  const handleCopyInvite = () => {
    const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    navigator.clipboard.writeText(inviteUrl);
    showToast('🔗 Invite link copied to clipboard!');
  };

  const leaveRoom = () => {
    if (isRecording) {
      stopRecording();
    }
    if (isHandRaised) {
      signaling.emit('raise-hand', { roomId, userId, isRaised: false, userName: username });
      setIsHandRaised(false);
    }
    setRaisedHands(new Set());

    if (roomId && userId) {
      signaling.emit('leave-room', { roomId, userId });
    }
    localStream?.getTracks().forEach(t => t.stop());
    screenStream?.getTracks().forEach(t => t.stop());
    setLocalStream(null);
    setScreenStream(null);
    setMode('left');
    setShowWhiteboard(false);
  };
  
  const handleRejoin = async () => {
     setMode('preview');
     await initMedia();
  };
  
  const handleGoHome = () => {
      setMode('home');
      setRoomId('');
      setRoomName('');
      setIsPublic(false);
      setWaitingRoomEnabled(false);
      setIsHost(false);
      setMeetingStartedAt(undefined);
      setWaitingUsers([]);
  };

  // --- Render Waiting Room ---
  if (mode === 'waiting') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-700 rounded-[22px] p-8 text-center space-y-6 shadow-[0_18px_40px_rgba(0,0,0,0.35)]">
          <div className="w-20 h-20 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
            <Clock className="w-10 h-10 text-amber-400 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white tracking-tight">Waiting for Host Approval</h2>
            <p className="text-zinc-400 text-sm">
              The host of this meeting has enabled a waiting room. You will be admitted shortly.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 text-zinc-400 text-xs py-2 px-4 rounded-full bg-zinc-800/60 border border-zinc-700/60 w-fit mx-auto">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>Waiting in queue...</span>
          </div>
          <button 
            onClick={handleGoHome} 
            className="w-full py-3.5 rounded-2xl bg-zinc-800 text-white font-medium hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <Home className="w-4 h-4" /> Leave Waiting Room
          </button>
        </div>
      </div>
    );
  }

  // --- Render Denied Screen ---
  if (mode === 'denied') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900 border border-rose-900/50 rounded-[22px] p-8 text-center space-y-6 shadow-[0_18px_40px_rgba(0,0,0,0.35)]">
          <div className="w-20 h-20 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
            <X className="w-10 h-10 text-rose-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white tracking-tight">Access Denied</h2>
            <p className="text-zinc-400 text-sm">
              The host was unable to admit you to this meeting session.
            </p>
          </div>
          <button 
            onClick={handleGoHome} 
            className="w-full py-3.5 rounded-2xl bg-white text-black font-bold hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <Home className="w-4 h-4" /> Back to Home
          </button>
        </div>
      </div>
    );
  }

  // --- Render In-Room ---
  if (mode === 'room') {
    return (
      <div className="h-screen w-full flex flex-col relative overflow-hidden bg-black text-white font-sans">
        {/* Floating Toast Notification */}
        {toastMessage && (
          <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-zinc-900/90 backdrop-blur-2xl border border-white/20 text-white text-xs font-semibold shadow-2xl flex items-center gap-2 animate-in slide-in-from-top-3 fade-in duration-200">
            <span>{toastMessage}</span>
          </div>
        )}

        <DynamicIsland 
          roomId={roomId}
          participantCount={(1) + remoteStreams.size}
          meetingStartedAt={meetingStartedAt}
          isMuted={isMuted}
          isVideoStopped={isVideoStopped}
          isRecording={isRecording}
          recordingDuration={recordingDuration}
          handRaiseCount={raisedHands.size}
          onCopyInvite={handleCopyInvite}
        />
        
        {/* Host Controls Button */}
        {isHost && (
          <div className="absolute top-4 sm:top-5 right-4 sm:right-6 z-40">
            <button
              onClick={() => setShowHostControls(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-zinc-900/90 border border-zinc-700 text-white hover:bg-zinc-800 transition-all shadow-xl backdrop-blur-md hover:scale-105"
              title="Host Controls"
            >
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-semibold">Host</span>
              {waitingUsers.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-amber-500 text-black text-[10px] font-bold flex items-center justify-center animate-pulse">
                  {waitingUsers.length}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Host Controls Modal */}
        <HostControlsModal
          isOpen={showHostControls}
          onClose={() => setShowHostControls(false)}
          roomId={roomId}
          roomSettings={roomSettings}
          waitingUsers={waitingUsers}
          onToggleLock={handleToggleLock}
          onToggleWaitingRoom={handleToggleWaitingRoom}
          onAdmitUser={handleAdmitUser}
          onDenyUser={handleDenyUser}
          onAdmitAll={handleAdmitAll}
        />

        <main className="flex-1 w-full h-full relative z-10 flex flex-col pt-16 sm:pt-20 pb-24 sm:pb-28 px-2 sm:px-4 min-h-0 overflow-hidden">
          {/* Dual Whiteboard & Video Grid Stage Mode */}
          {showWhiteboard && whiteboardMode === 'stage' ? (
            <div className="w-full h-full flex flex-col lg:flex-row gap-3 min-h-0 overflow-hidden">
              {/* Central Whiteboard Canvas Stage */}
              <div className="flex-1 h-full min-h-0 min-w-0 relative">
                <Whiteboard 
                  isOpen={true}
                  onClose={() => setShowWhiteboard(false)}
                  roomId={roomId}
                  mode="stage"
                  onToggleMode={() => setWhiteboardMode('popup')}
                  currentUserName={username}
                />
              </div>

              {/* Side Participant Video strip */}
              <div className="h-36 sm:h-44 lg:h-full lg:w-72 xl:w-80 shrink-0 min-h-0 overflow-y-auto overflow-x-auto bg-zinc-900 rounded-[22px] p-2 border border-zinc-700 flex items-center justify-center shadow-[0_12px_28px_rgba(0,0,0,0.25)]">
                {activeStream && (
                  <VideoGrid 
                    localStream={activeStream} 
                    remoteStreams={remoteStreams} 
                    myUserId={userId}
                    myUserName={username}
                    peerNames={peerNames}
                    connectionStats={connectionStats}
                    captions={captions}
                    peerScreenShares={peerScreenShares}
                    isLocalScreenShare={!!screenStream}
                    raisedHands={raisedHands}
                    localIsMuted={isMuted}
                    localIsVideoStopped={isVideoStopped}
                    peerMediaStates={peerMediaStates}
                  />
                )}
              </div>
            </div>
          ) : (
            <>
              {activeStream ? (
                <VideoGrid 
                  localStream={activeStream} 
                  remoteStreams={remoteStreams} 
                  myUserId={userId}
                  myUserName={username}
                  peerNames={peerNames}
                  connectionStats={connectionStats}
                  captions={captions}
                  peerScreenShares={peerScreenShares}
                  isLocalScreenShare={!!screenStream}
                  raisedHands={raisedHands}
                  localIsMuted={isMuted}
                  localIsVideoStopped={isVideoStopped}
                  peerMediaStates={peerMediaStates}
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full">
                  <Loader2 className="w-12 h-12 animate-spin text-zinc-700" />
                </div>
              )}

              {/* Popup Floating Whiteboard Mode */}
              <Whiteboard 
                isOpen={showWhiteboard && whiteboardMode === 'popup'}
                onClose={() => setShowWhiteboard(false)}
                roomId={roomId}
                mode="popup"
                onToggleMode={() => setWhiteboardMode('stage')}
                currentUserName={username}
              />
            </>
          )}

          {/* Room-wide Floating Emoji Reactions */}
          <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
            {activeReactions.map((r) => (
              <div
                key={r.id}
                style={{
                  left: `${r.left}%`,
                  ['--drift' as any]: `${r.drift}px`
                }}
                className="absolute bottom-28 text-5xl sm:text-6xl animate-float-up pointer-events-none select-none drop-shadow-2xl"
              >
                {r.emoji}
              </div>
            ))}
          </div>

          <Chat 
            isOpen={showChat} 
            onClose={() => setShowChat(false)} 
            roomId={roomId} 
            userId={userId} 
            myUserName={username}
            peerNames={peerNames}
          />
          
          <SettingsModal 
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
            currentCameraId={localStream?.getVideoTracks()[0]?.getSettings().deviceId}
            currentMicId={localStream?.getAudioTracks()[0]?.getSettings().deviceId}
            onDeviceChange={switchMediaDevice}
          />
        </main>

        <Controls
          isMuted={isMuted}
          isVideoStopped={isVideoStopped}
          isScreenSharing={!!screenStream}
          isBlurEnabled={isBlurEnabled}
          isCaptionsEnabled={isCaptionsEnabled}
          isHandRaised={isHandRaised}
          isRecording={isRecording}
          recordingDuration={recordingDuration}
          showChat={showChat}
          showWhiteboard={showWhiteboard}
          roomId={roomId}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
          onToggleScreenShare={toggleScreenShare}
          onToggleBlur={toggleBlur}
          onToggleCaptions={toggleCaptions}
          onTogglePiP={togglePiP}
          onToggleRaiseHand={handleToggleRaiseHand}
          onToggleRecord={handleToggleRecord}
          onCopyInvite={handleCopyInvite}
          onToggleChat={() => setShowChat(!showChat)}
          onToggleWhiteboard={() => setShowWhiteboard(!showWhiteboard)}
          onOpenSettings={() => setShowSettings(true)}
          onLeave={leaveRoom}
          onReaction={handleReaction}
        />
      </div>
    );
  }

  // --- Render Preview Screen ---
  if (mode === 'preview') {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
             <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-700 rounded-[22px] p-8 shadow-[0_18px_40px_rgba(0,0,0,0.35)] space-y-8">
                <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold text-white tracking-tight">Ready to join, {username}?</h2>
                    <p className="text-zinc-500">
                        {roomName ? `Joining "${roomName}"` : `Room Code: ${roomId}`}
                    </p>
                </div>

                <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl group">
                    <video ref={previewVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                    
                    <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex gap-4">
                        <button onClick={toggleMute} className={`p-4 rounded-full border transition-all ${isMuted ? 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20' : 'bg-zinc-900/80 border-zinc-700 text-white hover:bg-zinc-800'}`}>
                            {isMuted ? <MicOff className="w-6 h-6"/> : <Mic className="w-6 h-6"/>}
                        </button>
                        <button onClick={toggleVideo} className={`p-4 rounded-full border transition-all ${isVideoStopped ? 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20' : 'bg-zinc-900/80 border-zinc-700 text-white hover:bg-zinc-800'}`}>
                            {isVideoStopped ? <VideoOff className="w-6 h-6"/> : <VideoIcon className="w-6 h-6"/>}
                        </button>
                        <button onClick={toggleBlur} className={`p-4 rounded-full border transition-all ${isBlurEnabled ? 'bg-white text-black shadow-lg' : 'bg-zinc-900/80 border-zinc-700 text-white hover:bg-zinc-800'}`}>
                            <Sparkles className="w-6 h-6"/>
                        </button>
                    </div>
                </div>

                <div className="flex gap-4 justify-center">
                    <button onClick={handleGoHome} className="px-8 py-4 rounded-2xl font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleEnterRoom} className="px-10 py-4 rounded-2xl font-bold bg-white text-black hover:bg-zinc-200 transition-all transform hover:scale-105 shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                        Join Now
                    </button>
                </div>
             </div>
        </div>
      );
  }
  
  // --- Render Left Meeting Screen ---
  if (mode === 'left') {
      return (
          <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
              <div className="max-w-md w-full bg-zinc-900 border border-zinc-700 rounded-[22px] p-8 text-center space-y-6 shadow-[0_18px_40px_rgba(0,0,0,0.35)] animate-in fade-in zoom-in duration-300">
                  <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <VideoOff className="w-8 h-8 text-zinc-500" />
                  </div>
                  <h2 className="text-3xl font-bold text-white">You left the meeting</h2>
                  <p className="text-zinc-500">
                      Have a nice day, {username}! You can rejoin anytime.
                  </p>
                  
                  <div className="flex flex-col gap-3 pt-4">
                      <button onClick={handleRejoin} className="w-full py-4 rounded-2xl bg-white text-black font-bold hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2">
                          <RotateCcw className="w-4 h-4" /> Rejoin Meeting
                      </button>
                      <button onClick={handleGoHome} className="w-full py-4 rounded-2xl bg-zinc-800 text-white font-medium hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2">
                          <Home className="w-4 h-4" /> Back to Home
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  // --- Render Landing Page (Home) ---
  return (
    <div className="min-h-screen relative bg-black selection:bg-blue-500/30 pb-24 text-zinc-100 flex flex-col">
      {/* Dynamic Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:128px_128px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none fixed"></div>
      
      {/* Top Navigation Bar */}
      <Navbar isConnected={isConnected} onRefreshRooms={handleRefreshRooms} />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-zinc-900/90 backdrop-blur-2xl border border-white/20 text-white text-xs font-semibold shadow-2xl flex items-center gap-2 animate-in slide-in-from-top-3 fade-in duration-200">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 pt-28 sm:pt-36 relative z-10 space-y-16">
        
        {/* Hero Section */}
        <section className="text-center space-y-4 max-w-2xl mx-auto pt-2 sm:pt-4">
          <div className="space-y-3">
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-200 to-zinc-500">
                MeshMeet
            </h1>
            <p className="text-zinc-400 text-lg sm:text-xl font-normal max-w-lg mx-auto leading-relaxed">
                Peer-to-peer, encrypted video meetings powered by WebRTC mesh networks.
            </p>
          </div>
        </section>

        {/* Error Banner */}
        {error && (
            <div className="max-w-md mx-auto p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm text-center font-medium animate-in slide-in-from-top-2">
                {error}
            </div>
        )}

        {/* Action Card */}
        <section className="max-w-md mx-auto bg-zinc-900 border border-zinc-700 rounded-[22px] p-2 shadow-[0_18px_38px_rgba(0,0,0,0.3)] transition-all hover:border-zinc-600">
          
          {mode === 'home' && (
             <div className="p-6 space-y-4">
                <button 
                  onClick={handleCreateRoomClick}
                  disabled={isLoading}
                  className="group w-full h-16 rounded-2xl bg-white text-black font-bold text-lg hover:bg-zinc-200 transition-all flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(255,255,255,0.15)] hover:shadow-[0_0_40px_rgba(255,255,255,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />}
                    Start New Meeting
                </button>

                <button 
                  onClick={() => setMode('join')}
                  className="w-full h-14 rounded-2xl bg-zinc-800/60 text-white font-medium hover:bg-zinc-800 transition-all flex items-center justify-center gap-3 border border-zinc-700/60 hover:border-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <Keyboard className="w-4 h-4 text-zinc-400" />
                  Join with Code
                </button>
             </div>
          )}

          {mode === 'create' && (
              <form onSubmit={(e) => { e.preventDefault(); handleProceedToPreview(); }} className="p-6 space-y-5">
                 <div className="space-y-4">
                     <div>
                        <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1 mb-2">Your Display Name</label>
                        <div className="relative">
                            <UserIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
                            <input
                                type="text"
                                required
                                autoFocus
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="e.g. Ayaan"
                                className="w-full bg-black/60 border border-zinc-700/80 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white/50 transition-all"
                            />
                        </div>
                     </div>

                     <div>
                        <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1 mb-2">Room Name (Optional)</label>
                        <input
                            type="text"
                            value={roomName}
                            onChange={(e) => setRoomName(e.target.value)}
                            placeholder="e.g. Engineering Standup"
                            className="w-full bg-black/60 border border-zinc-700/80 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white/50 transition-all"
                        />
                     </div>
                     
                     <div className="flex gap-2 p-1 bg-black/60 border border-zinc-800 rounded-xl">
                         <button 
                           type="button" 
                           onClick={() => setIsPublic(false)}
                           className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${!isPublic ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}
                         >
                            <Lock className="w-3.5 h-3.5" /> Private
                         </button>
                         <button 
                           type="button" 
                           onClick={() => setIsPublic(true)}
                           className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${isPublic ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}
                         >
                            <Globe className="w-3.5 h-3.5" /> Public
                         </button>
                     </div>

                     {/* Waiting Room Toggle */}
                     <label className="flex items-center justify-between p-3.5 bg-black/60 border border-zinc-800 rounded-xl cursor-pointer hover:border-zinc-700 transition-all">
                         <div className="flex items-center gap-3">
                             <DoorOpen className="w-4 h-4 text-zinc-400" />
                             <div>
                                 <span className="text-xs font-semibold text-white">Waiting Room</span>
                                 <p className="text-[11px] text-zinc-500">Approve users before they join</p>
                             </div>
                         </div>
                         <div className="relative">
                             <input 
                                 type="checkbox" 
                                 checked={waitingRoomEnabled} 
                                 onChange={(e) => setWaitingRoomEnabled(e.target.checked)}
                                 className="sr-only peer"
                             />
                             <div className="w-10 h-5 bg-zinc-700 rounded-full peer peer-checked:bg-blue-600 transition-colors"></div>
                             <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-md transform peer-checked:translate-x-5 transition-transform"></div>
                         </div>
                     </label>
                 </div>

                 <div className="flex gap-3 pt-2">
                   <button 
                     type="button"
                     onClick={() => setMode('home')}
                     className="rounded-2xl bg-transparent border border-zinc-800 px-5 py-3.5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all font-semibold text-sm"
                   >
                     Back
                   </button>
                   <button 
                     type="submit"
                     disabled={!username.trim()}
                     className="flex-1 rounded-2xl bg-white text-black py-3.5 px-5 font-bold text-sm transition-all flex items-center justify-center gap-2 hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                     Create Meeting <ArrowRight className="w-4 h-4" />
                   </button>
                 </div>
              </form>
          )}

          {mode === 'join' && (
            <form onSubmit={(e) => { e.preventDefault(); handleProceedToPreview(); }} className="p-6 space-y-4">
               <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1 mb-2">Room Code</label>
                        <input
                            type="text"
                            required
                            autoFocus
                            value={roomId}
                            onChange={(e) => setRoomId(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                            placeholder="e.g. x8k29a"
                            className="w-full bg-black/60 border border-zinc-700/80 rounded-2xl px-4 py-3.5 text-white placeholder-zinc-600 focus:outline-none focus:border-white/50 transition-all font-mono text-base tracking-wider"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1 mb-2">Your Display Name</label>
                        <div className="relative">
                            <UserIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
                            <input
                                type="text"
                                required
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="e.g. Ayaan"
                                className="w-full bg-black/60 border border-zinc-700/80 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white/50 transition-all"
                            />
                        </div>
                    </div>
               </div>
               
               <div className="grid grid-cols-2 gap-3 pt-3">
                 <button 
                   type="button"
                   onClick={() => setMode('home')}
                   className="rounded-2xl bg-transparent border border-zinc-800 p-3.5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all text-sm font-semibold"
                 >
                   Back
                 </button>
                 <button 
                   type="submit"
                   disabled={isLoading || !roomId.trim() || !username.trim()}
                   className="rounded-2xl bg-white text-black p-3.5 font-bold transition-all flex items-center justify-center gap-2 hover:bg-zinc-200 shadow-md disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                 >
                   {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Join <ArrowRight className="w-4 h-4" /></>}
                 </button>
               </div>
            </form>
          )}
        </section>
        
        {/* Rebuilt Public Rooms Section */}
        {mode === 'home' && (
          <PublicRoomsHub
            rooms={publicRooms}
            onJoinRoom={handleJoinPublicRoom}
            onCreateRoom={handleCreateRoomClick}
            onRefresh={handleRefreshRooms}
            isRefreshing={isRefreshingRooms}
          />
        )}

        {/* Feature Highlights Row */}
        <section className="flex flex-wrap justify-center items-center gap-6 sm:gap-10 py-6 border-t border-zinc-900 text-zinc-500">
            <div className="flex items-center gap-2 text-xs font-medium">
                <ShieldCheck className="w-4 h-4 text-zinc-400" />
                <span>End-to-End Encrypted</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium">
                <Sparkles className="w-4 h-4 text-zinc-400" />
                <span>P2P Mesh Network</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium">
                <Radio className="w-4 h-4 text-zinc-400" />
                <span>Sub-100ms WebRTC</span>
            </div>
        </section>
      </main>
      
      {/* Footer Branding */}
      <footer className="fixed bottom-4 left-0 right-0 z-30 text-center pointer-events-none">
          <div className="inline-flex items-center gap-2 bg-black/80 backdrop-blur-xl px-5 py-2 rounded-full border border-zinc-800 shadow-2xl pointer-events-auto hover:bg-black transition-colors">
            <Copyright className="w-3 h-3 text-zinc-500" />
            <span className="text-[10px] text-zinc-400 font-medium font-mono uppercase tracking-widest">
                2026 MeetMesh
            </span>
            <div className="w-px h-3 bg-zinc-800 mx-1"></div>
            <span className="text-[10px] text-zinc-400 font-medium font-mono">
                Made by <span className="text-blue-400 font-bold ml-0.5">Mistiz911</span>
            </span>
          </div>
      </footer>
    </div>
  );
};

export default App;
