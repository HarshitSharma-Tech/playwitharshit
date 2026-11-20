import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Layers, Play, Shuffle } from 'lucide-react';
import type { SanitizedGameState } from '@shared/types';
import { useSettingsStore } from '../../store/useSettingsStore';
import { PlayingCard } from '../PlayingCard';

interface ShuffleDealStageProps {
  gameState: SanitizedGameState;
  isHost: boolean;
  onTriggerManualDeal: () => void;
}

export const ShuffleDealStage: React.FC<ShuffleDealStageProps> = ({
  gameState,
  isHost,
  onTriggerManualDeal,
}) => {
  const { reducedMotion } = useSettingsStore();
  const { phase, deckCount, totalDeckCards, remainingDeckCount, lastDealEvent, players, shuffleSpeed } =
    gameState;

  const speedMultiplier = shuffleSpeed === 'fast' ? 0.65 : shuffleSpeed === 'slow' ? 1.45 : 1;

  // Determine approximate directional flight vector for the card currently being dealt
  const dealFlightVector = (() => {
    if (!lastDealEvent) return { x: 0, y: 0, rotate: 0 };
    if (lastDealEvent.targetPlayerId === gameState.myPlayerId) {
      return { x: 0, y: 150, rotate: 0 };
    }
    const opponents = players.filter((p) => p.id !== gameState.myPlayerId);
    const idx = opponents.findIndex((p) => p.id === lastDealEvent.targetPlayerId);
    const total = Math.max(1, opponents.length);
    const spread = total === 1 ? 0 : (idx / (total - 1)) * 2 - 1; // -1 .. +1
    return {
      x: Math.round(spread * 210),
      y: -145,
      rotate: Math.round(spread * 18),
    };
  })();

  const dealRecipientName = lastDealEvent
    ? players.find((p) => p.id === lastDealEvent.targetPlayerId)?.username ?? 'Player'
    : null;

  return (
    <div className="relative z-10 flex flex-col items-center justify-center py-4">
      {/* Top Status Banner */}
      <div className="mb-5">
        {phase === 'shuffling' && (
          <div className="inline-flex items-center gap-2 rounded-full bg-[#E6B84C]/20 border border-[#E6B84C]/60 px-4 py-1.5 font-[var(--font-mono)] text-xs font-bold uppercase tracking-widest text-[#FAF3E3]">
            <Shuffle className="h-3.5 w-3.5 animate-spin text-[#1CD696]" />
            SHUFFLING {totalDeckCards} CARDS ({deckCount} {deckCount === 2 ? 'DECKS' : 'DECK'})
          </div>
        )}

        {phase === 'ready_to_deal' && (
          <div className="inline-flex items-center gap-2 rounded-full bg-[#1CD696]/15 border border-[#1CD696]/50 px-4 py-1.5 font-[var(--font-mono)] text-xs font-bold uppercase tracking-widest text-[#1CD696]">
            <Layers className="h-3.5 w-3.5" />
            DECK READY — {isHost ? 'HOST ACTION REQUIRED' : 'WAITING FOR HOST TO DEAL'}
          </div>
        )}

        {phase === 'dealing' && (
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 border border-emerald-400/50 px-4 py-1.5 font-[var(--font-mono)] text-xs font-bold uppercase tracking-widest text-emerald-300">
            <Layers className="h-3.5 w-3.5 animate-pulse" />
            DEALING CARDS...{' '}
            {lastDealEvent ? `${lastDealEvent.dealtCountTotal} / ${lastDealEvent.totalToDeal}` : ''}
          </div>
        )}
      </div>

      {/* Central Animated Deck */}
      <div className="relative flex h-36 w-56 items-center justify-center">
        {phase === 'shuffling' ? (
          /* Realistic riffle / interleave card shuffle animation */
          <div className="relative flex h-28 w-44 items-center justify-center">
            {Array.from({ length: 8 }).map((_, i) => {
              const isLeft = i % 2 === 0;
              return (
                <motion.div
                  key={i}
                  initial={{ x: 0, y: 0, rotate: 0 }}
                  animate={
                    reducedMotion
                      ? { x: (i - 3.5) * 3, rotate: (i - 3.5) * 2 }
                      : {
                          x: isLeft ? [0, -56, -24, 0, -48, 0] : [0, 56, 24, 0, 48, 0],
                          y: [0, -8 - (i % 3) * 4, 4, 0, -6, 0],
                          rotate: isLeft ? [0, -14, -6, 0, -10, 0] : [0, 14, 6, 0, 10, 0],
                          scale: [1, 1.03, 0.98, 1, 1.02, 1],
                        }
                  }
                  transition={{
                    duration: 1.05 * speedMultiplier,
                    delay: i * 0.045,
                    repeat: reducedMotion ? 0 : Infinity,
                    ease: 'easeInOut',
                  }}
                  style={{ zIndex: i + 1 }}
                  className="absolute"
                >
                  <PlayingCard faceDown size="sm" />
                </motion.div>
              );
            })}
          </div>
        ) : (
          /* Static / shrinking central deck + flying dealt card */
          <div className="relative flex h-28 w-24 items-center justify-center">
            {Array.from({ length: Math.min(6, Math.max(1, Math.ceil(remainingDeckCount / 10))) }).map(
              (_, i) => (
                <div
                  key={i}
                  style={{
                    transform: `translate(${i * 1.4}px, ${-i * 1.6}px)`,
                    zIndex: i + 1,
                  }}
                  className="absolute"
                >
                  <PlayingCard faceDown size="sm" />
                </div>
              )
            )}

            {/* Flying dealt card toward receiving seat */}
            <AnimatePresence>
              {phase === 'dealing' && lastDealEvent && !reducedMotion && (
                <motion.div
                  key={lastDealEvent.seq}
                  initial={{ x: 0, y: 0, scale: 0.95, opacity: 1, rotate: 0 }}
                  animate={{
                    x: dealFlightVector.x,
                    y: dealFlightVector.y,
                    scale: 0.65,
                    opacity: 0.15,
                    rotate: dealFlightVector.rotate,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.28 * speedMultiplier, ease: 'easeOut' }}
                  className="pointer-events-none absolute z-30"
                >
                  <PlayingCard faceDown size="sm" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Remaining Deck Counter */}
            <div className="absolute -bottom-3 z-20 rounded-full bg-[#0B0907] border border-[#E6B84C]/50 px-3 py-0.5 font-[var(--font-mono)] text-[10px] font-bold text-[#FAF3E3] shadow-lg">
              {remainingDeckCount} LEFT
            </div>
          </div>
        )}
      </div>

      {/* Bottom Caption / Manual Deal Trigger */}
      <div className="mt-5 text-center">
        {phase === 'shuffling' && (
          <p className="text-xs text-[#B9A992]">
            Authoritative server shuffle in progress — cards remain cryptographically hidden.
          </p>
        )}

        {phase === 'ready_to_deal' &&
          (isHost ? (
            <button
              type="button"
              onClick={onTriggerManualDeal}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1CD696] px-6 py-3 text-xs font-bold uppercase tracking-widest text-[#0B0907] shadow-[0_10px_28px_rgba(28,214,150,0.35)] transition hover:-translate-y-0.5 hover:bg-[#3EE4AB] cursor-pointer"
            >
              <Play className="h-4 w-4 fill-current" />
              Deal {gameState.cardsPerPlayerTarget} Cards to Each Player
            </button>
          ) : (
            <p className="text-xs text-[#B9A992]">
              Waiting for the room host to distribute {gameState.cardsPerPlayerTarget} cards per
              player...
            </p>
          ))}

        {phase === 'dealing' && dealRecipientName && (
          <p className="font-[var(--font-mono)] text-xs text-[#DFD2BE]">
            Dealing clockwise → <strong className="text-[#1CD696]">{dealRecipientName}</strong>
          </p>
        )}
      </div>
    </div>
  );
};
