import React from 'react';
import { motion } from 'framer-motion';
import { AlertOctagon, CheckCircle2, Layers } from 'lucide-react';
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#060504]/88 p-3 sm:p-4 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 12 }}
        transition={{ type: 'spring', stiffness: 320, damping: 24 }}
        className={`relative w-full max-w-xl overflow-hidden rounded-3xl border-2 bg-[#16110D] p-4 sm:p-6 text-center shadow-2xl ${
          isBluff
            ? 'border-[#E1384B] shadow-[0_0_70px_rgba(225,56,75,0.35)]'
            : 'border-emerald-400 shadow-[0_0_70px_rgba(16,185,129,0.28)]'
        }`}
      >
        {/* Top Challenge Banner */}
        <div className="mb-3 flex items-center justify-center gap-2 font-[var(--font-mono)] text-[11px] font-bold uppercase tracking-widest text-[#D8C5A8]">
          <span>
            {result.challengerName} called Bluff on {result.accusedName}
          </span>
        </div>

        {/* Real Iconic Indian Meme Frame */}
        <div className="overflow-hidden rounded-2xl border border-white/15 bg-[#0E0B08] shadow-xl">
          <div className="relative flex flex-col sm:flex-row items-stretch">
            <div className="relative sm:w-56 shrink-0 bg-black">
              <img
                src={meme.image}
                alt={meme.character}
                onError={(e) => {
                  const target = e.currentTarget;
                  if (target.src !== meme.fallbackImage) {
                    target.src = meme.fallbackImage;
                  }
                }}
                className="h-44 sm:h-full w-full object-cover object-top"
              />
              <span className="absolute top-2 left-2 rounded-md bg-black/80 px-2 py-0.5 font-[var(--font-mono)] text-[10px] font-bold uppercase tracking-wider text-[#F6D889]">
                {meme.character}
              </span>
            </div>

            <div className="flex flex-1 flex-col justify-center p-4 text-center sm:text-left">
              <div
                className={`inline-flex items-center justify-center sm:justify-start gap-1.5 self-center sm:self-start rounded-lg px-2.5 py-1 font-[var(--font-mono)] text-[10px] font-black uppercase tracking-widest ${
                  isBluff
                    ? 'bg-[#E1384B] text-white'
                    : 'bg-emerald-500 text-[#07150E]'
                }`}
              >
                {isBluff ? (
                  <AlertOctagon className="h-3.5 w-3.5" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                {isBluff ? 'BLUFF CAUGHT!' : 'NO BLUFF — IT WAS TRUE!'}
              </div>

              <h3 className="mt-2.5 font-[var(--font-display)] text-lg sm:text-xl font-black leading-snug text-[#FAF3E3]">
                {meme.headline}
              </h3>
              <p className="mt-1 text-xs sm:text-sm text-[#D6C7B2]">{meme.subline}</p>
            </div>
          </div>
        </div>

        {/* Clear Claimed vs Actually Thrown Cards */}
        <div className="mt-4 rounded-2xl bg-[#100C09] border border-[#E6B84C]/20 p-3.5">
          <p className="font-[var(--font-mono)] text-[11px] text-[#C8B9A2]">
            {result.accusedName} said:{' '}
            <strong className="text-[#F6D889]">
              {result.revealedCards.length}× {result.declaredRank}
            </strong>{' '}
            · Actually threw:
          </p>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2.5 [perspective:1000px]">
            {result.revealedCards.map((card, idx) => {
              const matches = card.rank === result.declaredRank;
              return (
                <motion.div
                  key={card.id}
                  initial={{ rotateY: 180, opacity: 0, scale: 0.85 }}
                  animate={{ rotateY: 0, opacity: 1, scale: 1 }}
                  transition={{
                    delay: 0.12 + idx * 0.12,
                    duration: 0.4,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <PlayingCard
                    card={card}
                    size="sm"
                    highlight={matches ? 'match' : 'bluff'}
                  />
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Simple Human-Readable Outcome */}
        <div
          className={`mt-4 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-[var(--font-mono)] text-xs font-bold ${
            isBluff
              ? 'bg-[#E1384B]/18 border border-[#E1384B]/50 text-[#FFB5BE]'
              : 'bg-emerald-500/15 border border-emerald-400/45 text-emerald-300'
          }`}
        >
          <Layers className="h-4 w-4 shrink-0" />
          <span>
            {result.loserName} picks up all {result.pileSizeTaken} cards from the center pile!
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
};
