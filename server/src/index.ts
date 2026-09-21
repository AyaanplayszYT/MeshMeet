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

// In-memory state
const rooms = new Map<string, Set<string>>(); // roomId -> Set of odIds
const roomMetadata = new Map<string, RoomMeta>(); // roomId -> RoomMeta
const waitingRooms = new Map<string, Map<string, WaitingUser>>(); // roomId -> (odId -> WaitingUser)
const socketToUser = new Map<string, string>(); // socket.id -> odId
const userToRoom = new Map<string, string>(); // odId -> roomId
const userNames = new Map<string, string>(); // odId -> userName

const startTime = Date.now();

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
          createdAt: metadata.createdAt
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
    hostId: meta?.hostId,
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
      stats: '/api/stats',
    },
    signaling: {
      protocol: 'socket.io',
      port: PORT,
      transports: ['websocket', 'polling']
    }
  });
});

// API Health Check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: Date.now(),
    serverTime: new Date().toISOString(),
    activeRooms: rooms.size,
    publicRooms: getPublicRooms().length,
    activeConnections: io.engine.clientsCount,
    nodeVersion: process.version,
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

  if (!meta || !userSet) {
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

// Server Statistics
app.get('/api/stats', (_req: Request, res: Response) => {
  const mem = process.memoryUsage();
  res.json({
    uptime: Math.floor(process.uptime()),
    startedAt: new Date(startTime).toISOString(),
    totalActiveRooms: rooms.size,
    publicRoomsCount: getPublicRooms().length,
    totalSockets: io.engine.clientsCount,
    memory: {
      rssMb: Math.round(mem.rss / 1024 / 1024 * 100) / 100,
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100,
      heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024 * 100) / 100,
    }
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
    if (!roomId || !odId) return;

    if (userName) {
      userNames.set(odId, userName);
    }

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
      waiting.set(odId, { odId, socketId: socket.id, userName: userName || odId });
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

      console.log(`[Room ${roomId}] User ${odId} (${userName || 'Unknown'}) added to waiting room`);
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
        name: config?.name || `Room ${roomId}`,
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
      settings: getRoomSettings(roomId)
    });

    console.log(`[Room ${roomId}] User ${odId} joined. Total users: ${roomUsers?.size}`);
    broadcastPublicRooms();
  });

  // Host admits user from waiting room
  socket.on('admit-user', (payload: { roomId: string; odId: string }) => {
    const { roomId, odId } = payload;
    const hostUserId = socketToUser.get(socket.id);
    const meta = roomMetadata.get(roomId);
    const roomUsers = rooms.get(roomId);

    const isAuthorized = !meta || !meta.hostId || meta.hostId === hostUserId || (hostUserId && roomUsers && roomUsers.has(hostUserId));
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
          settings: getRoomSettings(roomId)
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
    }
  });

  // Host denies user from waiting room
  socket.on('deny-user', (payload: { roomId: string; odId: string }) => {
    const { roomId, odId } = payload;
    const hostUserId = socketToUser.get(socket.id);
    const meta = roomMetadata.get(roomId);
    const roomUsers = rooms.get(roomId);

    const isAuthorized = !meta || !meta.hostId || meta.hostId === hostUserId || (hostUserId && roomUsers && roomUsers.has(hostUserId));
    if (!isAuthorized) return;

    const waiting = waitingRooms.get(roomId);
    const waitingUser = waiting?.get(odId);

    if (waitingUser && waiting) {
      waiting.delete(odId);
      const targetSocket = io.sockets.sockets.get(waitingUser.socketId);
      if (targetSocket) {
        targetSocket.emit('denied', { roomId });
        socketToUser.delete(waitingUser.socketId);
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

  // WebRTC Signaling: Offer
  socket.on('offer', (payload) => {
    const roomId = userToRoom.get(socketToUser.get(socket.id) || '');
    if (roomId) {
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
    if (roomId) {
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
    if (roomId) {
      socket.to(roomId).emit('ice-candidate', {
        callerId: socketToUser.get(socket.id),
        candidate: payload.candidate,
        targetUserId: payload.targetUserId
      });
    }
  });

  // Chat message
  socket.on('chat-message', (payload) => {
    socket.to(payload.roomId).emit('chat-message', payload.message);
  });

  // Reaction
  socket.on('reaction', (payload) => {
    socket.to(payload.roomId).emit('reaction', payload.reaction);
  });

  // Caption
  socket.on('caption', (payload) => {
    socket.to(payload.roomId).emit('caption', payload.caption);
  });

  // Whiteboard events
  socket.on('whiteboard-draw', (payload) => {
    socket.to(payload.roomId).emit('whiteboard-draw', payload.data);
  });

  socket.on('whiteboard-clear', (payload) => {
    socket.to(payload.roomId).emit('whiteboard-clear');
  });

  socket.on('whiteboard-image', (payload: { roomId: string; image: string; x: number; y: number; width: number; height: number }) => {
    socket.to(payload.roomId).emit('whiteboard-image', payload);
  });

  socket.on('whiteboard-notes-update', (payload: { roomId: string; notes: any[] }) => {
    socket.to(payload.roomId).emit('whiteboard-notes-update', payload.notes);
  });

  // Raise Hand event
  socket.on('raise-hand', (payload: { roomId: string; userId: string; isRaised: boolean; userName: string }) => {
    socket.to(payload.roomId).emit('hand-raise-update', payload);
  });

  // Peer Media State (Mute & Camera on/off synchronization)
  socket.on('peer-media-state', (payload: { roomId: string; isMuted: boolean; isVideoStopped: boolean }) => {
    const senderUserId = socketToUser.get(socket.id);
    if (senderUserId && payload.roomId) {
      socket.to(payload.roomId).emit('peer-media-state', {
        userId: senderUserId,
        isMuted: payload.isMuted,
        isVideoStopped: payload.isVideoStopped
      });
    }
  });

  // Handle explicit leave room
  socket.on('leave-room', (payload: { roomId: string; userId: string }) => {
    const { roomId, userId } = payload;
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
