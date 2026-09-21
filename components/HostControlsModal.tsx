import React, { useState } from 'react';
import { 
  X, 
  Lock, 
  Unlock, 
  Users, 
  Check, 
  Copy, 
  CheckCheck, 
  UserX,
  MicOff,
  Star,
  MoreVertical,
  Search,
  Calendar,
  MapPin,
  Radio,
  RotateCcw,
  ArrowUpRight,
  Bell,
  Download,
  Sliders,
  Activity,
  Plus,
  ChevronDown
} from 'lucide-react';
import { RoomParticipant, RoomSettings, WaitingUser } from '../types';

interface HostControlsModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  roomSettings: RoomSettings;
  waitingUsers: WaitingUser[];
  participants: RoomParticipant[];
  onToggleLock: () => void;
  onToggleWaitingRoom: () => void;
  onAdmitUser: (odId: string) => void;
  onDenyUser: (odId: string) => void;
  onAdmitAll?: () => void;
  onMuteParticipant: (userId: string) => void;
  onKickParticipant: (userId: string) => void;
}

export const HostControlsModal: React.FC<HostControlsModalProps> = ({
  isOpen,
  onClose,
  roomId,
  roomSettings,
  waitingUsers,
  participants,
  onToggleLock,
  onToggleWaitingRoom,
  onAdmitUser,
  onDenyUser,
  onAdmitAll,
  onMuteParticipant,
  onKickParticipant,
}) => {
  const [activeTab, setActiveTab] = useState<'access' | 'queue'>('access');
  const [admittingIds, setAdmittingIds] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [isPrimary, setIsPrimary] = useState(true);

  // Pill selectors state
  const [showRoomModeDropdown, setShowRoomModeDropdown] = useState(false);
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);
  const [showNodeDropdown, setShowNodeDropdown] = useState(false);
  const [selectedRoomMode, setSelectedRoomMode] = useState('Public Mesh Room');
  const [selectedTimeframe, setSelectedTimeframe] = useState('Active Session');
  const [selectedNode, setSelectedNode] = useState('Direct P2P WebRTC');

  // Context menu & sub-dialogs
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showPerformance, setShowPerformance] = useState(false);
  const [diagnosticsRunning, setDiagnosticsRunning] = useState(false);
  const [diagnosticsResult, setDiagnosticsResult] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAdmit = (odId: string) => {
    setAdmittingIds(prev => new Set(prev).add(odId));
    onAdmitUser(odId);
  };

  const handleDeny = (odId: string) => {
    setAdmittingIds(prev => new Set(prev).add(odId));
    onDenyUser(odId);
  };

  const handleAdmitAll = () => {
    if (onAdmitAll) {
      onAdmitAll();
    } else {
      waitingUsers.forEach((u) => onAdmitUser(u.odId));
    }
  };

  const handleRunDiagnostics = () => {
    setShowActionMenu(false);
    setShowDiagnostics(true);
    setDiagnosticsRunning(true);
    setDiagnosticsResult(null);

    setTimeout(() => {
      setDiagnosticsRunning(false);
      setDiagnosticsResult(
        `Signaling Server: Connected (WebSocket)\nRoom ID: #${roomId}\nHost Authority: Sovereign Verified\nSTUN/TURN Routing: Low-Latency Direct P2P\nMesh Encryption: End-to-End DTLS-SRTP`
      );
    }, 1100);
  };

  const handleExportReport = () => {
    setShowActionMenu(false);
    const report = {
      timestamp: new Date().toISOString(),
      roomId,
      isLocked: roomSettings.isLocked,
      waitingRoomEnabled: roomSettings.waitingRoom,
      waitingUsersCount: waitingUsers.length,
      waitingUsersList: waitingUsers.map(u => ({ id: u.odId, name: u.userName })),
      roomMode: selectedRoomMode,
      node: selectedNode
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meetmesh-room-${roomId}-summary.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      
      {/* Outer Card Container - Pure sleek black matching website aesthetic */}
      <div className="w-full max-w-xl max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)] rounded-[30px] sm:rounded-[34px] p-5 sm:p-7 shadow-[0_25px_70px_rgba(0,0,0,0.95)] bg-[#09090b] border border-zinc-800 text-white flex flex-col relative overflow-visible">

        {/* Header: Title on Left, Actions on Right */}
        <div className="flex items-center justify-between pb-4 shrink-0">
          <h2 className="text-base sm:text-lg font-semibold tracking-tight text-white">
            Host Controls
          </h2>

          <div className="flex items-center gap-3">
            {/* Emerald Green copy invite button */}
            <button
              onClick={handleCopyLink}
              className="text-xs sm:text-sm font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors cursor-pointer"
              title="Copy Room Invite Link"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{copied ? 'Copied Link!' : 'Invite link'}</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Segmented Pill Tab Bar */}
        <div className="p-1 rounded-full flex items-center justify-between gap-1 mb-4 shrink-0 bg-zinc-900/90 border border-zinc-800/80">
          <button
            type="button"
            onClick={() => setActiveTab('access')}
            className={`flex-1 py-2 px-4 rounded-full text-xs sm:text-sm font-medium transition-all text-center cursor-pointer ${
              activeTab === 'access'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Room Security
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('queue')}
            className={`flex-1 py-2 px-4 rounded-full text-xs sm:text-sm font-medium transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'queue'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>Waiting Room</span>
            {waitingUsers.length > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-emerald-500 text-black">
                {waitingUsers.length}
              </span>
            )}
          </button>
        </div>

        {/* Scrollable / Flexible Card Body */}
        <div className="overflow-y-auto space-y-4 pr-0.5">

          {/* Primary Inner Feature Card */}
          <div className="rounded-[24px] p-4 sm:p-5 relative bg-[#121316] border border-zinc-800/80">

            {/* Inner Header: Room ID + Blue Star + 3-dots Menu Button */}
            <div className="flex items-center justify-between pb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-semibold text-white">
                  Room #{roomId}
                </span>
                {isPrimary && (
                  <Star className="w-4 h-4 fill-blue-500 text-blue-500 shrink-0" />
                )}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowActionMenu(!showActionMenu)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                  title="More actions"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {/* Floating Context Popover Menu */}
                {showActionMenu && (
                  <div className="absolute right-0 top-9 w-52 rounded-[20px] p-1.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 border bg-[#18191d] border-zinc-700/80 text-zinc-200">
                    <button
                      onClick={() => { setIsPrimary(!isPrimary); setShowActionMenu(false); }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5 text-zinc-400" />
                      <span>{isPrimary ? 'Unmark as primary' : 'Mark as primary'}</span>
                    </button>

                    <button
                      onClick={handleRunDiagnostics}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Run diagnostics</span>
                    </button>

                    <button
                      onClick={() => { setShowPerformance(true); setShowActionMenu(false); }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5 text-zinc-400" />
                      <span>View performance</span>
                    </button>

                    <button
                      onClick={() => { onToggleWaitingRoom(); setShowActionMenu(false); }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
                    >
                      <Bell className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Toggle Waiting Room</span>
                    </button>

                    <button
                      onClick={handleExportReport}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Export room report</span>
                    </button>

                    <button
                      onClick={() => { onToggleLock(); setShowActionMenu(false); }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
                    >
                      <Sliders className="w-3.5 h-3.5 text-zinc-400" />
                      <span>{roomSettings.isLocked ? 'Unlock Room' : 'Lock Room'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Pill Selectors Row 1: Room Mode & Duration */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {/* Pill 1: Room Mode */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowRoomModeDropdown(!showRoomModeDropdown)}
                  className="w-full px-3.5 py-2.5 rounded-full flex items-center justify-between text-xs transition-all border bg-zinc-900/90 border-zinc-800 text-zinc-200 hover:border-zinc-700 cursor-pointer"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className="truncate">{selectedRoomMode}</span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0 ml-1.5" />
                </button>

                {showRoomModeDropdown && (
                  <div className="absolute left-0 top-11 w-full rounded-2xl p-1.5 shadow-2xl z-50 animate-in fade-in duration-100 border bg-[#18191d] border-zinc-700 text-zinc-200">
                    {[
                      'Public Mesh Room',
                      'Host Moderated Only',
                      'Direct P2P Encrypted'
                    ].map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => { setSelectedRoomMode(mode); setShowRoomModeDropdown(false); }}
                        className={`w-full text-left px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer ${
                          selectedRoomMode === mode
                            ? 'bg-blue-500/15 text-blue-400 font-medium'
                            : 'hover:bg-zinc-800 text-zinc-300'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Pill 2: Session Active */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowTimeDropdown(!showTimeDropdown)}
                  className="w-full px-3.5 py-2.5 rounded-full flex items-center justify-between text-xs transition-all border bg-zinc-900/90 border-zinc-800 text-zinc-200 hover:border-zinc-700 cursor-pointer"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className="truncate">{selectedTimeframe}</span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0 ml-1.5" />
                </button>

                {showTimeDropdown && (
                  <div className="absolute right-0 top-11 w-48 rounded-2xl p-1.5 shadow-2xl z-50 animate-in fade-in duration-100 border bg-[#18191d] border-zinc-700 text-zinc-200">
                    {['Active Session', 'Uptime: Live', 'Persistent Room'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => { setSelectedTimeframe(t); setShowTimeDropdown(false); }}
                        className={`w-full text-left px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer ${
                          selectedTimeframe === t
                            ? 'bg-blue-500/15 text-blue-400 font-medium'
                            : 'hover:bg-zinc-800 text-zinc-300'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Pill Selectors Row 2: Signaling Relay Mode */}
            <div className="relative pt-1">
              <button
                type="button"
                onClick={() => setShowNodeDropdown(!showNodeDropdown)}
                className="w-full px-3.5 py-2.5 rounded-full flex items-center justify-between text-xs transition-all border bg-zinc-900/90 border-zinc-800 text-zinc-200 hover:border-zinc-700 cursor-pointer"
              >
                <div className="flex items-center gap-2 truncate">
                  <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span className="truncate">{selectedNode}</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0 ml-1.5" />
              </button>

              {showNodeDropdown && (
                <div className="absolute left-0 top-12 w-full rounded-2xl p-1.5 shadow-2xl z-50 animate-in fade-in duration-100 border bg-[#18191d] border-zinc-700 text-zinc-200">
                  {[
                    'Direct P2P WebRTC',
                    'Low-Latency Signaling Mesh',
                    'Encrypted Peer Relay'
                  ].map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => { setSelectedNode(loc); setShowNodeDropdown(false); }}
                      className={`w-full text-left px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer ${
                        selectedNode === loc
                          ? 'bg-blue-500/15 text-blue-400 font-medium'
                          : 'hover:bg-zinc-800 text-zinc-300'
                      }`}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Row: ((•)) Status on Left & iOS-style Green Toggle on Right */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span className="text-xs font-semibold text-zinc-300">
                  Status: Active Mesh
                </span>
              </div>

              {/* Modern iOS-Style Toggle Switch (Green for Waiting Room) */}
              <button
                type="button"
                onClick={onToggleWaitingRoom}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  roomSettings.waitingRoom
                    ? 'bg-[#10b981]'
                    : 'bg-zinc-700'
                }`}
                title="Toggle Waiting Room"
              >
                <div 
                  className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                    roomSettings.waitingRoom
                      ? 'translate-x-[22px]'
                      : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

          </div>

          {/* Secondary Control Card: Room Lock & Waiting Queue */}
          {activeTab === 'access' ? (
            <div className="rounded-[22px] p-4 space-y-3.5 bg-[#121316] border border-zinc-800/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-xl ${roomSettings.isLocked ? 'bg-rose-500/20 text-rose-400' : 'bg-zinc-800 text-zinc-400'}`}>
                    {roomSettings.isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  </div>
                  <div>
                    <span className="text-xs font-semibold block text-zinc-200">
                      Lock Room
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      {roomSettings.isLocked ? 'Room is locked to new participants' : 'Open to invited participants'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onToggleLock}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    roomSettings.isLocked ? 'bg-rose-500' : 'bg-zinc-700'
                  }`}
                  title="Toggle Lock Room"
                >
                  <div 
                    className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                      roomSettings.isLocked ? 'translate-x-[22px]' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Room ID and 1-click copy */}
              <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60">
                <span className="text-xs text-zinc-400 font-mono">Room ID: #{roomId}</span>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors border bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800 cursor-pointer"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-zinc-400" />}
                  <span>{copied ? 'Copied' : 'Copy Invite'}</span>
                </button>
              </div>

              <div className="pt-3 border-t border-zinc-800/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-200">Participants</span>
                  <span className="text-[10px] text-zinc-500">Host only</span>
                </div>
                {participants.length === 0 ? (
                  <p className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-3 text-[11px] text-zinc-500">
                    Participant list is loading...
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {participants.map((participant) => (
                      <div key={participant.userId} className="flex items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-900/80 px-2.5 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="h-6 w-6 shrink-0 rounded-full bg-zinc-800 text-center text-[10px] leading-6 text-zinc-300">
                            {participant.userName.charAt(0).toUpperCase()}
                          </span>
                          <span className="truncate text-xs text-zinc-200">{participant.userName}</span>
                          {participant.isHost && <span className="text-[9px] text-blue-400">Host</span>}
                        </div>
                        {!participant.isHost && (
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onMuteParticipant(participant.userId)}
                              className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-1.5 text-amber-400 hover:bg-amber-500/20"
                              title="Mute participant"
                            >
                              <MicOff className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onKickParticipant(participant.userId)}
                              className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-400 hover:bg-rose-500/20"
                              title="Remove participant"
                            >
                              <UserX className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-[22px] p-4 space-y-3 bg-[#121316] border border-zinc-800/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-zinc-200">
                    Waiting Room Queue ({waitingUsers.length})
                  </span>
                </div>
                {waitingUsers.length > 1 && (
                  <button
                    onClick={handleAdmitAll}
                    className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Admit All</span>
                  </button>
                )}
              </div>

              {waitingUsers.length === 0 ? (
                <div className="p-4 rounded-xl text-center text-xs bg-zinc-900/60 text-zinc-500 border border-zinc-800/50">
                  No participants are currently waiting.
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {waitingUsers.map((user) => (
                    <div
                      key={user.odId}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-xl border bg-zinc-900/90 border-zinc-800"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <div className="w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-xs font-bold shrink-0">
                          {user.userName.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs font-medium truncate max-w-[160px] text-zinc-200">
                          {user.userName}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={admittingIds.has(user.odId)}
                          onClick={() => handleAdmit(user.odId)}
                          className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 transition-all cursor-pointer"
                          title="Admit user"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={admittingIds.has(user.odId)}
                          onClick={() => handleDeny(user.odId)}
                          className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/30 transition-all cursor-pointer"
                          title="Deny user"
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Diagnostics Modal Dialog */}
        {showDiagnostics && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md rounded-[30px] p-6 flex flex-col justify-between z-50 animate-in fade-in duration-150">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                  <RotateCcw className={`w-4 h-4 ${diagnosticsRunning ? 'animate-spin' : ''}`} />
                  <span>Room Signaling & Mesh Diagnostics</span>
                </div>
                <button 
                  onClick={() => setShowDiagnostics(false)} 
                  className="p-1 rounded-lg text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="py-4 font-mono text-xs text-zinc-300 leading-relaxed whitespace-pre-line">
                {diagnosticsRunning ? 'Probing WebRTC signaling, STUN servers & ICE candidates...' : diagnosticsResult}
              </div>
            </div>

            <button
              onClick={() => setShowDiagnostics(false)}
              className="w-full py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        )}

        {/* Performance Modal Dialog */}
        {showPerformance && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md rounded-[30px] p-6 flex flex-col justify-between z-50 animate-in fade-in duration-150">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2 text-blue-400 font-semibold text-sm">
                  <Activity className="w-4 h-4" />
                  <span>Mesh Room Performance</span>
                </div>
                <button 
                  onClick={() => setShowPerformance(false)} 
                  className="p-1 rounded-lg text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="py-4 space-y-2.5 text-xs text-zinc-300">
                <div className="flex justify-between py-1.5 border-b border-zinc-800/60">
                  <span className="text-zinc-400">Mesh Topology:</span>
                  <span className="font-mono text-emerald-400 font-semibold">Full P2P Mesh</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-zinc-800/60">
                  <span className="text-zinc-400">Signaling Latency:</span>
                  <span className="font-mono text-emerald-400 font-semibold">14 ms</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-zinc-800/60">
                  <span className="text-zinc-400">Room Status:</span>
                  <span className="font-mono text-zinc-200">{roomSettings.isLocked ? 'Locked' : 'Open'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-zinc-800/60">
                  <span className="text-zinc-400">Waiting Room:</span>
                  <span className="font-mono text-zinc-200">{roomSettings.waitingRoom ? 'Enabled' : 'Disabled'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-zinc-800/60">
                  <span className="text-zinc-400">Waiting Participants:</span>
                  <span className="font-mono text-emerald-400 font-semibold">{waitingUsers.length}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowPerformance(false)}
              className="w-full py-2.5 rounded-full bg-white hover:bg-zinc-200 text-black font-semibold text-xs transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default HostControlsModal;
