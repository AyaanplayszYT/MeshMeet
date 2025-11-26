import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Video, Plus, ArrowRight, Loader2, Sparkles, Keyboard, ShieldCheck, Mic, MicOff, Video as VideoIcon, VideoOff, Users, Globe, Lock, RotateCcw, Home, Copyright, User as UserIcon, Wifi, WifiOff } from 'lucide-react';
import { useWebRTC } from './hooks/useWebRTC';
import { useBackgroundBlur } from './hooks/useBackgroundBlur';
import { useLiveCaptions } from './hooks/useLiveCaptions';
import VideoGrid from './components/VideoGrid';
import Controls from './components/Controls';
import DynamicIsland from './components/DynamicIsland';
import Chat from './components/Chat';
import Whiteboard from './components/Whiteboard';
import SettingsModal from './components/SettingsModal';
import { signaling } from './services/socket';
import { RoomInfo } from './types';

const generateId = () => Math.random().toString(36).substr(2, 6);

const App = () => {
  // App State
  const [mode, setMode] = useState<'home' | 'join' | 'create' | 'preview' | 'room' | 'left'>('home');
  
  const [roomId, setRoomId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  
  const [userId, setUserId] = useState('');
  const [username, setUsername] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  
  // Media State
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoStopped, setIsVideoStopped] = useState(false);
  
  // Blur Hook
  const { finalStream, isBlurEnabled, toggleBlur } = useBackgroundBlur(localStream);
  
  // Live Captions Hook
  const { captions, isCaptionsEnabled, toggleCaptions } = useLiveCaptions(roomId, userId);

  // UI State
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [publicRooms, setPublicRooms] = useState<RoomInfo[]>([]);

  // Preview Video Ref
  const previewVideoRef = useRef<HTMLVideoElement>(null);

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
    });
    
    // Periodic refresh of rooms
    const interval = setInterval(() => {
        // Only request if connected to avoid queue buildup if offline
        if (signaling.connected) {
            signaling.emit('get-rooms');
        }
    }, 5000);

    return () => {
      signaling.off('connect', onConnect);
      signaling.off('disconnect', onDisconnect);
      signaling.off('rooms-update');
      clearInterval(interval);
    }
  }, []);

  // Manage body scroll based on mode
  useEffect(() => {
    if (mode === 'room') {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [mode]);

  // Cleanup on page unload (browser close, refresh, navigate away)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (mode === 'room' && roomId && userId) {
        signaling.emit('leave-room', { roomId, userId });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Also emit on component unmount
      if (mode === 'room' && roomId && userId) {
        signaling.emit('leave-room', { roomId, userId });
      }
    };
  }, [mode, roomId, userId]);

  // Initialize camera for preview or join
  const initMedia = async () => {
    setIsLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setLocalStream(stream);
      setError(null);
      return stream;
    } catch (err) {
      console.error('Error accessing media:', err);
      setError('Camera/Microphone access denied.');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Attach stream to preview video element
    if (mode === 'preview' && finalStream && previewVideoRef.current) {
        previewVideoRef.current.srcObject = finalStream;
    }
  }, [mode, finalStream]);

  const handleCreateRoomClick = () => {
      setRoomId(generateId());
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

  const handleJoinPublicRoom = async (room: RoomInfo) => {
    setRoomId(room.roomId);
    setRoomName(room.name || room.roomId);
    setIsPublic(true); 
    setMode('join'); 
  }

  const handleEnterRoom = () => {
      if (localStream) {
          setMode('room');
      }
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

  const roomConfig = { isPublic, name: roomName };
  const { remoteStreams, connectionStats, peerNames, peerScreenShares } = useWebRTC(
      mode === 'room' ? roomId : '', 
      userId, 
      username, 
      activeStream, 
      !!screenStream, 
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

  const leaveRoom = () => {
    // Notify server that we're leaving the room
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
  };

  // --- Render In-Room ---
  if (mode === 'room') {
    return (
      <div className="h-screen w-full flex flex-col relative overflow-hidden bg-black text-white font-sans">
        <DynamicIsland 
          roomId={roomId}
          participantCount={(1) + remoteStreams.size} // 1 is self
          isMuted={isMuted}
          isVideoStopped={isVideoStopped}
        />

        <main className="flex-1 w-full h-full relative z-10 flex flex-col">
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
             />
           ) : (
             <div className="flex items-center justify-center w-full h-full">
                <Loader2 className="w-12 h-12 animate-spin text-zinc-700" />
             </div>
           )}

           <Chat 
             isOpen={showChat} 
             onClose={() => setShowChat(false)} 
             roomId={roomId} 
             userId={userId} 
             myUserName={username}
             peerNames={peerNames}
            />

            <Whiteboard 
              isOpen={showWhiteboard}
              onClose={() => setShowWhiteboard(false)}
              roomId={roomId}
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
          showChat={showChat}
          showWhiteboard={showWhiteboard}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
          onToggleScreenShare={toggleScreenShare}
          onToggleBlur={toggleBlur}
          onToggleCaptions={toggleCaptions}
          onTogglePiP={togglePiP}
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
             <div className="w-full max-w-2xl bg-zinc-900/50 backdrop-blur-3xl border border-zinc-800 rounded-[32px] p-8 shadow-2xl space-y-8 animate-float">
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
              <div className="max-w-md w-full bg-zinc-900/30 border border-zinc-800 rounded-3xl p-8 text-center space-y-6 backdrop-blur-xl animate-in fade-in zoom-in duration-300">
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
    <div className="min-h-screen p-4 relative bg-black selection:bg-blue-500/30 pb-20">
      
      {/* Dynamic Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:128px_128px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none fixed"></div>
      
      <div className="max-w-4xl mx-auto pt-10 relative z-10 space-y-12">
        
        {/* Connection Status Badge */}
        <div className="flex justify-end">
             <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-md transition-colors ${isConnected ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                 {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                 <span className="text-xs font-bold uppercase tracking-wider">{isConnected ? 'Online' : 'Offline'}</span>
             </div>
        </div>

        {/* Header */}
        <div className="text-center space-y-6">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-zinc-900 border border-zinc-800 mb-2 shadow-[0_0_40px_rgba(255,255,255,0.05)] animate-float">
             <Video className="w-12 h-12 text-white" />
          </div>
          <div className="space-y-4">
            <h1 className="text-7xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-500">
                MeshMeet
            </h1>
            <p className="text-zinc-500 text-xl font-medium max-w-md mx-auto">
                Secure, peer-to-peer video calls with zero server footprint.
            </p>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
            <div className="max-w-md mx-auto p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm text-center font-medium animate-in slide-in-from-top-2">
                {error}
            </div>
        )}

        {/* Action Card */}
        <div className="max-w-md mx-auto bg-zinc-900/30 backdrop-blur-xl border border-zinc-800/50 p-2 rounded-[32px] shadow-2xl transition-all hover:border-zinc-700/50">
          
          {mode === 'home' && (
             <div className="p-6 space-y-4">
                <button 
                  onClick={handleCreateRoomClick}
                  disabled={isLoading}
                  className="group w-full h-20 rounded-2xl bg-white text-black font-bold text-xl hover:bg-zinc-200 transition-all flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform" />}
                    Start New Meeting
                </button>

                <button 
                  onClick={() => setMode('join')}
                  className="w-full h-16 rounded-2xl bg-zinc-800/50 text-white font-medium hover:bg-zinc-800 transition-all flex items-center justify-center gap-3 border border-zinc-700/50 hover:border-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Keyboard className="w-5 h-5 text-zinc-400" />
                  Join with Code
                </button>
             </div>
          )}

          {mode === 'create' && (
              <form onSubmit={(e) => { e.preventDefault(); handleProceedToPreview(); }} className="p-6 space-y-6">
                 <div className="space-y-4">
                     <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1 mb-2">Your Name</label>
                        <div className="relative">
                            <UserIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-500" />
                            <input
                                type="text"
                                required
                                autoFocus
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="e.g. John Doe"
                                className="w-full bg-black/50 border border-zinc-700 rounded-2xl pl-12 pr-5 py-4 text-white placeholder-zinc-700 focus:outline-none focus:border-white/50 transition-all"
                            />
                        </div>
                     </div>

                     <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1 mb-2">Room Name (Optional)</label>
                        <input
                            type="text"
                            value={roomName}
                            onChange={(e) => setRoomName(e.target.value)}
                            placeholder="e.g. Daily Standup"
                            className="w-full bg-black/50 border border-zinc-700 rounded-2xl px-5 py-4 text-white placeholder-zinc-700 focus:outline-none focus:border-white/50 transition-all"
                        />
                     </div>
                     
                     <div className="flex gap-2 p-1 bg-black/50 border border-zinc-800 rounded-xl">
                         <button 
                           type="button" 
                           onClick={() => setIsPublic(false)}
                           className={`flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${!isPublic ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}
                         >
                            <Lock className="w-4 h-4" /> Private
                         </button>
                         <button 
                           type="button" 
                           onClick={() => setIsPublic(true)}
                           className={`flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${isPublic ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}
                         >
                            <Globe className="w-4 h-4" /> Public
                         </button>
                     </div>
                 </div>

                 <div className="flex gap-3">
                   <button 
                     type="button"
                     onClick={() => setMode('home')}
                     className="rounded-2xl bg-transparent border border-zinc-800 px-6 py-4 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all font-bold"
                   >
                     Back
                   </button>
                   <button 
                     type="submit"
                     disabled={!username.trim()}
                     className="flex-1 rounded-2xl bg-white text-black p-4 font-bold transition-all flex items-center justify-center gap-2 hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                     Create <ArrowRight className="w-5 h-5" />
                   </button>
                 </div>
              </form>
          )}

          {mode === 'join' && (
            <form onSubmit={(e) => { e.preventDefault(); handleProceedToPreview(); }} className="p-6 space-y-4">
               <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1 mb-2">Room Code</label>
                        <input
                            type="text"
                            required
                            autoFocus
                            value={roomId}
                            // FIXED: Force lowercase and remove any spaces/symbols to prevent ID mismatches
                            onChange={(e) => setRoomId(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                            placeholder="x8k29a"
                            className="w-full bg-black/50 border border-zinc-700 rounded-2xl px-5 py-4 text-white placeholder-zinc-700 focus:outline-none focus:border-white/50 transition-all font-mono text-xl tracking-wide"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1 mb-2">Your Name</label>
                        <div className="relative">
                            <UserIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-500" />
                            <input
                                type="text"
                                required
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="e.g. Jane Doe"
                                className="w-full bg-black/50 border border-zinc-700 rounded-2xl pl-12 pr-5 py-4 text-white placeholder-zinc-700 focus:outline-none focus:border-white/50 transition-all"
                            />
                        </div>
                    </div>
               </div>
               
               <div className="grid grid-cols-2 gap-3 pt-4">
                 <button 
                   type="button"
                   onClick={() => setMode('home')}
                   className="rounded-2xl bg-transparent border border-zinc-800 p-4 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all text-sm font-bold"
                 >
                   Back
                 </button>
                 <button 
                   type="submit"
                   disabled={isLoading || !roomId.trim() || !username.trim()}
                   className="rounded-2xl bg-white text-black p-4 font-bold transition-all flex items-center justify-center gap-2 hover:bg-zinc-200 shadow-lg shadow-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Join <ArrowRight className="w-5 h-5" /></>}
                 </button>
               </div>
            </form>
          )}
        </div>
        
        {/* Public Rooms Section */}
        {mode === 'home' && (
            <div className="space-y-6">
                <div className="flex items-center gap-3 px-2">
                    <Globe className="w-5 h-5 text-blue-500" />
                    <h3 className="text-xl font-bold text-white">Active Public Rooms</h3>
                    <div className="h-px flex-1 bg-zinc-800" />
                </div>
                
                {publicRooms.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-zinc-800 rounded-3xl">
                        <p className="text-zinc-600">No public rooms active right now.</p>
                        <button onClick={handleCreateRoomClick} className="text-blue-500 hover:text-blue-400 text-sm font-medium mt-2">Be the first to create one</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {publicRooms.map((room) => (
                            <div key={room.roomId} className="group bg-zinc-900/50 border border-zinc-800 hover:border-zinc-600 p-5 rounded-2xl transition-all hover:bg-zinc-900 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Users className="w-16 h-16 text-white" />
                                </div>
                                <div className="relative z-10 space-y-4">
                                    <div>
                                        <h4 className="font-bold text-lg text-white group-hover:text-blue-400 transition-colors truncate">{room.name}</h4>
                                        <p className="text-zinc-500 text-xs font-mono">ID: {room.roomId}</p>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-zinc-400 text-sm bg-black/50 px-3 py-1 rounded-full border border-zinc-800">
                                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                            {room.count} Online
                                        </div>
                                        <button 
                                          onClick={() => handleJoinPublicRoom(room)}
                                          className="bg-white text-black px-4 py-2 rounded-xl text-sm font-bold hover:scale-105 transition-transform"
                                        >
                                            Join
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

        <div className="flex justify-center gap-8 opacity-40 pt-10 pb-20">
            <div className="flex items-center gap-2 text-xs text-zinc-500 font-medium">
                <ShieldCheck className="w-4 h-4 text-zinc-600" />
                <span>End-to-End Encrypted</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-500 font-medium">
                <Sparkles className="w-4 h-4 text-zinc-600" />
                <span>P2P Mesh Network</span>
            </div>
        </div>
      </div>
      
      {/* Footer Branding */}
      <footer className="fixed bottom-4 left-0 right-0 z-50 text-center pointer-events-none">
          <div className="inline-flex items-center gap-2 bg-black/60 backdrop-blur-xl px-5 py-2.5 rounded-full border border-zinc-800/80 shadow-2xl pointer-events-auto hover:bg-black/80 transition-colors">
            <Copyright className="w-3 h-3 text-zinc-600" />
            <span className="text-[10px] text-zinc-400 font-medium font-mono uppercase tracking-widest">
                2025 MeshMeet
            </span>
            <div className="w-px h-3 bg-zinc-700 mx-1"></div>
            <span className="text-[10px] text-zinc-500 font-medium font-mono">
                Made by <span className="text-blue-400 font-bold ml-0.5 glow-text">Mistiz911</span>
            </span>
          </div>
      </footer>
    </div>
  );
};

export default App;