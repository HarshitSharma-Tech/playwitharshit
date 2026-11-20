import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Mic, MicOff, WifiOff } from 'lucide-react';
import type { PublicPlayerGameState, ReactionEvent, VoicePeerState } from '@shared/types';
import { AvatarBadge } from '../AvatarBadge';

interface OpponentSeatProps {
  player: PublicPlayerGameState;
  isCurrentTurn: boolean;
  isLastActor: boolean;
  isPendingWinner: boolean;
  isReceivingDeal?: boolean;
  voicePeer?: VoicePeerState;
  reaction?: ReactionEvent;
}

export const OpponentSeat: React.FC<OpponentSeatProps> = ({
  player,
  isCurrentTurn,
  isLastActor,
  isPendingWinner,
  isReceivingDeal = false,
  voicePeer,
  reaction,
}) => {
  const [showReputation, setShowReputation] = useState(false);

  const isSpeaking = Boolean(voicePeer?.micEnabled && !voicePeer?.muted && voicePeer?.speaking);
  const isMutedInVoice = Boolean(voicePeer?.micEnabled && voicePeer?.muted);
  const isMicActive = Boolean(voicePeer?.micEnabled && !voicePeer?.muted);

  const meterColor =
    player.bluffMetrics.observedMeter >= 70
      ? 'bg-[#E1384B]'
      : player.bluffMetrics.observedMeter >= 45
        ? 'bg-[#E6B84C]'
        : 'bg-emerald-400';

  const miniCardsCount = Math.min(7, player.cardCount);

  return (
    <div
      className="relative flex flex-col items-center select-none"
      onMouseEnter={() => setShowReputation(true)}
      onMouseLeave={() => setShowReputation(false)}
      onClick={() => setShowReputation((v) => !v)}
    >
      {/* Floating Emoji OR Voice Phrase Reaction */}
      <AnimatePresence>
        {reaction && (
          <motion.div
            key={reaction.id}
            initial={{ opacity: 0, y: 12, scale: 0.6 }}
            animate={{ opacity: 1, y: -14, scale: 1 }}
            exit={{ opacity: 0, y: -26, scale: 0.85 }}
            className={`pointer-events-none absolute -top-10 z-30 shadow-xl whitespace-nowrap ${
              reaction.phrase
                ? 'rounded-xl bg-[#1D1510]/95 border border-[#E6B84C]/70 px-3 py-1.5 text-xs font-bold text-[#FAF3E3]'
                : 'rounded-full bg-[#19130F]/95 border border-[#E6B84C]/35 px-2.5 py-1 text-xl'
            }`}
          >
            {reaction.phrase ? `“${reaction.phrase}”` : reaction.emoji}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mahogany & Brass Opponent Plaque */}
      <motion.div
        animate={isReceivingDeal ? { scale: [1, 1.06, 1] } : { scale: 1 }}
        transition={{ duration: 0.2 }}
        className={`relative flex w-36 sm:w-44 flex-col rounded-2xl px-3 py-2.5 transition-all cursor-pointer ${
          isPendingWinner
            ? 'bg-[#311317] border-2 border-[#E6B84C] shadow-[0_0_26px_rgba(230,184,76,0.4)]'
            : isSpeaking
              ? 'bg-[#10271E] border-2 border-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.38)]'
              : isCurrentTurn
                ? 'bg-[#251C12] border-2 border-[#E6B84C] shadow-[0_0_26px_rgba(230,184,76,0.38)]'
                : isReceivingDeal
                  ? 'bg-[#17281F] border-2 border-emerald-400'
                  : isLastActor
                    ? 'bg-[#211913] border border-[#E6B84C]/55'
                    : 'bg-[#16110E]/95 border border-[#E6B84C]/20'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="relative">
            {isSpeaking && (
              <span className="pointer-events-none absolute -inset-1 rounded-xl border-2 border-emerald-400/80 animate-ping" />
            )}
            <AvatarBadge
              avatar={player.avatar}
              size="sm"
              active={isCurrentTurn || isSpeaking}
              isBot={player.isBot}
            />
            {!player.connected && (
              <span
                className="absolute -top-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#E1384B] text-white"
                title="Disconnected"
              >
                <WifiOff className="h-2.5 w-2.5" />
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <span className="truncate text-xs font-bold text-[#FAF3E3]">
                {player.username}
              </span>

              {isSpeaking ? (
                <span
                  className="inline-flex h-4 items-end gap-[2px] px-1"
                  title="Speaking in voice chat"
                >
                  <span className="w-[2px] h-2 rounded-full bg-emerald-400 animate-bounce" />
                  <span className="w-[2px] h-3.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="w-[2px] h-2.5 rounded-full bg-emerald-400 animate-bounce" />
                </span>
              ) : isMutedInVoice ? (
                <span
                  className="inline-flex h-4 w-4 items-center justify-center rounded bg-[#E1384B]/20 text-[#FF9BA6]"
                  title="Microphone muted"
                >
                  <MicOff className="h-2.5 w-2.5" />
                </span>
              ) : isMicActive ? (
                <span
                  className="inline-flex h-4 w-4 items-center justify-center rounded bg-emerald-500/18 text-emerald-400"
                  title="Voice connected"
                >
                  <Mic className="h-2.5 w-2.5" />
                </span>
              ) : null}
            </div>

            <div className="mt-0.5 flex items-center justify-between gap-1">
              <span className="font-[var(--font-mono)] text-[10px] font-bold text-[#E6B84C]">
                {player.cardCount} {player.cardCount === 1 ? 'card' : 'cards'}
              </span>
              {player.hasAcceptedCurrentPlay && !isLastActor && (
                <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/18 px-1.5 py-0.5 font-[var(--font-mono)] text-[8px] font-bold text-emerald-400">
                  <Check className="h-2.5 w-2.5" /> OK
                </span>
              )}
              {isCurrentTurn && (
                <span className="rounded bg-[#E6B84C]/22 px-1.5 py-0.5 font-[var(--font-mono)] text-[8px] font-bold text-[#F6D889]">
                  TURN
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Observed Bluff Meter Bar */}
        <div className="mt-2">
          <div className="flex items-center justify-between font-[var(--font-mono)] text-[8px] uppercase tracking-wider text-[#9C8D78]">
            <span>BLUFF HEAT</span>
            <span>{player.bluffMetrics.label}</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#0B0907]">
            <div
              className={`h-full rounded-full transition-all duration-500 ${meterColor}`}
              style={{ width: `${player.bluffMetrics.observedMeter}%` }}
            />
          </div>
        </div>
      </motion.div>

      {/* Mini Fanned Crimson-Gold Card Backs below seat */}
      {miniCardsCount > 0 && (
        <div className="-mt-1.5 flex items-center justify-center">
          {Array.from({ length: miniCardsCount }).map((_, idx) => {
            const offset = idx - (miniCardsCount - 1) / 2;
            return (
              <div
                key={idx}
                style={{
                  transform: `rotate(${offset * 5}deg) translateY(${Math.abs(offset) * 1.2}px)`,
                }}
                className="-mx-1.5 h-6 w-4 rounded-[3px] border border-[#E6B84C]/65 card-back-pattern shadow"
              />
            );
          })}
          {player.cardCount > 7 && (
            <span className="ml-2 rounded bg-[#0B0907]/90 px-1 py-0.5 font-[var(--font-mono)] text-[9px] font-bold text-[#D6C7B2] border border-[#E6B84C]/25">
              +{player.cardCount - 7}
            </span>
          )}
        </div>
      )}

      {/* Hover/Tap Observed Reputation Popover */}
      <AnimatePresence>
        {showReputation && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="glass-panel absolute top-full z-40 mt-2 w-48 rounded-xl p-3 text-[11px] shadow-2xl"
          >
            <p className="font-[var(--font-mono)] text-[9px] uppercase tracking-wider text-[#E6B84C]">
              OBSERVED MATCH RECORD
            </p>
            <div className="mt-2 grid grid-cols-2 gap-1.5 font-[var(--font-mono)] text-[10px]">
              <span className="text-[#B9A992]">Caught Bluffs:</span>
              <span className="text-right font-bold text-[#E1384B]">
                {player.bluffMetrics.caughtBluffs}
              </span>
              <span className="text-[#B9A992]">Verified Truths:</span>
              <span className="text-right font-bold text-emerald-400">
                {player.bluffMetrics.verifiedTruths}
              </span>
              <span className="text-[#B9A992]">Correct Calls:</span>
              <span className="text-right font-bold text-[#E6B84C]">
                {player.matchStats.correctChallenges}
              </span>
              <span className="text-[#B9A992]">Wrong Calls:</span>
              <span className="text-right font-bold text-[#B9A992]">
                {player.matchStats.wrongChallenges}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
