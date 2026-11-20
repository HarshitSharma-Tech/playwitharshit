import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bot,
  Clock,
  Crown,
  Eye,
  Gauge,
  Layers,
  Lock,
  Shield,
  Shuffle,
  Users,
  X,
} from 'lucide-react';
import type {
  CreateRoomPayload,
  DeckCountOption,
  Difficulty,
  DistributionMode,
  FirstPlayerMode,
  LobbyPlayer,
  RoomSettings,
  ShuffleSpeed,
  TurnTimerOption,
} from '@shared/types';
import { useGameStore } from '../../store/useGameStore';

interface CreateRoomModalProps {
  open: boolean;
  onClose: () => void;
  editMode?: boolean;
  initialSettings?: RoomSettings;
  lobbyPlayers?: LobbyPlayer[];
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  open,
  onClose,
  editMode = false,
  initialSettings,
  lobbyPlayers = [],
}) => {
  const { user, createPrivateRoom, updateRoomSettings } = useGameStore();

  const [roomName, setRoomName] = useState(
    initialSettings?.roomName ?? `${user?.username ?? 'Player'}'s Room`
  );
  const [maxPlayers, setMaxPlayers] = useState<number>(initialSettings?.maxPlayers ?? 4);
  const [deckCount, setDeckCount] = useState<DeckCountOption>(initialSettings?.deckCount ?? 1);
  const [cardsPerPlayer, setCardsPerPlayer] = useState<number>(
    initialSettings?.cardsPerPlayer ?? 7
  );
  const [distributionMode, setDistributionMode] = useState<DistributionMode>(
    initialSettings?.distributionMode ?? 'automatic'
  );
  const [shuffleSpeed, setShuffleSpeed] = useState<ShuffleSpeed>(
    initialSettings?.shuffleSpeed ?? 'normal'
  );
  const [firstPlayerMode, setFirstPlayerMode] = useState<FirstPlayerMode>(
    initialSettings?.firstPlayerMode ?? 'random'
  );
  const [firstPlayerId, setFirstPlayerId] = useState<string>(
    initialSettings?.firstPlayerId ?? user?.id ?? ''
  );
  const [difficulty, setDifficulty] = useState<Difficulty>(
    initialSettings?.difficulty ?? 'casual'
  );
  const [turnTimer, setTurnTimer] = useState<TurnTimerOption>(
    initialSettings?.turnTimer ?? 30
  );
  const [allowSpectators, setAllowSpectators] = useState<boolean>(
    initialSettings?.allowSpectators ?? true
  );
  const [enableBots, setEnableBots] = useState<boolean>(
    initialSettings?.enableBots ?? true
  );
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalAvailableCards = deckCount * 52;
  const maxPerPlayerAllowed = Math.floor(totalAvailableCards / maxPlayers);

  // Clamp cardsPerPlayer cleanly when deckCount or maxPlayers changes
  const effectivePerPlayer =
    cardsPerPlayer === 0
      ? maxPerPlayerAllowed
      : Math.min(cardsPerPlayer, maxPerPlayerAllowed);

  const distributionStats = useMemo(() => {
    const playerBasis = editMode && lobbyPlayers.length >= 2 ? lobbyPlayers.length : maxPlayers;
    const perPlayerForBasis =
      cardsPerPlayer === 0
        ? Math.floor(totalAvailableCards / playerBasis)
        : Math.min(cardsPerPlayer, Math.floor(totalAvailableCards / playerBasis));
    const distributed = perPlayerForBasis * playerBasis;
    const remaining = Math.max(0, totalAvailableCards - distributed);
    return { playerBasis, perPlayerForBasis, distributed, remaining };
  }, [cardsPerPlayer, editMode, lobbyPlayers.length, maxPlayers, totalAvailableCards]);

  const handleDeckChange = (nextDeck: DeckCountOption) => {
    setDeckCount(nextDeck);
    const nextMax = Math.floor((nextDeck * 52) / maxPlayers);
    if (cardsPerPlayer > nextMax) {
      setCardsPerPlayer(nextMax);
    }
  };

  const handleMaxPlayersChange = (nextPlayers: number) => {
    setMaxPlayers(nextPlayers);
    const nextMax = Math.floor((deckCount * 52) / nextPlayers);
    if (cardsPerPlayer > nextMax) {
      setCardsPerPlayer(nextMax);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (cardsPerPlayer > maxPerPlayerAllowed) {
      setError(
        `Cannot deal ${cardsPerPlayer} cards to ${maxPlayers} players (max ${maxPerPlayerAllowed} each).`
      );
      return;
    }

    setSubmitting(true);
    const payload: CreateRoomPayload = {
      roomName: roomName.trim() || `${user?.username ?? 'Player'}'s Room`,
      maxPlayers,
      deckCount,
      cardsPerPlayer,
      distributionMode,
      shuffleSpeed,
      firstPlayerMode,
      firstPlayerId: firstPlayerMode === 'host_selected' ? firstPlayerId || user?.id || null : null,
      difficulty,
      turnTimer,
      allowSpectators,
      enableBots,
      password: password.trim() || undefined,
    };

    try {
      if (editMode) {
        await updateRoomSettings(payload);
        onClose();
      } else {
        await createPrivateRoom(payload);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const presets = [
    { value: 5, label: '5' },
    { value: 7, label: '7' },
    { value: 10, label: '10' },
    { value: 13, label: '13' },
    { value: 0, label: 'Full Deck' },
  ].filter((p) => p.value === 0 || p.value <= maxPerPlayerAllowed);

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
            initial={{ opacity: 0, scale: 0.95, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            className="relative z-10 w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl bg-[#18130F] border border-white/10 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-5">
              <div>
                <span className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[#E6B84C]">
                  {editMode ? 'HOST CONFIGURATION' : 'PRIVATE TABLE SETUP'}
                </span>
                <h2 className="mt-1 font-[var(--font-display)] text-xl font-bold text-[#FAF3E3]">
                  {editMode ? 'Update Room & Deck Settings' : 'Create Private Room'}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] text-[#B9A992] hover:bg-white/10 hover:text-white cursor-pointer"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              {error && (
                <div className="rounded-xl border border-[#E1384B]/40 bg-[#E1384B]/10 px-4 py-3 text-xs text-[#FF9BA6]">
                  {error}
                </div>
              )}

              {/* Room Name */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#B9A992]">
                  Room Name
                </label>
                <input
                  type="text"
                  maxLength={32}
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="Midnight High Rollers"
                  className="w-full rounded-xl bg-[#120E0B] border border-white/10 px-4 py-2.5 text-sm text-[#FAF3E3] placeholder-[#5A627A] focus:border-[#E6B84C] focus:outline-none"
                />
              </div>

              {/* Max Players & Difficulty */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#B9A992]">
                    <Users className="h-3.5 w-3.5 text-[#1CD696]" />
                    Max Players ({maxPlayers})
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[2, 3, 4, 5, 6].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => handleMaxPlayersChange(n)}
                        className={`rounded-lg py-2 font-[var(--font-mono)] text-sm font-semibold transition cursor-pointer ${
                          maxPlayers === n
                            ? 'bg-[#E6B84C] text-[#0B0907]'
                            : 'bg-[#120E0B] text-[#B9A992] border border-white/[0.07] hover:border-white/20'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#B9A992]">
                    <Shield className="h-3.5 w-3.5 text-[#E6B84C]" />
                    Difficulty
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['casual', 'competitive'] as Difficulty[]).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDifficulty(d)}
                        className={`rounded-lg py-2 text-xs font-semibold capitalize transition cursor-pointer ${
                          difficulty === d
                            ? 'bg-[#E6B84C]/20 text-[#FAF3E3] border border-[#E6B84C]'
                            : 'bg-[#120E0B] text-[#B9A992] border border-white/[0.07] hover:border-white/20'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* CUSTOM DECK, SHUFFLE & DISTRIBUTION SECTION */}
              <div className="rounded-2xl bg-[#120E0B] border border-white/[0.08] p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
                  <div className="flex items-center gap-2">
                    <Shuffle className="h-4 w-4 text-[#1CD696]" />
                    <span className="font-[var(--font-mono)] text-[11px] font-bold uppercase tracking-wider text-[#FAF3E3]">
                      Custom Deck & Card Distribution
                    </span>
                  </div>
                  <span className="rounded-md bg-[#1CD696]/12 border border-[#1CD696]/30 px-2.5 py-0.5 font-[var(--font-mono)] text-[10px] font-bold text-[#1CD696]">
                    {totalAvailableCards} CARDS AVAILABLE
                  </span>
                </div>

                {/* Deck Count: 1 Deck (52) vs 2 Decks (104) */}
                <div className="grid grid-cols-2 gap-2.5">
                  {([1, 2] as DeckCountOption[]).map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => handleDeckChange(count)}
                      className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 border transition cursor-pointer ${
                        deckCount === count
                          ? 'bg-[#E6B84C]/18 border-[#E6B84C] text-[#FAF3E3]'
                          : 'bg-[#18130F] border-white/[0.07] text-[#B9A992] hover:border-white/20'
                      }`}
                    >
                      <span className="text-xs font-bold">
                        {count === 1 ? 'Single Deck' : 'Double Deck'}
                      </span>
                      <span className="font-[var(--font-mono)] text-[11px] text-[#1CD696]">
                        {count * 52} cards
                      </span>
                    </button>
                  ))}
                </div>

                {/* Custom Cards Per Player Slider + Presets */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-[#DFD2BE]">
                      <Layers className="h-3.5 w-3.5 text-[#E6B84C]" />
                      Cards per Player
                    </label>
                    <span className="font-[var(--font-mono)] text-xs font-bold text-[#1CD696]">
                      {cardsPerPlayer === 0
                        ? `Full Deck (${effectivePerPlayer} each)`
                        : `${effectivePerPlayer} cards each`}
                    </span>
                  </div>

                  <div className="mb-2.5 flex flex-wrap gap-1.5">
                    {presets.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setCardsPerPlayer(p.value)}
                        className={`rounded-lg px-3 py-1 font-[var(--font-mono)] text-[11px] font-semibold transition cursor-pointer ${
                          cardsPerPlayer === p.value
                            ? 'bg-[#E6B84C] text-[#0B0907]'
                            : 'bg-[#18130F] text-[#B9A992] border border-white/[0.07] hover:border-white/20'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  <input
                    type="range"
                    min={1}
                    max={maxPerPlayerAllowed}
                    value={effectivePerPlayer}
                    onChange={(e) => setCardsPerPlayer(Number(e.target.value))}
                    className="w-full accent-[#E6B84C] cursor-pointer"
                  />

                  {/* Live Card Allocation Summary */}
                  <div className="mt-2.5 grid grid-cols-3 gap-2 rounded-xl bg-[#18130F] border border-white/[0.06] px-3 py-2 text-center font-[var(--font-mono)]">
                    <div>
                      <p className="text-[9px] text-[#7D859F]">DECK TOTAL</p>
                      <p className="text-xs font-bold text-[#FAF3E3]">{totalAvailableCards}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-[#7D859F]">
                        DEALT ({distributionStats.playerBasis}P × {distributionStats.perPlayerForBasis})
                      </p>
                      <p className="text-xs font-bold text-[#1CD696]">
                        {distributionStats.distributed}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] text-[#7D859F]">REMAINING</p>
                      <p className="text-xs font-bold text-[#E6B84C]">
                        {distributionStats.remaining}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Distribution Mode + Shuffle Speed */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#B9A992]">
                      Distribution Trigger
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(
                        [
                          { id: 'automatic', label: 'Automatic' },
                          { id: 'manual', label: 'Manual Deal' },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setDistributionMode(opt.id)}
                          className={`rounded-lg py-2 text-xs font-semibold transition cursor-pointer ${
                            distributionMode === opt.id
                              ? 'bg-[#1CD696]/18 text-[#1CD696] border border-[#1CD696]/60'
                              : 'bg-[#18130F] text-[#B9A992] border border-white/[0.07]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#B9A992]">
                      <Gauge className="h-3 w-3 text-[#E6B84C]" />
                      Shuffle & Deal Speed
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['slow', 'normal', 'fast'] as ShuffleSpeed[]).map((spd) => (
                        <button
                          key={spd}
                          type="button"
                          onClick={() => setShuffleSpeed(spd)}
                          className={`rounded-lg py-2 text-xs font-semibold capitalize transition cursor-pointer ${
                            shuffleSpeed === spd
                              ? 'bg-[#E6B84C]/20 text-[#FAF3E3] border border-[#E6B84C]'
                              : 'bg-[#18130F] text-[#B9A992] border border-white/[0.07]'
                          }`}
                        >
                          {spd}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* First Player Mode */}
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#B9A992]">
                    <Crown className="h-3 w-3 text-amber-400" />
                    First Player Selection
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFirstPlayerMode('random')}
                      className={`rounded-lg py-2 text-xs font-semibold transition cursor-pointer ${
                        firstPlayerMode === 'random'
                          ? 'bg-[#E6B84C]/20 text-[#FAF3E3] border border-[#E6B84C]'
                          : 'bg-[#18130F] text-[#B9A992] border border-white/[0.07]'
                      }`}
                    >
                      Random Seat
                    </button>
                    <button
                      type="button"
                      onClick={() => setFirstPlayerMode('host_selected')}
                      className={`rounded-lg py-2 text-xs font-semibold transition cursor-pointer ${
                        firstPlayerMode === 'host_selected'
                          ? 'bg-[#E6B84C]/20 text-[#FAF3E3] border border-[#E6B84C]'
                          : 'bg-[#18130F] text-[#B9A992] border border-white/[0.07]'
                      }`}
                    >
                      Host Selected
                    </button>
                  </div>

                  {firstPlayerMode === 'host_selected' && lobbyPlayers.length > 0 && (
                    <select
                      value={firstPlayerId}
                      onChange={(e) => setFirstPlayerId(e.target.value)}
                      className="mt-2 w-full rounded-xl bg-[#18130F] border border-white/10 px-3 py-2 text-xs text-[#FAF3E3] focus:border-[#E6B84C] focus:outline-none"
                    >
                      {lobbyPlayers.map((p) => (
                        <option key={p.id} value={p.id}>
                          First to act: {p.username} {p.isHost ? '(Host)' : p.isBot ? '(AI)' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Turn Timer */}
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#B9A992]">
                  <Clock className="h-3.5 w-3.5 text-[#E6B84C]" />
                  Turn Timer
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {([15, 30, 45] as TurnTimerOption[]).map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setTurnTimer(sec)}
                      className={`rounded-xl py-2 font-[var(--font-mono)] text-xs font-semibold transition cursor-pointer ${
                        turnTimer === sec
                          ? 'bg-[#1CD696]/15 text-[#1CD696] border border-[#1CD696]/60'
                          : 'bg-[#120E0B] text-[#B9A992] border border-white/[0.07] hover:border-white/20'
                      }`}
                    >
                      {sec}s / turn
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setAllowSpectators(!allowSpectators)}
                  className={`flex items-center justify-between rounded-xl px-4 py-3 border transition cursor-pointer ${
                    allowSpectators
                      ? 'bg-[#241B13] border-[#1CD696]/40'
                      : 'bg-[#120E0B] border-white/[0.07]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 text-left">
                    <Eye className="h-4 w-4 text-[#1CD696]" />
                    <div>
                      <p className="text-xs font-semibold text-[#FAF3E3]">Allow Spectators</p>
                      <p className="text-[10px] text-[#B9A992]">Watch without seeing hands</p>
                    </div>
                  </div>
                  <div
                    className={`h-5 w-9 rounded-full p-0.5 transition ${
                      allowSpectators ? 'bg-[#1CD696]' : 'bg-white/15'
                    }`}
                  >
                    <div
                      className={`h-4 w-4 rounded-full bg-[#0B0907] transition-transform ${
                        allowSpectators ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setEnableBots(!enableBots)}
                  className={`flex items-center justify-between rounded-xl px-4 py-3 border transition cursor-pointer ${
                    enableBots
                      ? 'bg-[#241B13] border-[#E6B84C]/40'
                      : 'bg-[#120E0B] border-white/[0.07]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 text-left">
                    <Bot className="h-4 w-4 text-[#E6B84C]" />
                    <div>
                      <p className="text-xs font-semibold text-[#FAF3E3]">Enable AI Bots</p>
                      <p className="text-[10px] text-[#B9A992]">Fill open seats in lobby</p>
                    </div>
                  </div>
                  <div
                    className={`h-5 w-9 rounded-full p-0.5 transition ${
                      enableBots ? 'bg-[#E6B84C]' : 'bg-white/15'
                    }`}
                  >
                    <div
                      className={`h-4 w-4 rounded-full bg-[#0B0907] transition-transform ${
                        enableBots ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </button>
              </div>

              {/* Optional Password */}
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#B9A992]">
                  <Lock className="h-3.5 w-3.5 text-[#B9A992]" />
                  Room Password <span className="font-normal opacity-60">(Optional)</span>
                </label>
                <input
                  type="password"
                  maxLength={24}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    editMode ? 'Leave blank to keep or remove' : 'Leave empty for open code access'
                  }
                  className="w-full rounded-xl bg-[#120E0B] border border-white/10 px-4 py-2.5 text-sm text-[#FAF3E3] placeholder-[#5A627A] focus:border-[#E6B84C] focus:outline-none"
                />
              </div>

              {/* Footer buttons */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#B9A992] hover:bg-white/[0.05] hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-[#E6B84C] px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-[#0B0907] shadow-lg transition hover:bg-[#F3CF7A] disabled:opacity-50 cursor-pointer"
                >
                  {submitting
                    ? editMode
                      ? 'Saving...'
                      : 'Creating...'
                    : editMode
                      ? 'Save Settings'
                      : 'Create Room'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
