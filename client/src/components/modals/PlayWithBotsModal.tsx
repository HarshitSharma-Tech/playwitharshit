import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Brain, Flame, Shield, Shuffle, X } from 'lucide-react';
import type {
  BotPersonality,
  CardsPerPlayerOption,
  DeckCountOption,
  Difficulty,
  ShuffleSpeed,
  TurnTimerOption,
} from '@shared/types';
import { useGameStore } from '../../store/useGameStore';

interface PlayWithBotsModalProps {
  open: boolean;
  onClose: () => void;
}

const PERSONALITIES: Array<{
  id: BotPersonality;
  label: string;
  desc: string;
  color: string;
  Icon: React.FC<{ className?: string }>;
}> = [
  { id: 'aggressive', label: 'Aggressive', desc: 'Bold multi-card bluffs & frequent calls', color: 'text-[#E1384B]', Icon: Flame },
  { id: 'strategic', label: 'Strategic', desc: 'Counts cards & catches impossible claims', color: 'text-[#1CD696]', Icon: Brain },
  { id: 'unpredictable', label: 'Unpredictable', desc: 'Chaotic timing & wild deception', color: 'text-[#E6B84C]', Icon: Shuffle },
  { id: 'defensive', label: 'Defensive', desc: 'Plays safe, challenges high-certainty lies', color: 'text-emerald-400', Icon: Shield },
];

export const PlayWithBotsModal: React.FC<PlayWithBotsModalProps> = ({ open, onClose }) => {
  const { createBotMatch } = useGameStore();
  const [bots, setBots] = useState<BotPersonality[]>(['aggressive', 'strategic', 'unpredictable']);
  const [deckCount, setDeckCount] = useState<DeckCountOption>(1);
  const [cardsPerPlayer, setCardsPerPlayer] = useState<CardsPerPlayerOption>(7);
  const [shuffleSpeed, setShuffleSpeed] = useState<ShuffleSpeed>('fast');
  const [turnTimer, setTurnTimer] = useState<TurnTimerOption>(30);
  const [difficulty, setDifficulty] = useState<Difficulty>('casual');
  const [launching, setLaunching] = useState(false);

  const setBotCount = (count: number) => {
    const defaults: BotPersonality[] = ['aggressive', 'strategic', 'unpredictable', 'defensive', 'strategic'];
    setBots((prev) => {
      if (count > prev.length) {
        return [...prev, ...defaults.slice(prev.length, count)];
      }
      return prev.slice(0, count);
    });
  };

  const cyclePersonality = (idx: number) => {
    const order: BotPersonality[] = ['aggressive', 'strategic', 'unpredictable', 'defensive'];
    setBots((prev) =>
      prev.map((p, i) => (i === idx ? order[(order.indexOf(p) + 1) % order.length] : p))
    );
  };

  const handleLaunch = async () => {
    setLaunching(true);
    try {
      await createBotMatch({ bots, deckCount, cardsPerPlayer, shuffleSpeed, turnTimer, difficulty });
    } finally {
      setLaunching(false);
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
            className="relative z-10 w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl bg-[#18130F] border border-white/10 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-5">
              <div>
                <span className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[#1CD696]">
                  SOLO ARENA
                </span>
                <h2 className="mt-1 font-[var(--font-display)] text-xl font-bold text-[#FAF3E3]">
                  Play with AI Bots
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

            <div className="space-y-5 p-6">
              {/* Bot Count */}
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#B9A992]">
                  Number of AI Opponents ({bots.length})
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setBotCount(n)}
                      className={`rounded-xl py-2 font-[var(--font-mono)] text-sm font-bold transition cursor-pointer ${
                        bots.length === n
                          ? 'bg-[#E6B84C] text-[#0B0907]'
                          : 'bg-[#120E0B] text-[#B9A992] border border-white/[0.07]'
                      }`}
                    >
                      {n} {n === 1 ? 'Bot' : 'Bots'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bot Personalities */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#B9A992]">
                    Seat Personalities
                  </span>
                  <span className="text-[11px] text-[#6F7791]">Click any bot to cycle archetype</span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {bots.map((personality, idx) => {
                    const meta = PERSONALITIES.find((p) => p.id === personality)!;
                    const Icon = meta.Icon;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => cyclePersonality(idx)}
                        className="flex items-center gap-3 rounded-xl bg-[#120E0B] border border-white/[0.08] p-3 text-left transition hover:border-[#E6B84C]/50 cursor-pointer"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#18130F] border border-white/10">
                          <Icon className={`h-4 w-4 ${meta.color}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-[#FAF3E3]">
                              AI Seat #{idx + 1}
                            </span>
                            <span className={`font-[var(--font-mono)] text-[10px] font-bold uppercase ${meta.color}`}>
                              {meta.label}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-[11px] text-[#B9A992]">{meta.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick settings */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#B9A992]">
                    Decks
                  </label>
                  <select
                    value={deckCount}
                    onChange={(e) => setDeckCount(Number(e.target.value) as DeckCountOption)}
                    className="w-full rounded-xl bg-[#120E0B] border border-white/10 px-3 py-2 text-xs text-[#FAF3E3] focus:border-[#E6B84C] focus:outline-none"
                  >
                    <option value={1}>1 Deck (52)</option>
                    <option value={2}>2 Decks (104)</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#B9A992]">
                    Hand Size
                  </label>
                  <select
                    value={cardsPerPlayer}
                    onChange={(e) => setCardsPerPlayer(Number(e.target.value) as CardsPerPlayerOption)}
                    className="w-full rounded-xl bg-[#120E0B] border border-white/10 px-3 py-2 text-xs text-[#FAF3E3] focus:border-[#E6B84C] focus:outline-none"
                  >
                    <option value={5}>5 Cards</option>
                    <option value={7}>7 Cards</option>
                    <option value={10}>10 Cards</option>
                    <option value={13}>13 Cards</option>
                    <option value={0}>Full Deck</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#B9A992]">
                    Deal Speed
                  </label>
                  <select
                    value={shuffleSpeed}
                    onChange={(e) => setShuffleSpeed(e.target.value as ShuffleSpeed)}
                    className="w-full rounded-xl bg-[#120E0B] border border-white/10 px-3 py-2 text-xs text-[#FAF3E3] focus:border-[#E6B84C] focus:outline-none"
                  >
                    <option value="slow">Slow</option>
                    <option value="normal">Normal</option>
                    <option value="fast">Fast</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#B9A992]">
                    Turn Timer
                  </label>
                  <select
                    value={turnTimer}
                    onChange={(e) => setTurnTimer(Number(e.target.value) as TurnTimerOption)}
                    className="w-full rounded-xl bg-[#120E0B] border border-white/10 px-3 py-2 text-xs text-[#FAF3E3] focus:border-[#E6B84C] focus:outline-none"
                  >
                    <option value={15}>15s</option>
                    <option value={30}>30s</option>
                    <option value={45}>45s</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-white/[0.06] pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#B9A992] hover:bg-white/[0.05] hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleLaunch}
                  disabled={launching}
                  className="flex items-center gap-2 rounded-xl bg-[#E6B84C] px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-[#0B0907] shadow-lg transition hover:bg-[#F3CF7A] disabled:opacity-50 cursor-pointer"
                >
                  <Bot className="h-4 w-4" />
                  {launching ? 'Dealing Cards...' : 'Deal Table'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
