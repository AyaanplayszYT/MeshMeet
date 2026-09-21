

import { useEffect, useRef, useState, useCallback } from 'react';
import { signaling } from '../services/socket';
import { ConnectionStats } from '../types';
import { sound } from '../services/sound';

const STUN_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    { urls: 'stun:stun.relay.metered.ca:80' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
};

interface RoomConfig {
  isPublic: boolean;
  name: string;
}

export const useWebRTC = (
  roomId: string, 
  userId: string, 
  userName: string, 
  localStream: MediaStream | null, 
  isScreenShare: boolean, 
  isMuted: boolean = false,
  isVideoStopped: boolean = false,
  config?: RoomConfig
) => {
  const [peers, setPeers] = useState<Map<string, RTCPeerConnection>>(new Map());
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [connectionStats, setConnectionStats] = useState<Map<string, ConnectionStats>>(new Map());
  const [peerNames, setPeerNames] = useState<Map<string, string>>(new Map());
  const [peerScreenShares, setPeerScreenShares] = useState<Map<string, boolean>>(new Map());
  const [peerMediaStates, setPeerMediaStates] = useState<Map<string, { isMuted: boolean; isVideoStopped: boolean }>>(new Map());
  
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const isScreenShareRef = useRef<boolean>(isScreenShare);
  const isMutedRef = useRef<boolean>(isMuted);
  const isVideoStoppedRef = useRef<boolean>(isVideoStopped);
  
  // Store previous stats to calculate deltas (loss percentage)
  const prevStatsRef = useRef<Map<string, { packetsLost: number, packetsReceived: number }>>(new Map());

  // Update refs when local media state changes
  useEffect(() => {
    isScreenShareRef.current = isScreenShare;
    if (roomId && userId) {
      signaling.emit('screen-share-state', { roomId, isScreenShare });
    }
  }, [roomId, userId, isScreenShare]);

  useEffect(() => {
    isMutedRef.current = isMuted;
    isVideoStoppedRef.current = isVideoStopped;
    if (roomId && userId) {
      signaling.emit('peer-media-state', { roomId, isMuted, isVideoStopped });
    }
  }, [roomId, userId, isMuted, isVideoStopped]);

  // Handle stream switching (e.g. Camera -> Screen Share)
  useEffect(() => {
    if (!localStream) {
      localStreamRef.current = null;
      return;
    }

    const videoTrack = localStream.getVideoTracks()[0];
    const audioTrack = localStream.getAudioTracks()[0];

    peersRef.current.forEach(async (pc) => {
      const senders = pc.getSenders();
      const videoSender = senders.find(s => s.track?.kind === 'video');
      const audioSender = senders.find(s => s.track?.kind === 'audio');

      if (videoSender && videoTrack && videoSender.track !== videoTrack) {
        try {
          await videoSender.replaceTrack(videoTrack);
        } catch (err) {
          console.error('Error replacing video track', err);
        }
      }
      if (audioSender && audioTrack && audioSender.track !== audioTrack) {
        try {
          await audioSender.replaceTrack(audioTrack);
        } catch (err) {
          console.error('Error replacing audio track', err);
        }
      }
    });

    localStreamRef.current = localStream;
  }, [localStream]);

  // Periodic Stats Gathering
  useEffect(() => {
    const interval = setInterval(async () => {
        if (peersRef.current.size === 0) return;

        const nextStats = new Map<string, ConnectionStats>();

        for (const [peerId, pc] of peersRef.current) {
            try {
                const stats = await pc.getStats();
                let rtt = 0;
                let jitter = 0;
                let cumulativeLoss = 0;
                let cumulativeReceived = 0;
                let resolution = '';
                let frameRate = 0;

                stats.forEach(report => {
                    // Check for active candidate pair to get RTT
                    if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                        // currentRoundTripTime is in seconds
                        rtt = report.currentRoundTripTime ? report.currentRoundTripTime * 1000 : 0;
                    }
                    // Check inbound-rtp for video stats (jitter/loss)
                    if (report.type === 'inbound-rtp' && report.kind === 'video') {
                        jitter = report.jitter ? report.jitter * 1000 : 0;
                        cumulativeLoss = report.packetsLost || 0;
                        cumulativeReceived = report.packetsReceived || 0;
                        
                        if (report.frameWidth && report.frameHeight) {
                            resolution = `${report.frameWidth}x${report.frameHeight}`;
                        }
                        if (report.framesPerSecond) {
                            frameRate = Math.round(report.framesPerSecond);
                        }
                    }
                });

                // Calculate Loss Percentage based on delta from previous interval
                const prev = prevStatsRef.current.get(peerId) || { packetsLost: 0, packetsReceived: 0 };
                
                const deltaLost = cumulativeLoss - prev.packetsLost;
                const deltaReceived = cumulativeReceived - prev.packetsReceived;
                const totalPackets = deltaLost + deltaReceived;
                
                let lossPercentage = 0;
                if (totalPackets > 0) {
                    lossPercentage = (deltaLost / totalPackets) * 100;
                }

                // Update previous stats
                prevStatsRef.current.set(peerId, { packetsLost: cumulativeLoss, packetsReceived: cumulativeReceived });

                nextStats.set(peerId, { 
                    rtt, 
                    jitter, 
                    packetsLost: cumulativeLoss,
                    packetLossPercentage: lossPercentage,
                    resolution,
                    frameRate
                });
            } catch (e) {
                console.warn(`Failed to get stats for peer ${peerId}`, e);
            }
        }
        setConnectionStats(nextStats);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const createPeerConnection = useCallback((targetUserId: string, initiator: boolean) => {
    if (peersRef.current.has(targetUserId)) {
        console.warn(`Peer connection already exists for ${targetUserId}`);
        return peersRef.current.get(targetUserId);
    }

    const pc = new RTCPeerConnection(STUN_SERVERS);
    
    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        if (localStreamRef.current) {
            pc.addTrack(track, localStreamRef.current);
        }
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        signaling.emit('ice-candidate', {
          targetUserId: targetUserId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      setRemoteStreams((prev) => {
        const newMap = new Map(prev);
        newMap.set(targetUserId, remoteStream);
        return newMap;
      });
    };

    peersRef.current.set(targetUserId, pc);
    setPeers(new Map(peersRef.current));

    return pc;
  }, []);

  const handleUserConnected = useCallback(async (newUserId: string) => {
    console.log('User connected:', newUserId);
    sound.playJoinChime();
    const pc = createPeerConnection(newUserId, true);
    if (pc) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        signaling.emit('offer', {
            targetUserId: newUserId,
            userName: userName,
            isScreenShare: isScreenShareRef.current,
            isMuted: isMutedRef.current,
            isVideoStopped: isVideoStoppedRef.current,
            offer: offer
        });
    }
  }, [createPeerConnection, userName]);

  const handleOffer = useCallback(async (callerId: string, callerName: string, isScreenShareRemote: boolean, offer: RTCSessionDescriptionInit, isMutedRemote?: boolean, isVideoStoppedRemote?: boolean) => {
    console.log(`Received offer from ${callerId} (${callerName})`);
    
    setPeerNames(prev => {
        const newMap = new Map(prev);
        newMap.set(callerId, callerName);
        return newMap;
    });
    
    setPeerScreenShares(prev => {
        const newMap = new Map(prev);
        newMap.set(callerId, isScreenShareRemote);
        return newMap;
    });

    if (isMutedRemote !== undefined || isVideoStoppedRemote !== undefined) {
      setPeerMediaStates(prev => {
        const newMap = new Map(prev);
        newMap.set(callerId, { isMuted: !!isMutedRemote, isVideoStopped: !!isVideoStoppedRemote });
        return newMap;
      });
    }

    const pc = createPeerConnection(callerId, false);
    if (pc) {
        // If we already have a connection, setRemoteDescription works for renegotiation too
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        signaling.emit('answer', {
            targetUserId: callerId,
            userName: userName,
            isScreenShare: isScreenShareRef.current,
            isMuted: isMutedRef.current,
            isVideoStopped: isVideoStoppedRef.current,
            answer: answer
        });
    }
  }, [createPeerConnection, userName]);

  const handleAnswer = useCallback(async (callerId: string, callerName: string, isScreenShareRemote: boolean, answer: RTCSessionDescriptionInit, isMutedRemote?: boolean, isVideoStoppedRemote?: boolean) => {
    console.log(`Received answer from ${callerId} (${callerName})`);
    
    setPeerNames(prev => {
        const newMap = new Map(prev);
        newMap.set(callerId, callerName);
        return newMap;
    });

    setPeerScreenShares(prev => {
        const newMap = new Map(prev);
        newMap.set(callerId, isScreenShareRemote);
        return newMap;
    });

    if (isMutedRemote !== undefined || isVideoStoppedRemote !== undefined) {
      setPeerMediaStates(prev => {
        const newMap = new Map(prev);
        newMap.set(callerId, { isMuted: !!isMutedRemote, isVideoStopped: !!isVideoStoppedRemote });
        return newMap;
      });
    }

    const pc = peersRef.current.get(callerId);
    if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }, []);

  const handleIceCandidate = useCallback(async (callerId: string, candidate: RTCIceCandidateInit) => {
    const pc = peersRef.current.get(callerId);
    if (pc) {
        try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
            console.error('Error adding received ice candidate', e);
        }
    }
  }, []);

  const handleUserDisconnected = useCallback((disconnectedUserId: string) => {
    console.log('User disconnected:', disconnectedUserId);
    sound.playLeaveChime();
    const pc = peersRef.current.get(disconnectedUserId);
    if (pc) {
        pc.close();
        peersRef.current.delete(disconnectedUserId);
        setPeers(new Map(peersRef.current));
        
        setRemoteStreams((prev) => {
            const newMap = new Map(prev);
            newMap.delete(disconnectedUserId);
            return newMap;
        });
        
        setConnectionStats(prev => {
            const newStats = new Map(prev);
            newStats.delete(disconnectedUserId);
            return newStats;
        });

        setPeerNames(prev => {
            const newMap = new Map(prev);
            newMap.delete(disconnectedUserId);
            return newMap;
        });

        setPeerScreenShares(prev => {
            const newMap = new Map(prev);
            newMap.delete(disconnectedUserId);
            return newMap;
        });

        setPeerMediaStates(prev => {
            const newMap = new Map(prev);
            newMap.delete(disconnectedUserId);
            return newMap;
        });
        
        prevStatsRef.current.delete(disconnectedUserId);
    }
  }, []);

  useEffect(() => {
    if (!roomId || !userId) return; // Wait for room join

    signaling.connect(userId);
    // Pass config if available
    signaling.emit('join-room', roomId, userId, config);

    signaling.on('user-connected', (data: any) => {
        const targetId = typeof data === 'string' ? data : data.senderId;
        if(targetId && targetId !== userId) {
          handleUserConnected(targetId);
          // Broadcast our media state to newly connected peer
          signaling.emit('peer-media-state', {
            roomId,
            isMuted: isMutedRef.current,
            isVideoStopped: isVideoStoppedRef.current
          });
        }
    });

    signaling.on('offer', (payload: any) => {
        if (payload.targetUserId === userId || payload.targetUserId === 'all') {
             handleOffer(payload.callerId, payload.userName, payload.isScreenShare, payload.offer, payload.isMuted, payload.isVideoStopped);
        }
    });

    signaling.on('answer', (payload: any) => {
        if (payload.targetUserId === userId) {
            handleAnswer(payload.callerId, payload.userName, payload.isScreenShare, payload.answer, payload.isMuted, payload.isVideoStopped);
        }
    });

    signaling.on('ice-candidate', (payload: any) => {
        if (payload.targetUserId === userId) {
            handleIceCandidate(payload.callerId, payload.candidate);
        }
    });

    signaling.on('peer-media-state', (payload: { userId: string; isMuted: boolean; isVideoStopped: boolean }) => {
        if (payload.userId && payload.userId !== userId) {
            setPeerMediaStates(prev => {
                const next = new Map(prev);
                next.set(payload.userId, { isMuted: payload.isMuted, isVideoStopped: payload.isVideoStopped });
                return next;
            });
        }
    });

    signaling.on('screen-share-state', (payload: { userId: string; isScreenShare: boolean }) => {
        if (payload.userId && payload.userId !== userId) {
          setPeerScreenShares(prev => {
            const next = new Map(prev);
            next.set(payload.userId, payload.isScreenShare);
            return next;
          });
        }
    });

    signaling.on('user-disconnected', (id: string) => handleUserDisconnected(id));

    return () => {
      signaling.off('user-connected');
      signaling.off('offer');
      signaling.off('answer');
      signaling.off('ice-candidate');
      signaling.off('peer-media-state');
      signaling.off('screen-share-state');
      signaling.off('user-disconnected');
      
      peersRef.current.forEach(pc => pc.close());
      peersRef.current.clear();
      prevStatsRef.current.clear();
    };
  }, [roomId, userId, handleUserConnected, handleOffer, handleAnswer, handleIceCandidate, handleUserDisconnected]);

  return { remoteStreams, connectionStats, peerNames, peerScreenShares, peerMediaStates };
};
