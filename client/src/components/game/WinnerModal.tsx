import React from 'react';
import { motion } from 'framer-motion';
import { Award, Home, RotateCcw, Trophy } from 'lucide-react';
import { ACHIEVEMENTS, type MatchWinnerInfo } from '@shared/types';
import { useSettingsStore } from '../../store/useSettingsStore';
import { AvatarBadge } from '../AvatarBadge';

interface WinnerModalProps {
  winner: MatchWinnerInfo;
  myPlayerId: string;
  isHost: boolean;
  onReturnToLobby: () => void;
  onLeaveToHome: () => void;
}

const PARTICLES = Array.from({ length: 18 }).map((_, i) => ({
  id: i,
  left: `${6 + ((i * 5.3) % 88)}%`,
  color: i % 3 === 0 ? '#E6B84C' : i % 3 === 1 ? '#1CD696' : '#10B981',
  delay: (i % 6) * 0.18,
  duration: 2.2 + (i % 4) * 0.45,
}));

export const WinnerModal: React.FC<WinnerModalProps> = ({
  winner,
  myPlayerId,
  isHost,
  onReturnToLobby,
  onLeaveToHome,
}) => {
  const { reducedMotion } = useSettingsStore();
  const iWon = winner.winnerId === myPlayerId;
  const myNewAchievements = winner.newlyUnlockedAchievements[myPlayerId] ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#070504]/85 p-4 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto overflow-x-hidden rounded-3xl border border-[#E6B84C]/45 bg-[#18130F] p-6 sm:p-8 shadow-2xl"
      >
        {/* Subtle celebration particles */}
        {!reducedMotion && (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-44 overflow-hidden">
            {PARTICLES.map((p) => (
              <motion.span
                key={p.id}
                initial={{ y: -12, opacity: 0, rotate: 0 }}
                animate={{ y: 170, opacity: [0, 0.85, 0], rotate: 180 }}
                transition={{
                  delay: p.delay,
                  duration: p.duration,
                  repeat: Infinity,
                  ease: 'easeOut',
                }}
                style={{ left: p.left, backgroundColor: p.color }}
                className="absolute top-0 h-2 w-1.5 rounded-sm"
              />
            ))}
          </div>
        )}

        <div className="relative z-10 text-center">
          <motion.div
            initial={{ scale: 0.78, rotate: -4 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 20 }}
            className="mx-auto mb-4 h-28 w-28 overflow-hidden rounded-3xl border-2 border-amber-400 shadow-[0_0_40px_rgba(251,191,36,0.35)]"
          >
            <img
              src="https://i.imgflip.com/39t1o.jpg"
              alt="Asli Khiladi Winner"
              className="h-full w-full object-cover"
            />
          </motion.div>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 border border-amber-400/40 px-3.5 py-1 font-[var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.2em] text-amber-300">
            <Trophy className="h-3.5 w-3.5" />
            {iWon ? 'BAAP OF BLUFF · ASLI KHILADI!' : 'KHATAM, TATA, BYE-BYE!'}
          </span>

          <h2 className="mt-2 font-[var(--font-display)] text-3xl sm:text-4xl font-extrabold text-[#FAF3E3]">
            {winner.winnerName} Wins!
          </h2>

          <p className="mt-1 text-xs text-[#B9A992]">
            Sabko ullu bana diya in {winner.totalRounds} rounds ({winner.durationSec}s)
          </p>
        </div>

        {/* Newly Unlocked Achievements */}
        {myNewAchievements.length > 0 && (
          <div className="relative z-10 mt-6 rounded-2xl bg-[#E6B84C]/12 border border-[#E6B84C]/40 p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#FAF3E3]">
              <Award className="h-4 w-4 text-amber-300" />
              New Achievements Unlocked!
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {myNewAchievements.map((id) => {
                const def = ACHIEVEMENTS.find((a) => a.id === id);
                if (!def) return null;
                return (
                  <div
                    key={id}
                    className="rounded-xl bg-[#120E0B] border border-amber-400/35 px-3 py-2"
                  >
                    <p className="text-xs font-bold text-amber-300">{def.title}</p>
                    <p className="text-[10px] text-[#B9A992]">{def.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Standings & Match Reputation */}
        <div className="relative z-10 mt-6 space-y-2">
          <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-wider text-[#B9A992]">
            TABLE STANDINGS & REPUTATION
          </p>
          {winner.standings.map((row, idx) => (
            <div
              key={row.playerId}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 border ${
                row.playerId === winner.winnerId
                  ? 'bg-amber-400/10 border-amber-400/35'
                  : 'bg-[#120E0B] border-white/[0.06]'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="font-[var(--font-mono)] text-xs font-bold text-[#B9A992]">
                  #{idx + 1}
                </span>
                <AvatarBadge avatar={row.avatar} size="xs" isBot={row.isBot} />
                <div>
                  <p className="text-xs font-bold text-[#FAF3E3]">{row.username}</p>
                  <p className="font-[var(--font-mono)] text-[10px] text-[#B9A992]">
                    {row.cardsRemaining === 0
                      ? 'EMPTY HAND'
                      : `${row.cardsRemaining} cards left`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 font-[var(--font-mono)] text-[11px]">
                <span className="text-[#E6B84C]">
                  {row.matchStats.successfulBluffs} Bluffs
                </span>
                <span className="text-[#1CD696]">
                  {row.matchStats.correctChallenges} Reads
                </span>
                <span className="text-[#FF9BA6]">
                  {row.matchStats.failedBluffs} Caught
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="relative z-10 mt-7 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onLeaveToHome}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/[0.05] border border-white/10 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-[#DFD2BE] hover:bg-white/10 hover:text-white cursor-pointer"
          >
            <Home className="h-4 w-4" />
            Return Home
          </button>
          {isHost && (
            <button
              type="button"
              onClick={onReturnToLobby}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#E6B84C] px-6 py-3 text-xs font-bold uppercase tracking-wider text-[#0B0907] hover:bg-[#F3CF7A] cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
              Play Again (Lobby)
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
