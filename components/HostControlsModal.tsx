import React, { useState } from 'react';
import { ShieldCheck, Lock, Unlock, DoorOpen, Users, Check, X, Copy, CheckCheck, UserX } from 'lucide-react';
import { RoomSettings, WaitingUser } from '../types';
import { sound } from '../services/sound';

interface HostControlsModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  roomSettings: RoomSettings;
  waitingUsers: WaitingUser[];
  onToggleLock: () => void;
  onToggleWaitingRoom: () => void;
  onAdmitUser: (odId: string) => void;
  onDenyUser: (odId: string) => void;
  onAdmitAll?: () => void;
}

export const HostControlsModal: React.FC<HostControlsModalProps> = ({
  isOpen,
  onClose,
  roomId,
  roomSettings,
  waitingUsers,
  onToggleLock,
  onToggleWaitingRoom,
  onAdmitUser,
  onDenyUser,
  onAdmitAll,
}) => {
  const [admittingIds, setAdmittingIds] = useState<Set<string>>(new Set());

  const handleAdmit = (odId: string) => {
    setAdmittingIds(prev => new Set(prev).add(odId));
    onAdmitUser(odId);
  };

  const handleDeny = (odId: string) => {
    setAdmittingIds(prev => new Set(prev).add(odId));
    onDenyUser(odId);
  };

  if (!isOpen) return null;

  const handleCopyLink = () => {
    const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAdmitAll = () => {
    if (onAdmitAll) {
      onAdmitAll();
    } else {
      waitingUsers.forEach((u) => onAdmitUser(u.odId));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-zinc-950/85 backdrop-blur-3xl border border-white/15 ring-1 ring-white/10 rounded-[32px] p-6 shadow-[0_25px_70px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.15)] space-y-6 text-white relative">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shadow-inner">
              <ShieldCheck className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Host Controls</h3>
              <p className="text-xs text-zinc-400 font-mono">Room: #{roomId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Room Share Box */}
        <div className="flex items-center justify-between p-4 bg-white/[0.04] border border-white/10 rounded-2xl">
          <div className="space-y-0.5">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest font-bold">Invite Link</span>
            <p className="text-sm font-bold font-mono text-white tracking-wider">#{roomId}</p>
          </div>
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-all border border-white/10 shadow-sm"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Link'}</span>
          </button>
        </div>

        {/* Toggles */}
        <div className="space-y-2.5">
          {/* Lock Room Toggle */}
          <div className="flex items-center justify-between p-4 bg-white/[0.03] border border-white/10 rounded-2xl hover:border-white/20 transition-all">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${roomSettings.isLocked ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-white/5 text-zinc-400'}`}>
                {roomSettings.isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              </div>
              <div>
                <span className="text-sm font-semibold text-white">Lock Room</span>
                <p className="text-xs text-zinc-400">Prevent anyone else from entering</p>
              </div>
            </div>
            <button
              onClick={onToggleLock}
              className={`w-12 h-6 rounded-full transition-all relative ${
                roomSettings.isLocked ? 'bg-rose-500' : 'bg-zinc-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                  roomSettings.isLocked ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Waiting Room Toggle */}
          <div className="flex items-center justify-between p-4 bg-white/[0.03] border border-white/10 rounded-2xl hover:border-white/20 transition-all">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${roomSettings.waitingRoom ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 text-zinc-400'}`}>
                <DoorOpen className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-semibold text-white">Waiting Room</span>
                <p className="text-xs text-zinc-400">Host must admit participants</p>
              </div>
            </div>
            <button
              onClick={onToggleWaitingRoom}
              className={`w-12 h-6 rounded-full transition-all relative ${
                roomSettings.waitingRoom ? 'bg-emerald-500' : 'bg-zinc-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                  roomSettings.waitingRoom ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Waiting Room Queue */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-zinc-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                Waiting for Admission ({waitingUsers.length})
              </span>
            </div>
            {waitingUsers.length > 1 && (
              <button
                onClick={handleAdmitAll}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Admit All
              </button>
            )}
          </div>

          {waitingUsers.length === 0 ? (
            <div className="p-5 text-center bg-white/[0.02] border border-white/5 rounded-2xl">
              <p className="text-xs text-zinc-500">No participants currently in the waiting room.</p>
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
              {waitingUsers.map((user) => (
                <div
                  key={user.odId}
                  className="flex items-center justify-between p-3 bg-white/[0.04] border border-white/10 rounded-xl"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center justify-center text-xs font-bold">
                      {user.userName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-white truncate max-w-[150px]">
                      {user.userName}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={admittingIds.has(user.odId)}
                      onClick={() => handleAdmit(user.odId)}
                      className={`p-1.5 rounded-lg border transition-all ${
                        admittingIds.has(user.odId)
                          ? 'bg-emerald-500/40 text-emerald-200 border-emerald-500/50 cursor-wait'
                          : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border-emerald-500/30'
                      }`}
                      title="Admit user instantly"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={admittingIds.has(user.odId)}
                      onClick={() => handleDeny(user.odId)}
                      className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/30 transition-all"
                      title="Deny user"
                    >
                      <UserX className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Done Button */}
        <button
          onClick={onClose}
          className="w-full py-3.5 rounded-2xl bg-white text-black font-bold hover:bg-zinc-200 transition-all shadow-lg"
        >
          Done
        </button>
      </div>
    </div>
  );
};

export default HostControlsModal;
