# 🌐 MeshMeet

**Secure, peer-to-peer video conferencing with zero server footprint**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.2-61dafb)](https://reactjs.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.8-black)](https://socket.io/)

[Live Demo](#) • [Features](#features) • [Quick Start](#quick-start) • [Deploy](#deployment) • [Contributing](#contributing)

</div>

---

## ✨ Features

- 🔐 **End-to-End Encrypted** - WebRTC peer-to-peer connections ensure your calls stay private
- 🎥 **HD Video Calls** - High-quality video with adaptive bitrate
- 🖥️ **Screen Sharing** - Share your screen with one click
- 🌫️ **Background Blur** - AI-powered background blur using MediaPipe
- 💬 **Real-time Chat** - In-call messaging for quick communication
- 📝 **Live Captions** - Speech-to-text captions using Web Speech API
- 🎨 **Collaborative Whiteboard** - Draw and annotate together in real-time
- 🌍 **Public & Private Rooms** - Create public rooms or private meetings
- 📊 **Connection Stats** - Real-time RTT, jitter, and packet loss monitoring
- 😀 **Reactions** - Express yourself with emoji reactions
- 📱 **Picture-in-Picture** - Keep your call visible while multitasking
- 🌐 **LAN Support** - Connect with devices on your local network

---

## 🛠️ Tech Stack

| Frontend | Backend | Real-time |
|----------|---------|-----------|
| React 19 | Express 5 | Socket.io 4.8 |
| TypeScript | Node.js | WebRTC |
| Vite 6 | | MediaPipe |
| TailwindCSS | | Web Speech API |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20.x or higher
- **npm** 9.x or higher

### Installation

```bash
# Clone the repository
git clone https://github.com/AyaanplayszYT/MeetMesh.git
cd MeetMesh

# Install dependencies
npm install

# Start development servers (frontend + backend)
npm run dev
```

This will start:
- 🖥️ **Frontend** at `http://localhost:3000`
- 🔌 **Backend** at `http://localhost:3001`

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both frontend and backend in development mode |
| `npm run dev:client` | Start only the Vite frontend server |
| `npm run dev:server` | Start only the Socket.io backend server |
| `npm run build` | Build the frontend for production |
| `npm run preview` | Preview the production build locally |
| `npm start` | Start the production backend server |

---

## 🌐 Deployment

### Architecture Overview

MeshMeet consists of two parts:
1. **Frontend** - Static React app (can be hosted on Vercel, Netlify, etc.)
2. **Backend** - Socket.io signaling server (requires a Node.js hosting platform)

### Deploy Frontend to Vercel

1. **Connect your GitHub repository** to Vercel
2. **Configure build settings** (auto-detected from `vercel.json`):
   - Build Command: `npm run build`
   - Output Directory: `dist`
3. **Add environment variable**:
   - `VITE_SOCKET_URL` = Your backend server URL (e.g., `https://your-backend.railway.app`)
4. **Deploy!**

### Deploy Backend to Railway/Render

#### Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

#### Render
1. Create a new **Web Service**
2. Connect your repository
3. Configure:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment: `PORT=3001`

### Environment Variables

Create a `.env` file based on `.env.example`:

```env
# Backend server URL (required for production)
VITE_SOCKET_URL=https://your-backend-server.com

# Optional: Gemini API Key for AI features
VITE_GEMINI_API_KEY=your-api-key
```

---

## 📁 Project Structure

```
MeetMesh/
├── App.tsx              # Main application component
├── index.tsx            # React entry point
├── index.html           # HTML template
├── server.ts            # Socket.io signaling server
├── types.ts             # TypeScript type definitions
├── vite.config.ts       # Vite configuration
├── vercel.json          # Vercel deployment config
├── components/
│   ├── Chat.tsx         # In-call chat component
│   ├── Controls.tsx     # Call controls bar
│   ├── DynamicIsland.tsx# Status bar component
│   ├── SettingsModal.tsx# Settings modal
│   ├── VideoGrid.tsx    # Video grid layout
│   └── Whiteboard.tsx   # Collaborative whiteboard
├── hooks/
│   ├── useBackgroundBlur.ts  # Background blur hook
│   ├── useLiveCaptions.ts    # Live captions hook
│   └── useWebRTC.ts          # WebRTC peer connection hook
└── services/
    └── socket.ts        # Socket.io client service
```

---

## 🔧 Configuration

### STUN/TURN Servers

The app uses Google's public STUN servers by default. For production, consider adding TURN servers for better NAT traversal:

```typescript
// In hooks/useWebRTC.ts
const STUN_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    // Add your TURN server here for production
    // { urls: 'turn:your-turn-server.com:3478', username: 'user', credential: 'pass' }
  ],
};
```

### Server Port

By default:
- Frontend runs on port `3000`
- Backend runs on port `3001`

You can change the backend port via the `PORT` environment variable.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

**Made with ❤️ by [Mistiz911](https://github.com/AyaanplayszYT)**

---

<div align="center">

⭐ **Star this repo if you find it helpful!** ⭐

</div>
