import express, { Request, Response } from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 25585;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

// Data structures
interface RoomMeta {
  isPublic: boolean;
  name?: string;
  hostId?: string;
  isLocked: boolean;
  waitingRoom: boolean;
  createdAt: number;
}

interface WaitingUser {
  odId: string;
  socketId: string;
  userName: string;
}

interface WhiteboardImage {
  image: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface WhiteboardState {
  draws: unknown[];
  images: WhiteboardImage[];
  notes: unknown[];
}

// In-memory state
const rooms = new Map<string, Set<string>>(); // roomId -> Set of odIds
const roomMetadata = new Map<string, RoomMeta>(); // roomId -> RoomMeta
const waitingRooms = new Map<string, Map<string, WaitingUser>>(); // roomId -> (odId -> WaitingUser)
const socketToUser = new Map<string, string>(); // socket.id -> odId
const userToRoom = new Map<string, string>(); // odId -> roomId
const userNames = new Map<string, string>(); // odId -> userName
const whiteboardStates = new Map<string, WhiteboardState>();

const getHostSocketId = (roomId: string) => {
  const hostId = roomMetadata.get(roomId)?.hostId;
  return Array.from(socketToUser.entries()).find(([_, userId]) => userId === hostId)?.[0];
};

const getSocketUserId = (socket: Socket) => socketToUser.get(socket.id);
const isActiveRoomMember = (socket: Socket, roomId: string) => {
  const userId = getSocketUserId(socket);
  return !!userId && userToRoom.get(userId) === roomId && rooms.get(roomId)?.has(userId) === true;
};

const isValidRoomId = (roomId: unknown): roomId is string =>
  typeof roomId === 'string' && /^[a-z0-9_-]{1,64}$/i.test(roomId);

const emitRoomParticipants = (roomId: string) => {
  const meta = roomMetadata.get(roomId);
  const hostSocketId = getHostSocketId(roomId);
  if (!meta || !hostSocketId) return;

  const participants = Array.from(rooms.get(roomId) || []).map((userId) => ({
    userId,
    userName: userNames.get(userId) || userId,
    isHost: meta.hostId === userId
  }));
  io.to(hostSocketId).emit('room-participants', { participants });
};

// Helpers
const getPublicRooms = () => {
  const list = [];
  for (const [roomId, metadata] of roomMetadata.entries()) {
    if (metadata.isPublic) {
      const count = rooms.get(roomId)?.size || 0;
      if (count > 0) {
        list.push({
          roomId,
          name: metadata.name || `Room ${roomId}`,
          count,
          isPublic: true,
          isLocked: metadata.isLocked,
          waitingRoom: metadata.waitingRoom,
        });
      }
    }
  }
  return list;
};

const broadcastPublicRooms = () => {
  const publicRooms = getPublicRooms();
  io.emit('rooms-update', publicRooms);
};

const getRoomSettings = (roomId: string) => {
  const meta = roomMetadata.get(roomId);
  return {
    isLocked: meta?.isLocked || false,
    waitingRoom: meta?.waitingRoom || false,
    startedAt: meta?.createdAt
  };
};

// ==========================================
// REST API Endpoints
// ==========================================

// Root welcome
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'MeetMesh Signaling & REST API Server',
    status: 'online',
    version: '2.0.0',
    documentation: '/api',
    health: '/api/health'
  });
});

// API Overview
app.get('/api', (_req: Request, res: Response) => {
  res.json({
    name: 'MeetMesh API',
    version: '2.0.0',
    status: 'online',
    serverTime: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      rooms: '/api/rooms',
    },
    signaling: {
      protocol: 'socket.io',
      port: PORT,
       transports: ['polling']
    }
  });
});

// API Health Check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    version: '2.0.0'
  });
});

// Get Active Public Rooms
app.get('/api/rooms', (_req: Request, res: Response) => {
  const publicRooms = getPublicRooms();
  res.json({
    success: true,
    count: publicRooms.length,
    rooms: publicRooms
  });
});

// Get Specific Room Info
app.get('/api/rooms/:roomId', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const meta = roomMetadata.get(roomId);
  const userSet = rooms.get(roomId);

  if (!meta || !userSet || !meta.isPublic) {
    res.status(404).json({
      success: false,
      message: 'Room not found or currently empty'
    });
    return;
  }

  res.json({
    success: true,
    roomId,
    name: meta.name,
    count: userSet.size,
    isPublic: meta.isPublic,
    isLocked: meta.isLocked,
    waitingRoom: meta.waitingRoom,
    createdAt: meta.createdAt
  });
});

// ==========================================
// Socket.IO WebRTC Signaling Engine
// ==========================================

io.on('connection', (socket: Socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  // Client requests initial list of public rooms
  socket.on('get-rooms', () => {
    socket.emit('rooms-update', getPublicRooms());
  });

  // Client ping to measure round-trip latency
  socket.on('ping', (callback: unknown) => {
    if (typeof callback === 'function') callback();
  });

  // Join Room
  socket.on('join-room', (roomId: string, odId: string, config?: { isPublic: boolean; name: string; waitingRoom?: boolean }, userName?: string) => {
    const authenticatedUserId = typeof socket.handshake.auth?.userId === 'string'
      ? socket.handshake.auth.userId.trim()
      : '';
    if (!authenticatedUserId || authenticatedUserId !== odId || !isValidRoomId(roomId)) {
      socket.emit('auth-error', { message: 'Invalid signaling identity or room ID.' });
      return;
    }

    const existingSocketId = Array.from(socketToUser.entries())
      .find(([socketId, userId]) => socketId !== socket.id && userId === odId)?.[0];
    if (existingSocketId) {
      socket.emit('auth-error', { message: 'This participant is already connected.' });
      return;
    }

    const safeUserName = (userName || odId).trim().slice(0, 80) || odId;

    userNames.set(odId, safeUserName);

    const existingMeta = roomMetadata.get(roomId);
    const isNewRoom = !existingMeta;

    // Check if room is locked
    if (existingMeta?.isLocked) {
      socket.emit('room-locked', { roomId });
      console.log(`[Room ${roomId}] User ${odId} blocked - room is locked`);
      return;
    }

    // Check if waiting room is enabled and user is not the host
    if (existingMeta?.waitingRoom && existingMeta.hostId !== odId) {
      if (!waitingRooms.has(roomId)) {
        waitingRooms.set(roomId, new Map());
      }

      const waiting = waitingRooms.get(roomId)!;
       waiting.set(odId, { odId, socketId: socket.id, userName: safeUserName });
      socketToUser.set(socket.id, odId);

      socket.emit('waiting-room', { roomId, position: waiting.size });

      // Notify host about new waiting user
      const hostSocketId = Array.from(socketToUser.entries())
        .find(([_, uId]) => uId === existingMeta.hostId)?.[0];

      if (hostSocketId) {
        io.to(hostSocketId).emit('waiting-room-update', {
          roomId,
          waitingUsers: Array.from(waiting.values()).map(u => ({ odId: u.odId, userName: u.userName }))
        });
      }

       console.log(`[Room ${roomId}] User ${odId} added to waiting room`);
      return;
    }

    // Direct join
    socket.join(roomId);
    socketToUser.set(socket.id, odId);
    userToRoom.set(odId, roomId);

    if (isNewRoom) {
      rooms.set(roomId, new Set());
      roomMetadata.set(roomId, {
        isPublic: config?.isPublic || false,
         name: (config?.name || `Room ${roomId}`).trim().slice(0, 100),
        hostId: odId,
        isLocked: false,
        waitingRoom: config?.waitingRoom || false,
        createdAt: Date.now()
      });
      waitingRooms.set(roomId, new Map());
      console.log(`[Room ${roomId}] Created new room. Public: ${config?.isPublic}, WaitingRoom: ${config?.waitingRoom}`);
    }

    const roomUsers = rooms.get(roomId);
    if (roomUsers) {
      socket.to(roomId).emit('user-connected', odId);
      roomUsers.add(odId);
    }

    const meta = roomMetadata.get(roomId);
    socket.emit('room-joined', {
      roomId,
      isHost: meta?.hostId === odId,
      settings: getRoomSettings(roomId),
      startedAt: meta?.createdAt || Date.now()
    });

    console.log(`[Room ${roomId}] User ${odId} joined. Total users: ${roomUsers?.size}`);
    broadcastPublicRooms();
    emitRoomParticipants(roomId);
  });

  // Host admits user from waiting room
  socket.on('admit-user', (payload: { roomId: string; odId: string }) => {
    const { roomId, odId } = payload;
    const hostUserId = socketToUser.get(socket.id);
    const meta = roomMetadata.get(roomId);
    const roomUsers = rooms.get(roomId);

    const isAuthorized = !!meta && meta.hostId === hostUserId;
    if (!isAuthorized) {
      console.warn(`[Room ${roomId}] Unauthorized admit request from ${hostUserId}`);
      return;
    }

    const waiting = waitingRooms.get(roomId);
    const waitingUser = waiting?.get(odId);

    if (waitingUser && waiting) {
      waiting.delete(odId);
      const targetSocket = io.sockets.sockets.get(waitingUser.socketId);

      if (targetSocket) {
        targetSocket.join(roomId);
        userToRoom.set(odId, roomId);

        if (roomUsers) {
          targetSocket.to(roomId).emit('user-connected', odId);
          roomUsers.add(odId);
        }

        targetSocket.emit('admitted', {
          roomId,
          isHost: false,
          settings: getRoomSettings(roomId),
          startedAt: meta?.createdAt || Date.now()
        });

        console.log(`[Room ${roomId}] User ${odId} admitted by host`);
      }

      const updatedPayload = {
        roomId,
        waitingUsers: Array.from(waiting.values()).map(u => ({ odId: u.odId, userName: u.userName }))
      };
      // Broadcast to host socket and entire room
      socket.emit('waiting-room-update', updatedPayload);
      io.to(roomId).emit('waiting-room-update', updatedPayload);

      broadcastPublicRooms();
      emitRoomParticipants(roomId);
    }
  });

  // Host denies user from waiting room
  socket.on('deny-user', (payload: { roomId: string; odId: string }) => {
    const { roomId, odId } = payload;
    const hostUserId = socketToUser.get(socket.id);
    const meta = roomMetadata.get(roomId);
    const roomUsers = rooms.get(roomId);

    const isAuthorized = !!meta && meta.hostId === hostUserId;
    if (!isAuthorized) return;

    const waiting = waitingRooms.get(roomId);
    const waitingUser = waiting?.get(odId);

    if (waitingUser && waiting) {
      waiting.delete(odId);
      const targetSocket = io.sockets.sockets.get(waitingUser.socketId);
      if (targetSocket) {
        targetSocket.emit('denied', { roomId });
        socketToUser.delete(waitingUser.socketId);
        userNames.delete(odId);
      }

      const updatedPayload = {
        roomId,
        waitingUsers: Array.from(waiting.values()).map(u => ({ odId: u.odId, userName: u.userName }))
      };
      socket.emit('waiting-room-update', updatedPayload);
      io.to(roomId).emit('waiting-room-update', updatedPayload);
      console.log(`[Room ${roomId}] User ${odId} denied by host`);
    }
  });

  // Host toggles room lock
  socket.on('toggle-lock', (payload: { roomId: string }) => {
    const { roomId } = payload;
    const hostUserId = socketToUser.get(socket.id);
    const meta = roomMetadata.get(roomId);

    if (!meta || meta.hostId !== hostUserId) return;

    meta.isLocked = !meta.isLocked;
    console.log(`[Room ${roomId}] Lock toggled: ${meta.isLocked}`);
    io.to(roomId).emit('room-settings-update', getRoomSettings(roomId));
    broadcastPublicRooms();
  });

  // Host toggles waiting room
  socket.on('toggle-waiting-room', (payload: { roomId: string }) => {
    const { roomId } = payload;
    const hostUserId = socketToUser.get(socket.id);
    const meta = roomMetadata.get(roomId);

    if (!meta || meta.hostId !== hostUserId) return;

    meta.waitingRoom = !meta.waitingRoom;
    console.log(`[Room ${roomId}] Waiting room toggled: ${meta.waitingRoom}`);
    io.to(roomId).emit('room-settings-update', getRoomSettings(roomId));
    broadcastPublicRooms();
  });

  socket.on('get-room-participants', (payload: { roomId: string }) => {
    const hostUserId = socketToUser.get(socket.id);
    const meta = roomMetadata.get(payload.roomId);
    if (meta?.hostId !== hostUserId) return;
    emitRoomParticipants(payload.roomId);
  });

  socket.on('mute-user', (payload: { roomId: string; userId: string }) => {
    const hostUserId = socketToUser.get(socket.id);
    const meta = roomMetadata.get(payload.roomId);
    if (meta?.hostId !== hostUserId || payload.userId === hostUserId) return;
    const targetSocketId = Array.from(socketToUser.entries()).find(([_, userId]) => userId === payload.userId)?.[0];
    if (targetSocketId) io.to(targetSocketId).emit('host-muted', { roomId: payload.roomId });
  });

  socket.on('kick-user', (payload: { roomId: string; userId: string }) => {
    const hostUserId = socketToUser.get(socket.id);
    const meta = roomMetadata.get(payload.roomId);
    const roomUsers = rooms.get(payload.roomId);
    if (meta?.hostId !== hostUserId || payload.userId === hostUserId || !roomUsers?.has(payload.userId)) return;

    const targetSocketId = Array.from(socketToUser.entries()).find(([_, userId]) => userId === payload.userId)?.[0];
    const targetSocket = targetSocketId ? io.sockets.sockets.get(targetSocketId) : undefined;
    targetSocket?.emit('kicked', { roomId: payload.roomId });
    targetSocket?.leave(payload.roomId);
    roomUsers.delete(payload.userId);
    if (targetSocketId) socketToUser.delete(targetSocketId);
    userToRoom.delete(payload.userId);
    userNames.delete(payload.userId);
    socket.to(payload.roomId).emit('user-disconnected', payload.userId);
    emitRoomParticipants(payload.roomId);
    broadcastPublicRooms();
  });

  // WebRTC Signaling: Offer
  socket.on('offer', (payload) => {
    const roomId = userToRoom.get(socketToUser.get(socket.id) || '');
    if (roomId && rooms.get(roomId)?.has(payload.targetUserId)) {
      socket.to(roomId).emit('offer', {
        callerId: socketToUser.get(socket.id),
        userName: payload.userName,
        isScreenShare: payload.isScreenShare,
        isMuted: payload.isMuted,
        isVideoStopped: payload.isVideoStopped,
        offer: payload.offer,
        targetUserId: payload.targetUserId
      });
    }
  });

  // WebRTC Signaling: Answer
  socket.on('answer', (payload) => {
    const roomId = userToRoom.get(socketToUser.get(socket.id) || '');
    if (roomId && rooms.get(roomId)?.has(payload.targetUserId)) {
      socket.to(roomId).emit('answer', {
        callerId: socketToUser.get(socket.id),
        userName: payload.userName,
        isScreenShare: payload.isScreenShare,
        isMuted: payload.isMuted,
        isVideoStopped: payload.isVideoStopped,
        answer: payload.answer,
        targetUserId: payload.targetUserId
      });
    }
  });

  // WebRTC Signaling: ICE Candidate
  socket.on('ice-candidate', (payload) => {
    const roomId = userToRoom.get(socketToUser.get(socket.id) || '');
    if (roomId && rooms.get(roomId)?.has(payload.targetUserId)) {
      socket.to(roomId).emit('ice-candidate', {
        callerId: socketToUser.get(socket.id),
        candidate: payload.candidate,
        targetUserId: payload.targetUserId
      });
    }
  });

  // Chat message
  socket.on('chat-message', (payload) => {
    const userId = getSocketUserId(socket);
    if (!userId || !isActiveRoomMember(socket, payload.roomId) || !payload.message) return;
    const text = typeof payload.message.text === 'string' ? payload.message.text.trim().slice(0, 2000) : '';
    if (!text) return;
    socket.to(payload.roomId).emit('chat-message', {
      ...payload.message,
      senderId: userId,
      text,
      timestamp: Date.now()
    });
  });

  // Reaction
  socket.on('reaction', (payload) => {
    const userId = getSocketUserId(socket);
    if (!userId || !isActiveRoomMember(socket, payload.roomId) || !payload.reaction) return;
    const emoji = typeof payload.reaction.emoji === 'string' ? payload.reaction.emoji.slice(0, 16) : '';
    if (!emoji) return;
    socket.to(payload.roomId).emit('reaction', { ...payload.reaction, senderId: userId, emoji });
  });

  // Caption
  socket.on('caption', (payload) => {
    const userId = getSocketUserId(socket);
    if (!userId || !isActiveRoomMember(socket, payload.roomId) || !payload.caption) return;
    const text = typeof payload.caption.text === 'string' ? payload.caption.text.trim().slice(0, 500) : '';
    if (!text) return;
    socket.to(payload.roomId).emit('caption', { ...payload.caption, senderId: userId, text, timestamp: Date.now() });
  });

  // Whiteboard events
  socket.on('whiteboard-request-state', (payload: { roomId: string }) => {
    if (!isActiveRoomMember(socket, payload.roomId)) return;
    const state = whiteboardStates.get(payload.roomId) || { draws: [], images: [], notes: [] };
    socket.emit('whiteboard-state', state);
  });

  socket.on('whiteboard-draw', (payload) => {
    if (!isActiveRoomMember(socket, payload.roomId) || !payload.data) return;
    const state = whiteboardStates.get(payload.roomId) || { draws: [], images: [], notes: [] };
    state.draws.push(payload.data);
    if (state.draws.length > 20000) state.draws.splice(0, state.draws.length - 20000);
    whiteboardStates.set(payload.roomId, state);
    socket.to(payload.roomId).emit('whiteboard-draw', payload.data);
  });

  socket.on('whiteboard-clear', (payload) => {
    if (!isActiveRoomMember(socket, payload.roomId)) return;
    whiteboardStates.set(payload.roomId, { draws: [], images: [], notes: [] });
    socket.to(payload.roomId).emit('whiteboard-clear');
  });

  socket.on('whiteboard-image', (payload: { roomId: string; image: string; x: number; y: number; width: number; height: number }) => {
    if (!isActiveRoomMember(socket, payload.roomId) || typeof payload.image !== 'string' || payload.image.length > 2_000_000) return;
    const state = whiteboardStates.get(payload.roomId) || { draws: [], images: [], notes: [] };
    state.images.push({ image: payload.image, x: payload.x, y: payload.y, width: payload.width, height: payload.height });
    whiteboardStates.set(payload.roomId, state);
    socket.to(payload.roomId).emit('whiteboard-image', payload);
  });

  socket.on('whiteboard-notes-update', (payload: { roomId: string; notes: any[] }) => {
    if (!isActiveRoomMember(socket, payload.roomId) || !Array.isArray(payload.notes) || payload.notes.length > 100) return;
    const state = whiteboardStates.get(payload.roomId) || { draws: [], images: [], notes: [] };
    state.notes = payload.notes;
    whiteboardStates.set(payload.roomId, state);
    socket.to(payload.roomId).emit('whiteboard-notes-update', payload.notes);
  });

  // Raise Hand event
  socket.on('raise-hand', (payload: { roomId: string; userId: string; isRaised: boolean; userName: string }) => {
    const userId = getSocketUserId(socket);
    if (!userId || !isActiveRoomMember(socket, payload.roomId)) return;
    socket.to(payload.roomId).emit('hand-raise-update', { ...payload, userId, userName: userNames.get(userId) || userId });
  });

  // Peer Media State (Mute & Camera on/off synchronization)
  socket.on('peer-media-state', (payload: { roomId: string; isMuted: boolean; isVideoStopped: boolean }) => {
    const senderUserId = socketToUser.get(socket.id);
    if (senderUserId && isActiveRoomMember(socket, payload.roomId)) {
      socket.to(payload.roomId).emit('peer-media-state', {
        userId: senderUserId,
        isMuted: payload.isMuted,
        isVideoStopped: payload.isVideoStopped
      });
    }
  });

  socket.on('screen-share-state', (payload: { roomId: string; isScreenShare: boolean }) => {
    const senderUserId = socketToUser.get(socket.id);
    if (senderUserId && isActiveRoomMember(socket, payload.roomId)) {
      socket.to(payload.roomId).emit('screen-share-state', {
        userId: senderUserId,
        isScreenShare: payload.isScreenShare
      });
    }
  });

  const forwardScreenSignal = (event: 'screen-offer' | 'screen-answer' | 'screen-ice-candidate', payload: any) => {
    const roomId = userToRoom.get(socketToUser.get(socket.id) || '');
    if (!roomId || !payload.targetUserId || !rooms.get(roomId)?.has(payload.targetUserId)) return;
    socket.to(roomId).emit(event, {
      ...payload,
      callerId: socketToUser.get(socket.id)
    });
  };

  socket.on('screen-offer', (payload) => forwardScreenSignal('screen-offer', payload));
  socket.on('screen-answer', (payload) => forwardScreenSignal('screen-answer', payload));
  socket.on('screen-ice-candidate', (payload) => forwardScreenSignal('screen-ice-candidate', payload));

  // Handle explicit leave room
  socket.on('leave-room', (payload: { roomId: string; userId: string }) => {
    const { roomId, userId } = payload;
    if (getSocketUserId(socket) !== userId || userToRoom.get(userId) !== roomId) return;
    socket.leave(roomId);

    const roomUsers = rooms.get(roomId);
    const meta = roomMetadata.get(roomId);

    if (roomUsers) {
      roomUsers.delete(userId);

      // Transfer host if host leaves
      if (meta?.hostId === userId && roomUsers.size > 0) {
        const newHostId = roomUsers.values().next().value;
        meta.hostId = newHostId;

        const newHostSocketId = Array.from(socketToUser.entries())
          .find(([_, id]) => id === newHostId)?.[0];

        if (newHostSocketId) {
          io.to(newHostSocketId).emit('host-changed', { isHost: true });
          io.to(newHostSocketId).emit('room-settings-update', getRoomSettings(roomId));

          const waiting = waitingRooms.get(roomId);
          if (waiting && waiting.size > 0) {
            io.to(newHostSocketId).emit('waiting-room-update', {
              roomId,
              waitingUsers: Array.from(waiting.values()).map(u => ({ odId: u.odId, userName: u.userName }))
            });
          }
        }
        console.log(`[Room ${roomId}] Host transferred to ${newHostId}`);
      }

      // Cleanup room if empty
      if (roomUsers.size === 0) {
        rooms.delete(roomId);
        roomMetadata.delete(roomId);
        whiteboardStates.delete(roomId);

        const waiting = waitingRooms.get(roomId);
        if (waiting) {
          for (const user of waiting.values()) {
            const ws = io.sockets.sockets.get(user.socketId);
            if (ws) {
              ws.emit('room-closed', { roomId });
              socketToUser.delete(user.socketId);
            }
          }
          waitingRooms.delete(roomId);
        }
        console.log(`[Room ${roomId}] Cleaned up (empty room)`);
      }
      emitRoomParticipants(roomId);
    }

    socket.to(roomId).emit('user-disconnected', userId);
    userToRoom.delete(userId);
    userNames.delete(userId);
    broadcastPublicRooms();
  });

  // Handle Disconnection
  socket.on('disconnect', () => {
    const odId = socketToUser.get(socket.id);
    if (!odId) return;

    // Check waiting rooms
    for (const [rid, waiting] of waitingRooms.entries()) {
      if (waiting.has(odId)) {
        waiting.delete(odId);
        const meta = roomMetadata.get(rid);
        if (meta?.hostId) {
          const hostSocketId = Array.from(socketToUser.entries())
            .find(([_, id]) => id === meta.hostId)?.[0];
          if (hostSocketId) {
            io.to(hostSocketId).emit('waiting-room-update', {
              roomId: rid,
              waitingUsers: Array.from(waiting.values()).map(u => ({ odId: u.odId, userName: u.userName }))
            });
          }
        }
        break;
      }
    }

    const roomId = userToRoom.get(odId);
    if (roomId) {
      const roomUsers = rooms.get(roomId);
      const meta = roomMetadata.get(roomId);

      roomUsers?.delete(odId);

      // Transfer host if necessary
      if (meta?.hostId === odId && roomUsers && roomUsers.size > 0) {
        const newHostId = roomUsers.values().next().value;
        meta.hostId = newHostId;

        const newHostSocketId = Array.from(socketToUser.entries())
          .find(([_, id]) => id === newHostId)?.[0];

        if (newHostSocketId) {
          io.to(newHostSocketId).emit('host-changed', { isHost: true });
          io.to(newHostSocketId).emit('room-settings-update', getRoomSettings(roomId));

          const waiting = waitingRooms.get(roomId);
          if (waiting && waiting.size > 0) {
            io.to(newHostSocketId).emit('waiting-room-update', {
              roomId,
              waitingUsers: Array.from(waiting.values()).map(u => ({ odId: u.odId, userName: u.userName }))
            });
          }
        }
      }

      // Cleanup empty room
      if (roomUsers?.size === 0) {
        rooms.delete(roomId);
        roomMetadata.delete(roomId);
        whiteboardStates.delete(roomId);

        const waiting = waitingRooms.get(roomId);
        if (waiting) {
          for (const user of waiting.values()) {
            const ws = io.sockets.sockets.get(user.socketId);
            if (ws) {
              ws.emit('room-closed', { roomId });
              socketToUser.delete(user.socketId);
            }
          }
          waitingRooms.delete(roomId);
        }
        console.log(`[Room ${roomId}] Cleaned up after disconnect`);
      }
      emitRoomParticipants(roomId);

      socket.to(roomId).emit('user-disconnected', odId);
      broadcastPublicRooms();
    }

    socketToUser.delete(socket.id);
    userToRoom.delete(odId);
    userNames.delete(odId);
    console.log(`[Socket] Disconnected: ${socket.id} (user: ${odId})`);
  });
});

// Start listening
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
===================================================
 MeetMesh WebRTC Signaling & REST API Server v2.0
===================================================
 🚀 Server Port   : ${PORT}
 📡 API Health    : http://0.0.0.0:${PORT}/api/health
 📋 API Directory : http://0.0.0.0:${PORT}/api
 🏠 Public Rooms  : http://0.0.0.0:${PORT}/api/rooms
===================================================
`);
});

// Process signal handling
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received. Shutting down gracefully.');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received. Shutting down gracefully.');
  server.close(() => process.exit(0));
});
