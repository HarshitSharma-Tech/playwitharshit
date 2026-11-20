import React from 'react';
import { motion } from 'framer-motion';
import { AlertOctagon, ArrowRight, CheckCircle2, Layers } from 'lucide-react';
import type { ChallengeResult } from '@shared/types';
import { BLUFF_CAUGHT_MEMES, TRUTH_CONFIRMED_MEMES, pickMemeLine } from '../../lib/hindiMemes';
import { PlayingCard } from '../PlayingCard';

interface ChallengeRevealOverlayProps {
  result: ChallengeResult;
}

export const ChallengeRevealOverlay: React.FC<ChallengeRevealOverlayProps> = ({ result }) => {
  const isBluff = result.wasBluff;
  const meme = isBluff
    ? pickMemeLine(BLUFF_CAUGHT_MEMES, result.timestamp)
    : pickMemeLine(TRUTH_CONFIRMED_MEMES, result.timestamp);
  const memeImage = isBluff ? '/images/meme-caught.jpg' : '/images/meme-boss.jpg';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#070504]/85 p-4 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.9, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 12 }}
        transition={{ type: 'spring', stiffness: 320, damping: 24 }}
        className={`relative w-full max-w-2xl overflow-hidden rounded-3xl border-2 bg-[#18130F] p-6 sm:p-7 text-center shadow-2xl ${
          isBluff
            ? 'border-[#E1384B]/75 shadow-[0_0_70px_rgba(225,56,75,0.3)]'
            : 'border-emerald-400/75 shadow-[0_0_70px_rgba(16,185,129,0.26)]'
        }`}
      >
        <div className="mb-3 flex items-center justify-center gap-2 font-[var(--font-mono)] text-xs uppercase tracking-[0.2em] text-[#B9A992]">
          <span>
            {result.challengerName} CHALLENGED {result.accusedName}
          </span>
        </div>

        {/* Hindi Meme Reaction Card + Verdict */}
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:text-left rounded-2xl bg-[#0B0E17] border border-white/[0.08] p-4">
          <motion.img
            src={memeImage}
            alt={isBluff ? 'Pakda gaya meme' : 'Asli khiladi meme'}
            initial={{ scale: 0.8, rotate: -6 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 20 }}
            className={`h-24 w-24 sm:h-28 sm:w-28 shrink-0 rounded-2xl object-cover border-2 shadow-xl ${
              isBluff ? 'border-[#E1384B]' : 'border-emerald-400'
            }`}
          />

          <div className="flex-1">
            <motion.div
              initial={{ scale: 1.25, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.16, type: 'spring', stiffness: 360, damping: 20 }}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 font-[var(--font-display)] text-lg sm:text-2xl font-extrabold tracking-wide ${
                isBluff
                  ? 'bg-[#E1384B]/18 text-[#E1384B] border border-[#E1384B]/45'
                  : 'bg-emerald-500/18 text-emerald-400 border border-emerald-400/45'
              }`}
            >
              {isBluff ? (
                <AlertOctagon className="h-5 w-5 shrink-0" />
              ) : (
                <CheckCircle2 className="h-5 w-5 shrink-0" />
              )}
              {meme.headline}
            </motion.div>

            <p className="mt-2 text-xs sm:text-sm font-semibold text-[#FAF3E3]">{meme.subline}</p>
            <p className="mt-1 text-xs text-[#B9A992]">
              {isBluff ? 'BLUFF CAUGHT' : 'CLAIM WAS TRUE'} · Declared:{' '}
              <strong className="font-[var(--font-mono)] text-[#1CD696]">
                {result.revealedCards.length}× {result.declaredRank}
              </strong>
            </p>
          </div>
        </div>

        {/* 3D Flipping Revealed Cards */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3 [perspective:1000px]">
          {result.revealedCards.map((card, idx) => {
            const matches = card.rank === result.declaredRank;
            return (
              <motion.div
                key={card.id}
                initial={{ rotateY: 180, opacity: 0, scale: 0.85, y: 14 }}
                animate={{ rotateY: 0, opacity: 1, scale: 1, y: 0 }}
                transition={{
                  delay: 0.14 + idx * 0.14,
                  duration: 0.45,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <PlayingCard
                  card={card}
                  size="md"
                  highlight={matches ? 'match' : 'bluff'}
                />
              </motion.div>
            );
          })}
        </div>

        {/* Animated Pile Transfer to Losing Player */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-5 flex flex-col items-center gap-2.5"
        >
          <div className="relative flex w-full max-w-sm items-center justify-between rounded-2xl bg-[#0B0907] border border-white/10 px-4 py-2.5 overflow-hidden">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#E6B84C]" />
              <span className="font-[var(--font-mono)] text-[11px] font-bold text-[#DFD2BE]">
                PILE ({result.pileSizeTaken})
              </span>
            </div>

            <div className="relative flex flex-1 items-center justify-center h-6 mx-3">
              {[0, 1, 2].map((n) => (
                <motion.div
                  key={n}
                  initial={{ x: -36, opacity: 0, scale: 0.7, rotate: -12 }}
                  animate={{ x: 36, opacity: [0, 1, 1, 0], scale: 1, rotate: 10 }}
                  transition={{
                    delay: 0.65 + n * 0.22,
                    duration: 0.9,
                    repeat: Infinity,
                    repeatDelay: 0.35,
                    ease: 'easeInOut',
                  }}
                  className="absolute h-5 w-3.5 rounded-[2px] border border-[#E6B84C]/60 card-back-pattern shadow"
                />
              ))}
              <ArrowRight className="h-3.5 w-3.5 text-white/25" />
            </div>

            <div
              className={`rounded-lg px-2.5 py-1 font-[var(--font-mono)] text-[11px] font-bold ${
                isBluff
                  ? 'bg-[#E1384B]/15 text-[#FF9BA6] border border-[#E1384B]/35'
                  : 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/35'
              }`}
            >
              {result.loserName} +{result.pileSizeTaken}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};
