import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Loader2, Users, X } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';

export const QuickPlayOverlay: React.FC = () => {
  const { quickPlay, cancelQuickPlay, quickPlayFillBots } = useGameStore();

  return (
    <AnimatePresence>
      {quickPlay?.searching && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#070504]/80 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            className="relative z-10 w-full max-w-md rounded-2xl bg-[#18130F] border border-[#E6B84C]/35 p-6 text-center shadow-2xl"
          >
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E6B84C]/15 border border-[#E6B84C]/40">
              <Loader2 className="h-8 w-8 animate-spin text-[#E6B84C]" />
            </div>

            <span className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.25em] text-[#1CD696]">
              QUICK PLAY MATCHMAKING
            </span>
            <h3 className="mt-1.5 font-[var(--font-display)] text-2xl font-bold text-[#FAF3E3]">
              Searching for Players...
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-[#B9A992]">
              Auto-matching 2–6 players. Game launches automatically as soon as at least{' '}
              {quickPlay.minPlayers} players enter the queue.
            </p>

            <div className="mt-5 flex items-center justify-center gap-4 rounded-xl bg-[#120E0B] border border-white/[0.06] py-3.5 px-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#1CD696]" />
                <span className="font-[var(--font-mono)] text-sm font-bold text-[#FAF3E3]">
                  {quickPlay.queueSize} / 6
                </span>
                <span className="text-xs text-[#B9A992]">in queue</span>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={quickPlayFillBots}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#E6B84C] py-3 text-xs font-bold uppercase tracking-wider text-[#0B0907] transition hover:bg-[#F3CF7A] cursor-pointer"
              >
                <Bot className="h-4 w-4" />
                Start Now with AI Opponents
              </button>
              <button
                type="button"
                onClick={cancelQuickPlay}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-white/[0.04] py-2.5 text-xs font-semibold text-[#B9A992] hover:bg-white/10 hover:text-white cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
                Cancel Search
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
