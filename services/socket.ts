import { io, Socket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents } from '../types';

export const DEFAULT_SOCKET_URL = 'https://api.hostmc.cloud';
export const DEFAULT_API_URL = 'https://api.hostmc.cloud/api';

// Dynamic URL detection
export const getSocketUrl = (): string => {
  const envUrl = import.meta.env.VITE_SOCKET_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim();
  }
  return DEFAULT_SOCKET_URL;
};

export const getApiUrl = (): string => {
  const envApiUrl = import.meta.env.VITE_API_URL;
  if (envApiUrl && envApiUrl.trim()) {
    return envApiUrl.trim();
  }
  const socketUrl = getSocketUrl();
  return `${socketUrl.replace(/\/$/, '')}/api`;
};

const SERVER_URL = getSocketUrl();

export interface ApiHealthResponse {
  status: string;
  uptime: number;
  timestamp: number;
  serverTime: string;
  activeRooms: number;
  publicRooms: number;
  activeConnections: number;
  version: string;
}

export const checkApiHealth = async (timeoutMs = 4000): Promise<{ ok: boolean; data?: ApiHealthResponse; error?: string }> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${getApiUrl()}/health`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    return { ok: true, data };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Connection failed' };
  }
};

export const fetchPublicRoomsApi = async (timeoutMs = 4000) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${getApiUrl()}/rooms`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};


class SignalingService {
  public socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private myUserId: string = '';

  constructor() {
    try {
      this.socket = io(SERVER_URL, {
        transports: ['websocket'],
        autoConnect: false,
        reconnectionAttempts: Infinity,
        timeout: 10000,
      });
    } catch (e) {
      console.warn('Socket.io client failed to initialize.');
    }
  }

  public get connected(): boolean {
      return this.socket?.connected || false;
  }

  public connect(userId: string) {
    this.myUserId = userId;
    
    if (this.socket) {
        this.socket.auth = { userId };
        if (!this.socket.connected) {
            this.socket.connect();
        }
        
        // Remove existing listeners to prevent duplicates if called multiple times
        this.socket.off('connect');
        this.socket.off('connect_error');

        this.socket.on('connect', () => {
            console.log('Connected to Signaling Server');
        });

        this.socket.on('connect_error', (err) => {
            console.warn('Socket connection error:', err.message);
        });
    }
  }

  public async getLatency(): Promise<number> {
      const start = Date.now();
      return new Promise((resolve) => {
          if (!this.socket?.connected) {
              resolve(-1);
              return;
          }

          // Emit ping with ack
          this.socket.emit('ping', () => {
              resolve(Date.now() - start);
          });

          // Timeout fallback
          setTimeout(() => resolve(-1), 1000);
      });
  }

  public on<K extends keyof ServerToClientEvents>(event: string, callback: any) {
    if (this.socket) {
        this.socket.on(event as any, callback);
    }
  }

  public off(event: string, callback?: Function) {
    if (this.socket) {
        if (callback) {
            this.socket.off(event, callback as any);
        } else {
            this.socket.off(event);
        }
    }
  }

  public emit(event: string, ...args: any[]) {
      if (this.socket) {
          // CRITICAL FIX: Do not check this.socket.connected here.
          // Socket.IO client automatically buffers events emitted while disconnected
          // and sends them once the connection is established.
          // Blocking them here causes "ghost rooms" where the user joins locally
          // but the server never receives the join-room event.
          this.socket.emit(event, ...args);
      } else {
          console.warn(`Cannot emit '${event}': Socket not initialized.`);
      }
  }
}

export const signaling = new SignalingService();