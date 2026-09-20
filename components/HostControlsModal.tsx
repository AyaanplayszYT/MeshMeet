import React, { useState } from 'react';
import { ShieldCheck, Lock, Unlock, DoorOpen, Users, Check, X, Copy, ShieldAlert, CheckCheck, UserCheck } from 'lucide-react';
import { RoomSettings, WaitingUser } from '../types';

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
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(roomId);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-6 text-white relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Host Controls</h3>
              <p className="text-xs text-zinc-400 font-mono">Room ID: #{roomId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Room Share Box */}
        <div className="flex items-center justify-between p-3.5 bg-black/50 border border-zinc-800 rounded-2xl">
          <div className="space-y-0.5">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Room Code</span>
            <p className="text-base font-bold font-mono text-white tracking-widest">{roomId}</p>
          </div>
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white transition-all"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Code'}</span>
          </button>
        </div>

        {/* Toggles */}
        <div className="space-y-3">
          {/* Lock Room Toggle */}
          <div className="flex items-center justify-between p-4 bg-zinc-800/40 border border-zinc-800/80 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${roomSettings.isLocked ? 'bg-rose-500/20 text-rose-400' : 'bg-zinc-800 text-zinc-400'}`}>
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
          <div className="flex items-center justify-between p-4 bg-zinc-800/40 border border-zinc-800/80 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${roomSettings.waitingRoom ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}`}>
                <DoorOpen className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-semibold text-white">Waiting Room</span>
                <p className="text-xs text-zinc-400">Review participants before admission</p>
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
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Waiting for Approval ({waitingUsers.length})
              </span>
            </div>
            {waitingUsers.length > 1 && (
              <button
                onClick={handleAdmitAll}
                className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Admit All
              </button>
            )}
          </div>

          {waitingUsers.length === 0 ? (
            <div className="p-4 rounded-2xl bg-black/30 border border-zinc-800/60 text-center">
              <p className="text-xs text-zinc-500">No participants currently in the waiting room.</p>
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
              {waitingUsers.map((user) => (
                <div
                  key={user.odId}
                  className="flex items-center justify-between p-3 bg-zinc-800/60 border border-zinc-700/60 rounded-xl"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-xs text-white uppercase flex-shrink-0">
                      {user.userName.charAt(0) || 'U'}
                    </div>
                    <div className="truncate">
                      <p className="text-sm font-medium text-white truncate">{user.userName}</p>
                      <p className="text-[10px] font-mono text-zinc-500 truncate">ID: {user.odId}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                    <button
                      onClick={() => onAdmitUser(user.odId)}
                      className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                      title="Admit Participant"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDenyUser(user.odId)}
                      className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition-colors"
                      title="Deny Access"
                    >
                      <X className="w-4 h-4" />
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
          className="w-full py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold transition-colors"
        >
          Close Panel
        </button>
      </div>
    </div>
  );
};

export default HostControlsModal;
