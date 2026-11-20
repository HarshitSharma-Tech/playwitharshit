import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Eye, KeyRound, Lock, RefreshCw, Users, X } from 'lucide-react';
import type { PublicRoomSummary } from '@shared/types';
import { api } from '../../lib/api';
import { useGameStore } from '../../store/useGameStore';

interface JoinRoomModalProps {
  open: boolean;
  prefillCode?: string;
  onClose: () => void;
}

export const JoinRoomModal: React.FC<JoinRoomModalProps> = ({
  open,
  prefillCode = '',
  onClose,
}) => {
  const { joinRoom } = useGameStore();
  const [code, setCode] = useState(prefillCode);
  const [password, setPassword] = useState('');
  const [asSpectator, setAsSpectator] = useState(false);
  const [rooms, setRooms] = useState<PublicRoomSummary[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (prefillCode) setCode(prefillCode.toUpperCase());
  }, [prefillCode]);

  const fetchRooms = async () => {
    setLoadingRooms(true);
    try {
      const res = await api.getPublicRooms();
      setRooms(res.rooms);
    } catch {
      // ignore
    } finally {
      setLoadingRooms(false);
    }
  };

  useEffect(() => {
    if (open) {
      setError(null);
      fetchRooms();
    }
  }, [open]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = code.trim().toUpperCase();
    if (cleaned.length < 4) {
      setError('Enter a valid 6-character room code.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await joinRoom(cleaned, password.trim() || undefined, asSpectator);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to join room.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#070504]/80 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            className="relative z-10 w-full max-w-lg rounded-2xl bg-[#18130F] border border-white/10 shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-5">
              <div>
                <span className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[#1CD696]">
                  ENTER A TABLE
                </span>
                <h2 className="mt-1 font-[var(--font-display)] text-xl font-bold text-[#FAF3E3]">
                  Join Private Room
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] text-[#B9A992] hover:bg-white/10 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleJoin} className="space-y-4 p-6">
              {error && (
                <div className="rounded-xl border border-[#E1384B]/40 bg-[#E1384B]/10 px-4 py-2.5 text-xs text-[#FF9BA6]">
                  {error}
                </div>
              )}

              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#B9A992]">
                  <KeyRound className="h-3.5 w-3.5 text-[#E6B84C]" />
                  6-Character Room Code
                </label>
                <input
                  type="text"
                  maxLength={8}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  placeholder="E.g. K7X9MP"
                  className="w-full rounded-xl bg-[#120E0B] border border-white/10 px-4 py-3 text-center font-[var(--font-mono)] text-xl font-bold tracking-[0.35em] text-[#FAF3E3] placeholder-[#434A63] focus:border-[#1CD696] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#B9A992]">
                    <Lock className="h-3.5 w-3.5" />
                    Password (If locked)
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Optional"
                    className="w-full rounded-xl bg-[#120E0B] border border-white/10 px-3.5 py-2.5 text-sm text-[#FAF3E3] placeholder-[#4E5670] focus:border-[#E6B84C] focus:outline-none"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <button
                    type="button"
                    onClick={() => setAsSpectator(!asSpectator)}
                    className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 border text-xs font-semibold transition cursor-pointer ${
                      asSpectator
                        ? 'bg-[#1CD696]/15 border-[#1CD696]/50 text-[#1CD696]'
                        : 'bg-[#120E0B] border-white/10 text-[#B9A992]'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5" />
                      Join as Spectator
                    </span>
                    <span className="font-[var(--font-mono)] text-[10px]">
                      {asSpectator ? 'ON' : 'OFF'}
                    </span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || code.trim().length < 4}
                className="w-full rounded-xl bg-[#1CD696] py-3 text-xs font-bold uppercase tracking-wider text-[#0B0907] shadow-lg transition hover:bg-[#3EE4AB] disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'Connecting...' : asSpectator ? 'Enter as Spectator' : 'Join Room'}
              </button>
            </form>

            {/* Live Open Tables */}
            <div className="border-t border-white/[0.06] bg-[#15100C] px-6 py-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[#B9A992]">
                  ACTIVE TABLES ({rooms.length})
                </span>
                <button
                  type="button"
                  onClick={fetchRooms}
                  className="flex items-center gap-1 text-[11px] text-[#1CD696] hover:underline cursor-pointer"
                >
                  <RefreshCw className={`h-3 w-3 ${loadingRooms ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {rooms.length === 0 ? (
                <p className="py-3 text-center text-xs text-[#6F7791]">
                  No active rooms open right now. Create one or invite friends!
                </p>
              ) : (
                <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                  {rooms.map((r) => (
                    <button
                      key={r.code}
                      type="button"
                      onClick={() => setCode(r.code)}
                      className="flex w-full items-center justify-between rounded-xl bg-[#18130F] border border-white/[0.07] px-3.5 py-2.5 text-left transition hover:border-[#E6B84C]/50 cursor-pointer"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[#FAF3E3]">{r.roomName}</span>
                          {r.hasPassword && <Lock className="h-3 w-3 text-amber-400" />}
                        </div>
                        <span className="font-[var(--font-mono)] text-[10px] text-[#E6B84C]">
                          {r.code} · {r.difficulty.toUpperCase()} · {r.status.toUpperCase()}
                        </span>
                      </div>
                      <span className="flex items-center gap-1 rounded-lg bg-white/[0.05] px-2 py-1 font-[var(--font-mono)] text-xs text-[#DFD2BE]">
                        <Users className="h-3 w-3 text-[#1CD696]" />
                        {r.playerCount}/{r.maxPlayers}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
