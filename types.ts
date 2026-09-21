

export interface PeerSignal {
  userId: string;
  signal: RTCSessionDescriptionInit;
}

export interface PeerCandidate {
  userId: string;
  candidate: RTCIceCandidateInit;
}

export interface User {
  id: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
}

export interface Reaction {
  senderId: string;
  emoji: string;
  timestamp: number;
}

export interface RoomInfo {
  roomId: string;
  name?: string;
  count: number;
  isPublic: boolean;
  isLocked?: boolean;
  waitingRoom?: boolean;
}

export interface RoomSettings {
  isLocked: boolean;
  waitingRoom: boolean;
  hostId?: string;
  startedAt?: number;
}

export interface WaitingUser {
  odId: string;
  userName: string;
}

export interface RoomParticipant {
  userId: string;
  userName: string;
  isHost: boolean;
}

export interface ConnectionStats {
  rtt: number;              // Round Trip Time in ms
  jitter: number;           // Jitter in ms
  packetLossPercentage: number; // Real-time packet loss %
  packetsLost: number;      // Cumulative packets lost
  resolution?: string;      // Video resolution (e.g., 1920x1080)
  frameRate?: number;       // Frames per second
}

export type ShapeType = 'pen' | 'line' | 'rectangle' | 'circle' | 'arrow' | 'eraser';

export interface DrawLine {
  prevX: number;
  prevY: number;
  currX: number;
  currY: number;
  color: string;
  width: number;
  shape?: ShapeType;
}

export interface Caption {
  senderId: string;
  text: string;
  isFinal: boolean;
  timestamp: number;
}

export interface PeerMediaState {
  userId: string;
  isMuted: boolean;
  isVideoStopped: boolean;
}

export interface StickyNote {
  id: string;
  x: number; // percentage 0 - 100
  y: number; // percentage 0 - 100
  text: string;
  color: 'amber' | 'emerald' | 'sky' | 'rose' | 'purple';
  author?: string;
}

export interface WhiteboardImage {
  image: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WhiteboardState {
  draws: DrawLine[];
  images: WhiteboardImage[];
  notes: StickyNote[];
}

// Events that the client listens to from the server
export interface ServerToClientEvents {
  'user-connected': (userId: string) => void;
  'user-disconnected': (userId: string) => void;
  'offer': (payload: { callerId: string; userName: string; isScreenShare: boolean; isMuted?: boolean; isVideoStopped?: boolean; offer: RTCSessionDescriptionInit }) => void;
  'answer': (payload: { callerId: string; userName: string; isScreenShare: boolean; isMuted?: boolean; isVideoStopped?: boolean; answer: RTCSessionDescriptionInit }) => void;
  'ice-candidate': (payload: { callerId: string; candidate: RTCIceCandidateInit }) => void;
  'chat-message': (message: ChatMessage) => void;
  'reaction': (reaction: Reaction) => void;
  'room-full': () => void;
  'auth-error': (payload: { message: string }) => void;
  'rooms-update': (rooms: RoomInfo[]) => void;
  'whiteboard-draw': (data: DrawLine) => void;
  'whiteboard-clear': () => void;
  'whiteboard-image': (payload: { image: string; x: number; y: number; width: number; height: number }) => void;
  'whiteboard-notes-update': (notes: StickyNote[]) => void;
  'whiteboard-state': (state: WhiteboardState) => void;
  'caption': (caption: Caption) => void;
  // Waiting room & lock events
  'room-joined': (payload: { roomId: string; isHost: boolean; settings: RoomSettings; startedAt: number }) => void;
  'room-locked': (payload: { roomId: string }) => void;
  'waiting-room': (payload: { roomId: string; position: number }) => void;
  'waiting-room-update': (payload: { roomId: string; waitingUsers: WaitingUser[] }) => void;
  'admitted': (payload: { roomId: string; isHost: boolean; settings: RoomSettings; startedAt: number }) => void;
  'denied': (payload: { roomId: string }) => void;
  'room-settings-update': (settings: RoomSettings) => void;
  'host-changed': (payload: { isHost: boolean }) => void;
  'room-closed': (payload: { roomId: string }) => void;
  'hand-raise-update': (payload: { userId: string; isRaised: boolean; userName: string }) => void;
  'peer-media-state': (payload: PeerMediaState) => void;
  'room-participants': (payload: { participants: RoomParticipant[] }) => void;
  'host-muted': (payload: { roomId: string }) => void;
  'kicked': (payload: { roomId: string }) => void;
  'screen-share-state': (payload: { userId: string; isScreenShare: boolean }) => void;
  'screen-offer': (payload: { callerId: string; userName: string; offer: RTCSessionDescriptionInit }) => void;
  'screen-answer': (payload: { callerId: string; answer: RTCSessionDescriptionInit }) => void;
  'screen-ice-candidate': (payload: { callerId: string; candidate: RTCIceCandidateInit }) => void;
}

// Events that the client sends to the server
export interface ClientToServerEvents {
  'join-room': (roomId: string, userId: string, config?: { isPublic: boolean; name: string; waitingRoom?: boolean }, userName?: string) => void;
  'leave-room': (payload: { roomId: string; userId: string }) => void;
  'offer': (payload: { targetUserId: string; userName: string; isScreenShare: boolean; isMuted?: boolean; isVideoStopped?: boolean; offer: RTCSessionDescriptionInit }) => void;
  'answer': (payload: { targetUserId: string; userName: string; isScreenShare: boolean; isMuted?: boolean; isVideoStopped?: boolean; answer: RTCSessionDescriptionInit }) => void;
  'ice-candidate': (payload: { targetUserId: string; candidate: RTCIceCandidateInit }) => void;
  'chat-message': (payload: { roomId: string; message: ChatMessage }) => void;
  'reaction': (payload: { roomId: string; reaction: Reaction }) => void;
  'get-rooms': () => void;
  'ping': (callback: () => void) => void;
  'whiteboard-draw': (payload: { roomId: string; data: DrawLine }) => void;
  'whiteboard-clear': (payload: { roomId: string }) => void;
  'whiteboard-image': (payload: { roomId: string; image: string; x: number; y: number; width: number; height: number }) => void;
  'whiteboard-notes-update': (payload: { roomId: string; notes: StickyNote[] }) => void;
  'whiteboard-request-state': (payload: { roomId: string }) => void;
  'caption': (payload: { roomId: string; caption: Caption }) => void;
  // Host controls
  'admit-user': (payload: { roomId: string; odId: string }) => void;
  'deny-user': (payload: { roomId: string; odId: string }) => void;
  'toggle-lock': (payload: { roomId: string }) => void;
  'toggle-waiting-room': (payload: { roomId: string }) => void;
  'raise-hand': (payload: { roomId: string; userId: string; isRaised: boolean; userName: string }) => void;
  'peer-media-state': (payload: { roomId: string; isMuted: boolean; isVideoStopped: boolean }) => void;
  'screen-share-state': (payload: { roomId: string; isScreenShare: boolean }) => void;
  'screen-offer': (payload: { targetUserId: string; userName: string; offer: RTCSessionDescriptionInit }) => void;
  'screen-answer': (payload: { targetUserId: string; answer: RTCSessionDescriptionInit }) => void;
  'screen-ice-candidate': (payload: { targetUserId: string; candidate: RTCIceCandidateInit }) => void;
  'get-room-participants': (payload: { roomId: string }) => void;
  'mute-user': (payload: { roomId: string; userId: string }) => void;
  'kick-user': (payload: { roomId: string; userId: string }) => void;
}
