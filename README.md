# MeetMesh

Peer-to-peer video conferencing application built with WebRTC, React, and a dedicated Node.js signaling server.

---

## Features

- Peer-to-Peer Architecture: Direct media exchange between participants using WebRTC mesh networking.
- End-to-End Encryption: Browser-native WebRTC data channels and media streams.
- Room Management: Create public or private meetings with optional waiting room admission and room lock controls.
- Collaborative Tools: In-call text chat, interactive whiteboard, and real-time screen sharing.
- Audio & Video Controls: Device switching, microphone mute, camera toggle, and AI background blur.
- Live Captions: Client-side speech-to-text powered by the Web Speech API.
- Live Public Rooms Directory: Discover and join active public meetings directly from the landing page.
- Self-Hosted Backend: Standalone Node.js server with REST health/stats endpoints and Socket.IO signaling.

---

## Tech Stack

- Frontend: React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons
- Signaling Backend: Node.js, Express, Socket.IO
- Real-Time Communication: WebRTC (PeerConnection, DataChannel)
- Processing: MediaPipe Selfie Segmentation, Web Speech API

---

## Project Structure

```text
MeetMesh/
├── App.tsx                  # Main frontend application
├── index.html               # HTML entry point
├── index.tsx                # React application bootstrap
├── types.ts                 # Shared TypeScript interfaces
├── vite.config.ts           # Vite frontend configuration
├── components/              # UI components
│   ├── Controls.tsx         # Call action bar
│   ├── DynamicIsland.tsx    # Header status bar
│   ├── HostControlsModal.tsx# Host security and waiting room manager
│   ├── Navbar.tsx           # Landing navigation and server health badge
│   ├── PublicRoomsHub.tsx   # Public rooms directory and search
│   ├── SettingsModal.tsx    # Device selection modal
│   ├── VideoGrid.tsx        # Responsive participant video layout
│   └── Whiteboard.tsx       # Collaborative canvas
├── hooks/                   # Custom React hooks
│   ├── useBackgroundBlur.ts # Background blur filter
│   ├── useLiveCaptions.ts   # Speech-to-text captions
│   └── useWebRTC.ts         # WebRTC mesh peer connection lifecycle
├── services/
│   └── socket.ts            # Socket.IO client and REST API helpers
└── server/                  # Dedicated backend server
    ├── package.json         # Server package definition
    ├── tsconfig.json        # TypeScript configuration for server
    ├── index.js             # Node.js production entry point
    ├── dist/                # Precompiled JavaScript bundle
    └── src/
        └── index.ts         # Server source code (REST API & signaling)
```

---

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- npm 9.x or higher

### Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/AyaanplayszYT/MeetMesh.git
   cd MeetMesh
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   Create a `.env` file in the root directory:
   ```env
   VITE_SOCKET_URL=https://api.hostmc.cloud
   VITE_API_URL=https://api.hostmc.cloud/api
   ```

4. Start development mode:
   ```bash
   # Starts both frontend and local backend concurrently
   npm run dev

   # Or run only the frontend client
   npm run dev:client
   ```

Frontend will run at `http://localhost:3000`.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Runs both local server and frontend concurrently |
| `npm run dev:client` | Starts the Vite development server on port 3000 |
| `npm run dev:server` | Runs the server in watch mode using tsx |
| `npm run build` | Builds the client application for production |
| `npm run preview` | Previews the production build locally |
| `npm start` | Starts the backend server directly |

---

## Backend Deployment

The `server/` directory is self-contained and can be deployed to any Node.js host (HostMC, VPS, Pterodactyl, Docker, etc.).

### Deploying the Server

1. Upload the `server/` directory to your host.
2. Install dependencies:
   ```bash
   cd server
   npm install
   ```
3. Set the startup command:
   ```bash
   node index.js
   ```
   Or using npm:
   ```bash
   npm start
   ```

### Backend REST Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health status, uptime, and active connection count |
| `GET` | `/api` | API directory and signaling metadata |
| `GET` | `/api/rooms` | List of currently active public rooms |
| `GET` | `/api/rooms/:roomId` | Details for a specific room |
| `GET` | `/api/stats` | Memory usage and runtime metrics |

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
