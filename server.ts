import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Room metadata
interface RoomMeta {
  isPublic: boolean;
  name?: string;
}

// Store users in memory: RoomID -> Set<UserId>
const rooms = new Map<string, Set<string>>();
const roomMetadata = new Map<string, RoomMeta>();

// Map socket ID to User ID for cleanup
const socketToUser = new Map<string, string>();
const userToRoom = new Map<string, string>();

const getPublicRooms = () => {
  const publicRooms = [];
  for (const [roomId, metadata] of roomMetadata.entries()) {
    if (metadata.isPublic) {
      const count = rooms.get(roomId)?.size || 0;
      if (count > 0) {
        publicRooms.push({
          roomId,
          name: metadata.name,
          count,
          isPublic: true
        });
      }
    }
  }
  return publicRooms;
};

const broadcastPublicRooms = () => {
  const rooms = getPublicRooms();
  console.log(`Broadcasting ${rooms.length} public rooms to all clients`);
  io.emit('rooms-update', rooms);
};

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Send initial room list only to the requester
  socket.on('get-rooms', () => {
    socket.emit('rooms-update', getPublicRooms());
  });

  socket.on('ping', (callback) => {
    if (typeof callback === 'function') callback();
  });

  socket.on('join-room', (roomId: string, userId: string, config?: { isPublic: boolean; name: string }) => {
    socket.join(roomId);
    
    // Track user
    socketToUser.set(socket.id, userId);
    userToRoom.set(userId, roomId);

    // Initialize room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
      roomMetadata.set(roomId, {
        isPublic: config?.isPublic || false,
        name: config?.name || `Room ${roomId}`
      });
      console.log(`Created new room: ${roomId}, Public: ${config?.isPublic}`);
    }
    
    const roomUsers = rooms.get(roomId);
    
    if (roomUsers) {
      // Notify others in the room
      socket.to(roomId).emit('user-connected', userId);
      roomUsers.add(userId);
    }
    
    console.log(`User ${userId} joined room ${roomId} [${config?.isPublic ? 'Public' : 'Private'}]`);
    broadcastPublicRooms();
  });

  socket.on('offer', (payload) => {
    const roomId = userToRoom.get(socketToUser.get(socket.id) || '');
    if (roomId) {
        socket.to(roomId).emit('offer', {
            callerId: socketToUser.get(socket.id),
            userName: payload.userName,
            isScreenShare: payload.isScreenShare,
            offer: payload.offer,
            targetUserId: payload.targetUserId
        });
    }
  });

  socket.on('answer', (payload) => {
    const roomId = userToRoom.get(socketToUser.get(socket.id) || '');
    if (roomId) {
        socket.to(roomId).emit('answer', {
            callerId: socketToUser.get(socket.id),
            userName: payload.userName,
            isScreenShare: payload.isScreenShare,
            answer: payload.answer,
            targetUserId: payload.targetUserId
        });
    }
  });

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

  socket.on('chat-message', (payload) => {
    socket.to(payload.roomId).emit('chat-message', payload.message);
  });

  socket.on('reaction', (payload) => {
    socket.to(payload.roomId).emit('reaction', payload.reaction);
  });

  socket.on('caption', (payload) => {
    socket.to(payload.roomId).emit('caption', payload.caption);
  });

  // Whiteboard Events
  socket.on('whiteboard-draw', (payload) => {
    socket.to(payload.roomId).emit('whiteboard-draw', payload.data);
  });

  socket.on('whiteboard-clear', (payload) => {
    socket.to(payload.roomId).emit('whiteboard-clear');
  });

  // Handle explicit room leave (user clicks Leave button)
  socket.on('leave-room', (payload: { roomId: string; userId: string }) => {
    const { roomId, userId } = payload;
    console.log(`User ${userId} leaving room ${roomId}`);
    
    // Leave the socket.io room
    socket.leave(roomId);
    
    // Clean up user from room
    const roomUsers = rooms.get(roomId);
    if (roomUsers) {
      roomUsers.delete(userId);
      
      // Cleanup empty room
      if (roomUsers.size === 0) {
        rooms.delete(roomId);
        roomMetadata.delete(roomId);
        console.log(`Room ${roomId} deleted (empty)`);
      }
    }
    
    // Notify others in the room
    socket.to(roomId).emit('user-disconnected', userId);
    
    // Clean up mappings
    userToRoom.delete(userId);
    
    // Broadcast updated room list
    broadcastPublicRooms();
  });

  socket.on('disconnect', () => {
    const userId = socketToUser.get(socket.id);
    if (userId) {
      const roomId = userToRoom.get(userId);
      if (roomId) {
        const roomUsers = rooms.get(roomId);
        roomUsers?.delete(userId);
        
        // Cleanup empty room
        if (roomUsers?.size === 0) {
          rooms.delete(roomId);
          roomMetadata.delete(roomId);
          console.log(`Room ${roomId} deleted (empty)`);
        }
        
        socket.to(roomId).emit('user-disconnected', userId);
        broadcastPublicRooms();
      }
      socketToUser.delete(socket.id);
      userToRoom.delete(userId);
      console.log(`User ${userId} disconnected`);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});