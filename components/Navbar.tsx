import React, { useState, useEffect } from 'react';
import { Video, Github, ScrollText, Wifi, WifiOff, Activity, ExternalLink, RefreshCw } from 'lucide-react';
import { checkApiHealth, getApiUrl } from '../services/socket';

interface NavbarProps {
  isConnected: boolean;
  onRefreshRooms?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ isConnected, onRefreshRooms }) => {
  const [apiHealth, setApiHealth] = useState<{ ok: boolean; uptime?: number; latency?: number } | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const apiUrl = getApiUrl();

  const pingHealth = async () => {
    setIsCheckingHealth(true);
    const start = performance.now();
    const result = await checkApiHealth(3000);
    const latency = Math.round(performance.now() - start);

    if (result.ok && result.data) {
      setApiHealth({ ok: true, uptime: result.data.uptime, latency });
    } else {
      setApiHealth({ ok: false });
    }
    setIsCheckingHealth(false);
  };

  useEffect(() => {
    pingHealth();
    const interval = setInterval(pingHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-black/70 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)]">
            <Video className="w-5 h-5 text-white" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-lg text-white tracking-tight">MeshMeet</span>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
              v2.0 P2P
            </span>
          </div>
        </div>

        {/* Right: Actions, Navigation & Status */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* GitHub Source Link */}
          <a
            href="https://github.com/AyaanplayszYT/MeshMeet"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 transition-all text-xs font-medium"
            title="View Source on GitHub"
          >
            <Github className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Source</span>
          </a>

          {/* Changelog Link */}
          <a
            href="https://github.com/AyaanplayszYT/MeshMeet/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 transition-all text-xs font-medium"
            title="View Releases & Changelog"
          >
            <ScrollText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Changelog</span>
          </a>

          {/* API Health Link */}
          <a
            href={`${apiUrl}/health`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 transition-all text-xs font-mono"
            title={`API Health: ${apiUrl}/health`}
          >
            <Activity className={`w-3.5 h-3.5 ${apiHealth?.ok ? 'text-emerald-400' : 'text-amber-400'}`} />
            <span className="hidden md:inline">API</span>
            <ExternalLink className="w-3 h-3 text-zinc-500" />
          </a>

          {/* Connection Status Badge */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold tracking-wide transition-all ${
              isConnected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.15)]'
            }`}
          >
            {isConnected ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <Wifi className="w-3.5 h-3.5" />
                <span className="uppercase text-[11px]">Server Online</span>
                {apiHealth?.latency && (
                  <span className="text-[10px] font-mono text-emerald-500/80 hidden sm:inline">
                    {apiHealth.latency}ms
                  </span>
                )}
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span className="uppercase text-[11px]">Server Offline</span>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
