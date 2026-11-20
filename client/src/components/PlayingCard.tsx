import React from 'react';
import { motion } from 'framer-motion';
import type { Card, Suit } from '@shared/types';

interface PlayingCardProps {
  card?: Card;
  faceDown?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  selected?: boolean;
  highlight?: 'match' | 'bluff' | 'none';
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

const SUIT_META: Record<Suit, { symbol: string; colorClass: string }> = {
  spades: { symbol: '♠', colorClass: 'text-[#18130E]' },
  clubs: { symbol: '♣', colorClass: 'text-[#18130E]' },
  hearts: { symbol: '♥', colorClass: 'text-[#C62035]' },
  diamonds: { symbol: '♦', colorClass: 'text-[#C62035]' },
};

const SIZE_CLASSES = {
  xs: {
    frame: 'w-9 h-13 rounded-md',
    cornerRank: 'text-[10px]',
    cornerSuit: 'text-[9px]',
    center: 'text-base',
  },
  sm: {
    frame: 'w-14 h-20 rounded-lg',
    cornerRank: 'text-xs',
    cornerSuit: 'text-[10px]',
    center: 'text-2xl',
  },
  md: {
    frame: 'w-[76px] h-[112px] sm:w-[86px] sm:h-[126px] rounded-xl',
    cornerRank: 'text-sm sm:text-base',
    cornerSuit: 'text-xs',
    center: 'text-3xl sm:text-4xl',
  },
  lg: {
    frame: 'w-24 h-36 sm:w-28 sm:h-40 rounded-2xl',
    cornerRank: 'text-lg',
    cornerSuit: 'text-sm',
    center: 'text-5xl',
  },
};

export const PlayingCard: React.FC<PlayingCardProps> = ({
  card,
  faceDown = false,
  size = 'md',
  selected = false,
  highlight = 'none',
  disabled = false,
  onClick,
  className = '',
}) => {
  const dims = SIZE_CLASSES[size];

  if (faceDown || !card) {
    return (
      <div
        className={`relative select-none overflow-hidden border-[1.5px] border-[#E6B84C]/80 bg-gradient-to-br from-[#520E1B] via-[#2F0810] to-[#1A050A] card-back-shadow ${dims.frame} ${className}`}
      >
        {/* Crisp collector ivory-gold filigree SVG back */}
        <svg viewBox="0 0 80 116" className="h-full w-full" fill="none">
          <rect
            x="4"
            y="4"
            width="72"
            height="108"
            rx="6"
            stroke="#E6B84C"
            strokeWidth="1.2"
            strokeOpacity="0.85"
          />
          <rect
            x="8"
            y="8"
            width="64"
            height="100"
            rx="4"
            stroke="#F6D889"
            strokeWidth="0.7"
            strokeDasharray="2 2"
            strokeOpacity="0.65"
          />
          {/* Corner ornaments */}
          <circle cx="13" cy="13" r="2.2" fill="#E6B84C" fillOpacity="0.85" />
          <circle cx="67" cy="13" r="2.2" fill="#E6B84C" fillOpacity="0.85" />
          <circle cx="13" cy="103" r="2.2" fill="#E6B84C" fillOpacity="0.85" />
          <circle cx="67" cy="103" r="2.2" fill="#E6B84C" fillOpacity="0.85" />
          {/* Diagonal royal lattice */}
          <path
            d="M40 16 L64 58 L40 100 L16 58 Z"
            stroke="#E6B84C"
            strokeWidth="1.1"
            fill="#1D060B"
            fillOpacity="0.65"
          />
          <path
            d="M40 26 L56 58 L40 90 L24 58 Z"
            stroke="#F6D889"
            strokeWidth="0.9"
            strokeOpacity="0.8"
          />
          {/* Center Golden Crest Medallion */}
          <circle cx="40" cy="58" r="11" fill="#2A0810" stroke="#E6B84C" strokeWidth="1.3" />
          <path
            d="M40 50 L46 58 L40 66 L34 58 Z"
            fill="#E6B84C"
          />
          <circle cx="40" cy="58" r="2.5" fill="#2A0810" />
        </svg>
      </div>
    );
  }

  const suit = SUIT_META[card.suit];
  const highlightRing =
    highlight === 'match'
      ? 'ring-2 ring-emerald-400 border-emerald-400'
      : highlight === 'bluff'
        ? 'ring-2 ring-[#E1384B] border-[#E1384B]'
        : selected
          ? 'ring-2 ring-[#E6B84C] border-[#E6B84C] shadow-[0_0_26px_rgba(230,184,76,0.58)]'
          : 'border-[#DFD0B0]';

  const isClickable = Boolean(onClick && !disabled);

  return (
    <motion.button
      type="button"
      disabled={disabled || !onClick}
      onClick={onClick}
      whileHover={isClickable ? { y: selected ? -24 : -14 } : undefined}
      animate={{ y: selected ? -22 : 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      className={`relative select-none overflow-hidden bg-gradient-to-b from-[#FFFDF7] via-[#FAF2DF] to-[#ECDFC2] border ${highlightRing} card-shadow text-left ${dims.frame} ${
        isClickable ? 'cursor-pointer' : 'cursor-default'
      } ${disabled ? 'opacity-70' : ''} ${className}`}
    >
      {/* Delicate gold inner filigree frame */}
      <div className="pointer-events-none absolute inset-1 rounded-[inherit] border border-[#C8A14B]/30" />

      {/* Top-left rank & suit */}
      <div
        className={`absolute top-1.5 left-2 flex flex-col items-center leading-none font-bold ${suit.colorClass}`}
      >
        <span className={`font-[var(--font-display)] tracking-tight ${dims.cornerRank}`}>
          {card.rank}
        </span>
        <span className={dims.cornerSuit}>{suit.symbol}</span>
      </div>

      {/* Center watermark suit */}
      <div className={`flex h-full w-full items-center justify-center ${suit.colorClass}`}>
        <span className={`${dims.center} leading-none drop-shadow-xs`}>{suit.symbol}</span>
      </div>

      {/* Bottom-right inverted rank & suit */}
      {size !== 'xs' && (
        <div
          className={`absolute bottom-1.5 right-2 flex flex-col items-center leading-none font-bold rotate-180 ${suit.colorClass}`}
        >
          <span className={`font-[var(--font-display)] tracking-tight ${dims.cornerRank}`}>
            {card.rank}
          </span>
          <span className={dims.cornerSuit}>{suit.symbol}</span>
        </div>
      )}

      {/* Subtle warm gold sheen when selected */}
      {selected && <div className="pointer-events-none absolute inset-0 bg-[#E6B84C]/16" />}
    </motion.button>
  );
};
