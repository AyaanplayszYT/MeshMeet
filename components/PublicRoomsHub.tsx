import React, { useState, useMemo } from 'react';
import { Globe, Users, Lock, DoorOpen, Search, RefreshCw, Plus, Copy, Check, ArrowRight, Radio } from 'lucide-react';
import { RoomInfo } from '../types';

interface PublicRoomsHubProps {
  rooms: RoomInfo[];
  onJoinRoom: (room: RoomInfo) => void;
  onCreateRoom: () => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export const PublicRoomsHub: React.FC<PublicRoomsHubProps> = ({
  rooms,
  onJoinRoom,
  onCreateRoom,
  onRefresh,
  isRefreshing = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredRooms = useMemo(() => {
    if (!searchQuery.trim()) return rooms;
    const q = searchQuery.toLowerCase().trim();
    return rooms.filter(
      (r) =>
        r.roomId.toLowerCase().includes(q) ||
        (r.name && r.name.toLowerCase().includes(q))
    );
  }, [rooms, searchQuery]);

  const totalParticipants = useMemo(() => {
    return rooms.reduce((sum, r) => sum + (r.count || 0), 0);
  }, [rooms]);

  const handleCopyId = (e: React.MouseEvent, roomId: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(roomId);
    setCopiedId(roomId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <section className="w-full space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Radio className="w-5 h-5 text-blue-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-white tracking-tight">Active Public Rooms</h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
                {rooms.length}
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              {totalParticipants} participant{totalParticipants === 1 ? '' : 's'} across all mesh networks
            </p>
          </div>
        </div>

        {/* Search & Refresh Actions */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or code..."
              className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-all"
            />
          </div>

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-all disabled:opacity-50"
            title="Refresh Rooms List"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Rooms Grid */}
      {filteredRooms.length === 0 ? (
        <div className="relative overflow-hidden rounded-[22px] border border-dashed border-zinc-700 bg-zinc-900 p-10 text-center shadow-[0_12px_28px_rgba(0,0,0,0.2)]">
          <div className="mx-auto w-14 h-14 rounded-xl bg-zinc-950 border border-zinc-700 flex items-center justify-center mb-4 text-zinc-500">
            <Globe className="w-7 h-7" />
          </div>
          <h4 className="text-lg font-semibold text-white mb-1">
            {searchQuery ? 'No rooms matching your search' : 'No public rooms live right now'}
          </h4>
          <p className="text-sm text-zinc-500 max-w-md mx-auto mb-6">
            {searchQuery
              ? 'Try searching with another room name or room ID code.'
              : 'Create a new room and set it to Public to allow others across the network to discover and join.'}
          </p>
          <button
            onClick={onCreateRoom}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black font-semibold text-sm hover:bg-zinc-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:scale-105"
          >
            <Plus className="w-4 h-4" />
            Start a New Room
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRooms.map((room) => {
            const isLocked = room.isLocked;
            const hasWaitingRoom = room.waitingRoom;

            return (
              <div
                key={room.roomId}
                className="group relative flex flex-col justify-between rounded-[22px] border border-zinc-700 bg-zinc-900 p-5 transition-all duration-200 hover:border-zinc-600 hover:bg-zinc-800 hover:shadow-[0_14px_30px_rgba(0,0,0,0.3)]"
              >
                {/* Background glow on hover */}
                <div className="absolute inset-0 rounded-[22px] bg-white/[0.025] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                <div className="space-y-3 relative z-10">
                  {/* Top row: Badges & Copy button */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        <Globe className="w-3 h-3" />
                        Public
                      </span>

                      {isLocked && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <Lock className="w-3 h-3" />
                          Locked
                        </span>
                      )}

                      {hasWaitingRoom && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <DoorOpen className="w-3 h-3" />
                          Waiting Room
                        </span>
                      )}
                    </div>

                    <button
                      onClick={(e) => handleCopyId(e, room.roomId)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
                      title="Copy Room ID"
                    >
                      {copiedId === room.roomId ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Room Name & ID */}
                  <div>
                    <h4 className="font-bold text-white text-base tracking-tight truncate group-hover:text-blue-300 transition-colors">
                      {room.name || `Room ${room.roomId}`}
                    </h4>
                    <span className="text-xs font-mono text-zinc-500 tracking-wider">
                      #{room.roomId}
                    </span>
                  </div>
                </div>

                {/* Bottom row: Participants & Join Button */}
                <div className="flex items-center justify-between pt-4 border-t border-zinc-800/80 mt-4 relative z-10">
                  <div className="flex items-center gap-2 text-zinc-300 text-xs font-medium bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-700">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <Users className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{room.count} online</span>
                  </div>

                  <button
                    onClick={() => onJoinRoom(room)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-white text-black hover:bg-zinc-200 transition-all transform hover:scale-105 shadow-md group-hover:shadow-white/10"
                  >
                    <span>Join</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default PublicRoomsHub;
