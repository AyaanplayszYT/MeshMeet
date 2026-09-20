# MeetMesh Signaling & REST API Server

Independent, lightweight Node.js WebRTC signaling and REST API backend for MeetMesh.

## Features
- **Socket.IO WebRTC Signaling**: Ultra-low latency signaling for peer-to-peer audio, video, screen share, reactions, chat, and whiteboard.
- **REST Endpoints**:
  - `GET /api/health`: Health status, uptime, active rooms, and active socket connections.
  - `GET /api`: API summary and available endpoints.
  - `GET /api/rooms`: List of active public rooms and participant counts.
  - `GET /api/rooms/:roomId`: Details of a specific room.
  - `GET /api/stats`: Memory and runtime metrics.
- **Zero Database Requirement**: Runs in-memory with automatic room cleanup and host reassignment.
- **Self-Hosting Ready**: Configured for port `25585` (default: `http://api.hostmc.cloud:25585`).

---

## Quick Start on Your Server

### 1. Upload & Install
Upload this `server` directory to your Node.js server (e.g., `api.hostmc.cloud`) and install dependencies:

```bash
cd server
npm install
```

### 2. Configure Environment (Optional)
Create a `.env` file if you wish to customize the port:
```env
PORT=25585
NODE_ENV=production
```

### 3. Run Directly
```bash
npm start
```

### 4. Run in Production with PM2 (Recommended)
Install PM2 globally if not already installed:
```bash
npm install -g pm2
pm2 start "npm start" --name "meetmesh-server"
pm2 save
pm2 startup
```

To monitor logs:
```bash
pm2 logs meetmesh-server
```

---

## Verifying the Deployment
Once running, verify that the endpoints respond:
- Health check: `curl http://localhost:25585/api/health` or `http://api.hostmc.cloud:25585/api/health`
- API Index: `curl http://localhost:25585/api` or `http://api.hostmc.cloud:25585/api`
