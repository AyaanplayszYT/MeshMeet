import React, { useState, useEffect } from 'react';
import { Github, ScrollText, Wifi, WifiOff, Activity, ExternalLink } from 'lucide-react';
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
    <header className="sticky top-4 sm:top-5 z-40 w-full flex justify-center px-3 sm:px-6 pointer-events-none">
      {/* True Glassmorphic Pill Navbar */}
      <div className="max-w-4xl w-full bg-zinc-950/40 backdrop-blur-3xl border border-white/15 ring-1 ring-white/10 rounded-full px-3.5 sm:px-5 py-2 flex items-center justify-between gap-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.55),inset_0_1px_1px_0_rgba(255,255,255,0.15)] pointer-events-auto transition-all hover:border-white/20">
        
        {/* Left: Brand Identity with favicon.ico */}
        <div className="flex items-center gap-2.5">
          <img 
            src="/favicon.ico" 
            alt="MeetMesh" 
            className="w-8 h-8 rounded-xl object-contain drop-shadow-[0_0_12px_rgba(255,255,255,0.25)]" 
          />
          <span className="font-bold text-base sm:text-lg text-white tracking-tight drop-shadow-sm">
            MeshMeet
          </span>
        </div>

        {/* Right: Glass Actions, Navigation & Status */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* GitHub Source Link */}
          <a
            href="https://github.com/AyaanplayszYT/MeshMeet"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-zinc-300 hover:text-white transition-all text-xs font-medium backdrop-blur-md shadow-sm"
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-zinc-300 hover:text-white transition-all text-xs font-medium backdrop-blur-md shadow-sm"
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-zinc-300 hover:text-white transition-all text-xs font-mono backdrop-blur-md shadow-sm"
            title={`API Health: ${apiUrl}/health`}
          >
            <Activity className={`w-3.5 h-3.5 ${apiHealth?.ok ? 'text-emerald-400' : 'text-amber-400'}`} />
            <span className="hidden md:inline">API</span>
            <ExternalLink className="w-3 h-3 text-zinc-500" />
          </a>

          {/* Connection Status Badge */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold tracking-wide backdrop-blur-md transition-all ${
              isConnected
                ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.2)]'
                : 'bg-rose-500/15 border-rose-400/30 text-rose-400 shadow-[0_0_16px_rgba(244,63,94,0.2)]'
            }`}
          >
            {isConnected ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <Wifi className="w-3.5 h-3.5" />
                <span className="uppercase text-[11px] hidden xs:inline">Online</span>
                {apiHealth?.latency && (
                  <span className="text-[10px] font-mono text-emerald-300/90 hidden sm:inline">
                    {apiHealth.latency}ms
                  </span>
                )}
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span className="uppercase text-[11px]">Offline</span>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
