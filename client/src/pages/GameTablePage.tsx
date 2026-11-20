import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Check,
  Clock,
  Copy,
  Eye,
  Flame,
  Gauge,
  Layers,
  LogOut,
  Mic,
  MicOff,
  ScrollText,
  Send,
  Settings,
  ShieldAlert,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { ReactionEmoji } from '@shared/types';
import { useGameStore } from '../store/useGameStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useVoiceStore } from '../store/useVoiceStore';
import { useToastStore } from '../store/useToastStore';
import { soundEngine } from '../lib/sound';
import { PlayingCard } from '../components/PlayingCard';
import { OpponentSeat } from '../components/game/OpponentSeat';
import { ChallengeRevealOverlay } from '../components/game/ChallengeRevealOverlay';
import { WinnerModal } from '../components/game/WinnerModal';
import { ShuffleDealStage } from '../components/game/ShuffleDealStage';
import { VoiceControlPanel } from '../components/game/VoiceControlPanel';
import { LiveChatDrawer } from '../components/game/LiveChatDrawer';
import { MusicPlayerPill } from '../components/MusicPlayerPill';
import { HINDI_MEME_ROASTS } from '../lib/hindiMemes';

const REACTIONS: ReactionEmoji[] = ['😂', '😈', '🤔', '🔥', '👀'];

const RANK_NAMES: Record<string, string> = {
  A: 'Ace',
  '2': 'Two',
  '3': 'Three',
  '4': 'Four',
  '5': 'Five',
  '6': 'Six',
  '7': 'Seven',
  '8': 'Eight',
  '9': 'Nine',
  '10': 'Ten',
  J: 'Jack',
  Q: 'Queen',
  K: 'King',
};

export const GameTablePage: React.FC = () => {
  const {
    gameState,
    lobby,
    user,
    reactions,
    playCards,
    acceptClaim,
    challengePlay,
    triggerManualDeal,
    sendReaction,
    sendVoicePhrase,
    leaveRoom,
    returnToLobby,
    setModal,
  } = useGameStore();
  const { soundEnabled, toggleSound } = useSettingsStore();
  const voicePeers = useVoiceStore((s) => s.peers);
  const myVoiceMicEnabled = useVoiceStore((s) => s.micEnabled);
  const myVoiceMuted = useVoiceStore((s) => s.muted);
  const myVoiceSpeaking = useVoiceStore((s) => s.speaking);
  const pushToast = useToastStore((s) => s.push);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [showLog, setShowLog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showYourTurnBanner, setShowYourTurnBanner] = useState(false);
  const prevPhaseRef = useRef<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!gameState) return;
    const handSet = new Set(gameState.myHand.map((c) => c.id));
    setSelectedIds((prev) => prev.filter((id) => handSet.has(id)));
  }, [gameState?.myHand]);

  useEffect(() => {
    if (!gameState) return;
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = gameState.phase;
    if (
      gameState.phase === 'playing' &&
      !gameState.isSpectator &&
      gameState.currentTurnPlayerId === gameState.myPlayerId &&
      (prev === 'dealing' || prev === 'shuffling' || prev === 'challenge_reveal' || prev === null)
    ) {
      setShowYourTurnBanner(true);
      const t = setTimeout(() => setShowYourTurnBanner(false), 1800);
      return () => clearTimeout(t);
    }
  }, [
    gameState?.phase,
    gameState?.currentTurnPlayerId,
    gameState?.myPlayerId,
    gameState?.isSpectator,
  ]);

  const orderedOpponents = useMemo(() => {
    if (!gameState) return [];
    const myIdx = gameState.players.findIndex((p) => p.id === gameState.myPlayerId);
    if (myIdx < 0) return gameState.players;
    return [...gameState.players.slice(myIdx + 1), ...gameState.players.slice(0, myIdx)];
  }, [gameState]);

  if (!gameState || !user) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="rounded-2xl surface-card px-8 py-6 text-center">
          <p className="font-[var(--font-mono)] text-xs uppercase tracking-widest text-[#E6B84C]">
            PREPARING ROYAL TABLE...
          </p>
        </div>
      </div>
    );
  }

  const me = gameState.players.find((p) => p.id === gameState.myPlayerId);
  const isDealingStage =
    gameState.phase === 'shuffling' ||
    gameState.phase === 'ready_to_deal' ||
    gameState.phase === 'dealing';

  const isMyTurn =
    !gameState.isSpectator &&
    gameState.phase === 'playing' &&
    gameState.currentTurnPlayerId === gameState.myPlayerId;

  const canRespondToClaim =
    !gameState.isSpectator &&
    gameState.phase === 'awaiting_response' &&
    gameState.lastPlay !== null &&
    gameState.lastPlay.playerId !== gameState.myPlayerId;

  const hasAlreadyAccepted = Boolean(me?.hasAcceptedCurrentPlay);
  const isHost = lobby?.hostId === user.id;
  const maxSelectableCards = gameState.deckCount === 2 ? 6 : 4;

  const activeDeadline =
    gameState.phase === 'awaiting_response' && gameState.challengeDeadline
      ? gameState.challengeDeadline
      : gameState.turnDeadline;
  const totalWindowSec =
    gameState.phase === 'awaiting_response' ? 9 : gameState.turnDurationSec;
  const remainingSec = isDealingStage
    ? gameState.turnDurationSec
    : Math.max(0, Math.ceil((activeDeadline - nowMs) / 1000));
  const timerPercent = isDealingStage
    ? 100
    : Math.max(0, Math.min(100, ((activeDeadline - nowMs) / (totalWindowSec * 1000)) * 100));

  const selectedCards = gameState.myHand.filter((c) => selectedIds.includes(c.id));
  const selectionIsBluff =
    selectedCards.length > 0 &&
    selectedCards.some((c) => c.rank !== gameState.requiredRank);

  const vibrateTap = (ms = 14) => {
    try {
      navigator.vibrate?.(ms);
    } catch {
      // ignore unsupported browsers
    }
  };

  const toggleCardSelection = (cardId: string) => {
    if (!isMyTurn) return;
    soundEngine.play('cardSelect');
    vibrateTap(12);
    setSelectedIds((prev) => {
      if (prev.includes(cardId)) return prev.filter((id) => id !== cardId);
      if (prev.length >= maxSelectableCards) {
        pushToast({
          type: 'warning',
          message: `You can play up to ${maxSelectableCards} cards per turn.`,
        });
        return prev;
      }
      return [...prev, cardId];
    });
  };

  const handlePlaySelected = async () => {
    if (!isMyTurn || selectedIds.length === 0 || submitting) return;
    vibrateTap(22);
    setSubmitting(true);
    try {
      await playCards(selectedIds);
      setSelectedIds([]);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(gameState.roomCode).catch(() => {});
    pushToast({ type: 'success', message: `Room code ${gameState.roomCode} copied!` });
  };

  const myLatestReaction = [...reactions]
    .reverse()
    .find((r) => r.playerId === gameState.myPlayerId);

  const rankWord = RANK_NAMES[gameState.requiredRank] ?? gameState.requiredRank;

  return (
    <div className="relative flex min-h-[100dvh] flex-col justify-between bg-[#0B0907] overflow-hidden touch-manipulation">
      {/* Subtle warm chandelier ambient spotlight over room */}
      <div
        className="pointer-events-none absolute top-0 left-1/2 h-[420px] w-[780px] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(circle, #E6B84C 0%, transparent 72%)' }}
      />

      {/* TOP MAHOGANY & BRASS HUD */}
      <header className="z-30 border-b border-[#E6B84C]/20 bg-[#120D0A]/92 backdrop-blur-xl px-3 py-2.5 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          {/* Left: Room Code + Round + Dealer Shoe */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            <button
              type="button"
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 rounded-xl bg-[#1C140F] border border-[#E6B84C]/35 px-3 py-1.5 font-[var(--font-mono)] text-xs font-bold tracking-widest text-[#FAF3E3] hover:border-[#E6B84C] cursor-pointer"
              title="Copy room code"
            >
              {gameState.roomCode}
              <Copy className="h-3 w-3 text-[#E6B84C]" />
            </button>

            <div className="rounded-xl bg-[#1C140F] border border-[#E6B84C]/18 px-3 py-1.5 font-[var(--font-mono)] text-xs text-[#B9A992]">
              ROUND <strong className="text-[#FAF3E3]">{gameState.roundNumber}</strong>
            </div>

            {gameState.remainingDeckCount > 0 && (
              <div
                className="hidden md:flex items-center gap-1.5 rounded-xl bg-[#1C140F] border border-[#E6B84C]/18 px-3 py-1.5 font-[var(--font-mono)] text-xs text-[#B9A992]"
                title={`${gameState.deckCount} deck mode — ${gameState.remainingDeckCount} undealt cards in shoe`}
              >
                <Layers className="h-3.5 w-3.5 text-[#E6B84C]" />
                <span>
                  SHOE <strong className="text-[#F6D889]">{gameState.remainingDeckCount}</strong>
                </span>
              </div>
            )}

            {gameState.isSpectator && (
              <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-500/15 border border-emerald-400/40 px-2.5 py-1.5 font-[var(--font-mono)] text-[10px] font-bold text-emerald-300">
                <Eye className="h-3.5 w-3.5" /> SPECTATING
              </span>
            )}
          </div>

          {/* Center: Golden Brass Dealer Medallion (Required Rank) + Timer */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-[#261B0F] via-[#1C140C] to-[#261B0F] border border-[#E6B84C]/65 px-3.5 py-1.5 shadow-[0_0_24px_rgba(230,184,76,0.2)]">
              <span className="font-[var(--font-mono)] text-[10px] font-bold uppercase tracking-widest text-[#D8B974]">
                DEALER CALLS
              </span>
              <span className="flex h-7 min-w-7 items-center justify-center rounded-lg bg-gradient-to-b from-[#F5D582] to-[#C89428] px-2 font-[var(--font-display)] text-sm font-black text-[#140E08] shadow">
                {gameState.requiredRank}
              </span>
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-[#1C140F] border border-[#E6B84C]/20 px-3 py-1.5">
              <Clock
                className={`h-3.5 w-3.5 ${
                  !isDealingStage && remainingSec <= 5
                    ? 'text-[#E1384B] animate-pulse'
                    : 'text-[#E6B84C]'
                }`}
              />
              <span
                className={`font-[var(--font-mono)] text-xs font-bold w-7 text-right ${
                  !isDealingStage && remainingSec <= 5 ? 'text-[#E1384B]' : 'text-[#FAF3E3]'
                }`}
              >
                {isDealingStage ? '--' : `${remainingSec}s`}
              </span>
              <div className="hidden sm:block h-1.5 w-16 overflow-hidden rounded-full bg-[#0B0907]">
                <div
                  className={`h-full transition-all duration-200 ${
                    gameState.phase === 'awaiting_response'
                      ? 'bg-[#E1384B]'
                      : !isDealingStage && remainingSec <= 5
                        ? 'bg-[#E1384B]'
                        : 'bg-[#E6B84C]'
                  }`}
                  style={{ width: `${timerPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Right: Lounge Radio, Feed, Audio, Settings, Leave */}
          <div className="flex items-center gap-1.5">
            <MusicPlayerPill compact />
            <button
              type="button"
              onClick={() => setShowLog(!showLog)}
              className={`flex h-9 w-9 items-center justify-center rounded-xl border transition cursor-pointer ${
                showLog
                  ? 'bg-[#E6B84C]/20 border-[#E6B84C] text-[#F6D889]'
                  : 'bg-[#1C140F] border-[#E6B84C]/18 text-[#B9A992] hover:text-[#FAF3E3]'
              }`}
              title="Toggle table log"
            >
              <ScrollText className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={toggleSound}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1C140F] border border-[#E6B84C]/18 text-[#B9A992] hover:text-[#FAF3E3] cursor-pointer"
              title="Toggle sound effects"
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4 text-[#E1384B]" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setModal('settings', true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1C140F] border border-[#E6B84C]/18 text-[#B9A992] hover:text-[#FAF3E3] cursor-pointer"
              title="Settings & Songs"
            >
              <Settings className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={leaveRoom}
              className="flex h-9 items-center gap-1.5 rounded-xl bg-[#E1384B]/15 border border-[#E1384B]/40 px-3 text-xs font-bold text-[#FF9BA6] hover:bg-[#E1384B]/28 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Leave</span>
            </button>
          </div>
        </div>
      </header>

      {/* CENTER ROYAL EMERALD CASINO TABLE */}
      <main className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-3 py-3 sm:px-6 sm:py-5">
        {/* Opponents Row: compact horizontal scroll on mobile so table + hand always fit cleanly! */}
        <div className="z-20 mb-3 sm:mb-5 flex w-full flex-nowrap sm:flex-wrap items-start justify-start sm:justify-center gap-2.5 sm:gap-5 overflow-x-auto sm:overflow-visible pb-2 px-1">
          {orderedOpponents.map((opp) => {
            const latestRx = [...reactions].reverse().find((r) => r.playerId === opp.id);
            const vp = voicePeers.find((peer) => peer.userId === opp.id);
            const isReceivingDeal =
              gameState.phase === 'dealing' &&
              gameState.lastDealEvent?.targetPlayerId === opp.id;

            return (
              <OpponentSeat
                key={opp.id}
                player={opp}
                isCurrentTurn={
                  gameState.phase === 'playing' && gameState.currentTurnPlayerId === opp.id
                }
                isLastActor={gameState.lastPlay?.playerId === opp.id}
                isPendingWinner={gameState.pendingWinnerId === opp.id}
                isReceivingDeal={isReceivingDeal}
                voicePeer={vp}
                reaction={latestRx}
              />
            );
          })}
        </div>

        {/* ROYAL EMERALD BAIZE OVAL TABLE WITH MAHOGANY & GOLD RAIL */}
        <div className="relative flex w-full max-w-3xl flex-col items-center justify-center overflow-hidden rounded-[64px] sm:rounded-[125px] poker-felt px-6 py-9 sm:py-12">
          {/* Brushed gold double betting line stitched onto the emerald felt */}
          <div className="pointer-events-none absolute inset-3.5 rounded-[52px] sm:rounded-[112px] border border-[#E6B84C]/35" />
          <div className="pointer-events-none absolute inset-5 rounded-[46px] sm:rounded-[104px] border border-dashed border-[#E6B84C]/22" />

          {/* Faint inlaid table watermark */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.07]">
            <span className="font-[var(--font-display)] text-5xl sm:text-7xl font-black tracking-[0.28em] text-[#F6D889]">
              BLUFFED
            </span>
          </div>

          {/* Cinematic YOUR TURN Flash Banner */}
          <AnimatePresence>
            {showYourTurnBanner && (
              <motion.div
                initial={{ opacity: 0, scale: 0.75, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 1.08, y: -12 }}
                className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
              >
                <div className="flex items-center gap-2.5 rounded-2xl bg-[#140E08]/95 border-2 border-[#E6B84C] px-7 py-3 shadow-[0_0_55px_rgba(230,184,76,0.55)]">
                  <Sparkles className="h-5 w-5 text-[#E6B84C]" />
                  <span className="font-[var(--font-display)] text-2xl sm:text-3xl font-black tracking-widest text-[#FAF3E3]">
                    YOUR TURN
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Shuffle/Deal Stage OR Active Discard Pile */}
          {isDealingStage ? (
            <ShuffleDealStage
              gameState={gameState}
              isHost={isHost}
              onTriggerManualDeal={triggerManualDeal}
            />
          ) : (
            <>
              {/* Status Pill */}
              <div className="z-10 mb-5">
                {gameState.phase === 'playing' ? (
                  <div
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-[var(--font-mono)] text-xs font-bold uppercase tracking-wider border shadow-lg ${
                      isMyTurn
                        ? 'bg-[#1F160B]/95 border-[#E6B84C] text-[#F6D889]'
                        : 'bg-[#091F16]/90 border-[#E6B84C]/30 text-[#D7E6DD]'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isMyTurn ? 'bg-[#E6B84C] animate-ping' : 'bg-emerald-400'
                      }`}
                    />
                    {isMyTurn
                      ? `YOUR TURN — CLAIM ${rankWord.toUpperCase()}S`
                      : `${
                          gameState.players.find((p) => p.id === gameState.currentTurnPlayerId)
                            ?.username ?? 'Player'
                        }'S TURN`}
                  </div>
                ) : gameState.phase === 'awaiting_response' ? (
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#3A0E16]/95 border border-[#E1384B] px-4 py-1.5 font-[var(--font-mono)] text-xs font-bold uppercase tracking-wider text-[#FFC4CB] shadow-lg">
                    <AlertTriangle className="h-3.5 w-3.5 text-[#E1384B]" />
                    CHALLENGE WINDOW · {remainingSec}s
                  </div>
                ) : null}
              </div>

              {/* Central Discard Pile */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="relative flex h-32 w-32 items-center justify-center">
                  {gameState.pileCount === 0 ? (
                    <div className="flex h-28 w-20 flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#E6B84C]/35 bg-[#07261A]/60 text-center">
                      <span className="font-[var(--font-mono)] text-[9px] font-bold uppercase tracking-wider text-[#C6B99B]">
                        CENTER
                      </span>
                      <span className="font-[var(--font-mono)] text-[9px] uppercase tracking-wider text-[#8BA999]">
                        POT
                      </span>
                    </div>
                  ) : (
                    <>
                      {Array.from({ length: Math.min(6, gameState.pileCount) }).map((_, i) => (
                        <motion.div
                          key={`${gameState.lastPlay?.playId ?? 'pile'}-${i}`}
                          initial={{ scale: 0.85, y: -24, opacity: 0 }}
                          animate={{
                            scale: 1,
                            y: 0,
                            opacity: 1,
                            rotate: (i - 2.5) * 7,
                          }}
                          transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                          className="absolute"
                        >
                          <PlayingCard faceDown size="sm" />
                        </motion.div>
                      ))}
                      <div className="absolute -bottom-2.5 z-20 rounded-full bg-[#150E09] border border-[#E6B84C]/70 px-3 py-0.5 font-[var(--font-mono)] text-[11px] font-bold text-[#F6D889] shadow-lg">
                        {gameState.pileCount} {gameState.pileCount === 1 ? 'CARD' : 'CARDS'}
                      </div>
                    </>
                  )}
                </div>

                {/* Last Declaration Banner */}
                <AnimatePresence mode="wait">
                  {gameState.lastPlay ? (
                    <motion.div
                      key={gameState.lastPlay.playId}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="mt-5 text-center"
                    >
                      <p className="text-sm sm:text-base font-bold text-[#FAF3E3] drop-shadow">
                        <span className="text-[#F6D889]">{gameState.lastPlay.playerName}</span>{' '}
                        claims:{' '}
                        <span className="rounded-lg bg-[#16100B]/90 border border-[#E6B84C]/60 px-2.5 py-0.5 font-[var(--font-mono)] font-bold text-[#FAF3E3]">
                          {gameState.lastPlay.count}× {gameState.lastPlay.declaredRank}
                        </span>
                      </p>
                      {gameState.pendingWinnerId && (
                        <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-[#3D1218]/95 border border-[#E6B84C] px-3 py-1 font-[var(--font-mono)] text-[11px] font-bold text-[#F6D889]">
                          <Flame className="h-3.5 w-3.5 text-[#E1384B]" />
                          FINAL HAND! Call Bluff now or they win!
                        </p>
                      )}
                    </motion.div>
                  ) : (
                    <motion.p
                      key="fresh-table"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-5 text-xs text-[#CBE0D4]"
                    >
                      Clean felt — place 1 to {maxSelectableCards} cards claiming{' '}
                      <strong className="text-[#F6D889]">{rankWord}s</strong>.
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}
        </div>

        {/* Slide-out Table Log Drawer */}
        <AnimatePresence>
          {showLog && (
            <motion.aside
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              className="glass-panel fixed right-4 top-20 z-30 w-72 sm:w-80 rounded-2xl p-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[#E6B84C]/18 pb-2.5">
                <span className="font-[var(--font-mono)] text-[10px] font-bold uppercase tracking-widest text-[#E6B84C]">
                  DEALER LEDGER
                </span>
                <button
                  type="button"
                  onClick={() => setShowLog(false)}
                  className="text-[#B9A992] hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1 text-xs">
                {[...gameState.logs].reverse().map((entry) => (
                  <div
                    key={entry.id}
                    className={`rounded-lg px-2.5 py-2 leading-relaxed ${
                      entry.type === 'challenge_bluff'
                        ? 'bg-[#E1384B]/18 text-[#FFC4CB]'
                        : entry.type === 'challenge_truth'
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : entry.type === 'win'
                            ? 'bg-[#E6B84C]/20 text-[#F6D889]'
                            : 'bg-[#0F0B09]/90 text-[#D0C2AE]'
                    }`}
                  >
                    {entry.message}
                  </div>
                ))}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </main>

      {/* BOTTOM WALNUT CONSOLE & CURVED HAND FAN (mobile safe-area clearance above floating Chat & Voice pills) */}
      <section className="z-20 border-t border-[#E6B84C]/20 bg-[#120E0B]/95 backdrop-blur-xl px-3 pb-20 sm:pb-6 pt-3 sm:px-6">
        <div className="mx-auto max-w-6xl">
          {/* Action Bar Row */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            {/* Left: My Bluff Meter & Match Reputation */}
            {me ? (
              <div
                className={`relative flex items-center gap-3 rounded-xl px-3.5 py-2 border transition ${
                  myVoiceSpeaking && myVoiceMicEnabled && !myVoiceMuted
                    ? 'bg-[#10261D] border-emerald-400/70'
                    : 'bg-[#1A1410] border-[#E6B84C]/20'
                }`}
              >
                <AnimatePresence>
                  {myLatestReaction && (
                    <motion.div
                      key={myLatestReaction.id}
                      initial={{ opacity: 0, y: 6, scale: 0.65 }}
                      animate={{ opacity: 1, y: -34, scale: 1 }}
                      exit={{ opacity: 0, y: -44 }}
                      className={`pointer-events-none absolute -top-2 left-2 z-30 shadow-xl whitespace-nowrap ${
                        myLatestReaction.phrase
                          ? 'rounded-xl bg-[#1D1510] border border-[#E6B84C]/70 px-3 py-1 text-xs font-bold text-[#FAF3E3]'
                          : 'text-2xl'
                      }`}
                    >
                      {myLatestReaction.phrase
                        ? `“${myLatestReaction.phrase}”`
                        : myLatestReaction.emoji}
                    </motion.div>
                  )}
                </AnimatePresence>

                <Gauge className="h-4 w-4 text-[#E6B84C] shrink-0" />
                <div>
                  <div className="flex items-center gap-2 font-[var(--font-mono)] text-[10px]">
                    <span className="text-[#B9A992]">BLUFF METER</span>
                    <span className="font-bold text-[#F6D889]">
                      {me.bluffMetrics.label} ({me.bluffMetrics.observedMeter}%)
                    </span>
                    {myVoiceMicEnabled &&
                      (myVoiceMuted ? (
                        <MicOff className="h-3 w-3 text-[#FF9BA6]" />
                      ) : (
                        <Mic
                          className={`h-3 w-3 ${
                            myVoiceSpeaking
                              ? 'text-emerald-400 animate-pulse'
                              : 'text-emerald-400/80'
                          }`}
                        />
                      ))}
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 font-[var(--font-mono)] text-[10px] text-[#B9A992]">
                    <span>
                      Bluffs <strong className="text-[#E6B84C]">{me.matchStats.successfulBluffs}</strong>
                    </span>
                    <span>
                      Reads <strong className="text-emerald-400">{me.matchStats.correctChallenges}</strong>
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-[#1A1410] border border-emerald-400/35 px-4 py-2 text-xs text-emerald-300">
                Spectator Rail — Hidden hands stay private on the server.
              </div>
            )}

            {/* Center: Embossed Casino Action Controls */}
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {isMyTurn && (
                <>
                  {selectedIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedIds([])}
                      className="rounded-xl bg-[#1E1712] border border-[#E6B84C]/25 px-4 py-2.5 text-xs font-bold text-[#D6C7B2] hover:border-[#E6B84C] cursor-pointer"
                    >
                      Clear ({selectedIds.length})
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={selectedIds.length === 0 || submitting}
                    onClick={handlePlaySelected}
                    className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-xs font-extrabold uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer ${
                      selectionIsBluff ? 'crimson-btn' : 'gold-btn'
                    }`}
                  >
                    <Send className="h-3.5 w-3.5" />
                    {selectedIds.length === 0
                      ? `Select Cards (${gameState.requiredRank})`
                      : selectionIsBluff
                        ? `BLUFF (${selectedIds.length}× ${gameState.requiredRank})`
                        : `Play Cards (${selectedIds.length}× ${gameState.requiredRank})`}
                  </button>
                </>
              )}

              {canRespondToClaim && !hasAlreadyAccepted && (
                <>
                  <button
                    type="button"
                    onClick={acceptClaim}
                    className="flex items-center gap-2 rounded-xl bg-[#0E4A34] border border-emerald-400/60 px-5 py-2.5 text-xs font-extrabold uppercase tracking-wider text-emerald-200 transition hover:bg-emerald-500 hover:text-[#09150F] cursor-pointer"
                  >
                    <Check className="h-4 w-4" />
                    Accept
                  </button>

                  <button
                    type="button"
                    onClick={challengePlay}
                    className="crimson-btn flex items-center gap-2 rounded-xl px-6 py-2.5 text-xs font-extrabold uppercase tracking-wider transition hover:-translate-y-0.5 cursor-pointer"
                  >
                    <ShieldAlert className="h-4 w-4" />
                    Challenge (Call Bluff)
                  </button>
                </>
              )}

              {canRespondToClaim && hasAlreadyAccepted && (
                <div className="rounded-xl bg-emerald-500/12 border border-emerald-400/35 px-4 py-2 font-[var(--font-mono)] text-xs text-emerald-300">
                  Accepted — waiting for table ({remainingSec}s)
                </div>
              )}

              {isDealingStage && (
                <div className="rounded-xl bg-[#1A1410] border border-[#E6B84C]/35 px-4 py-2 font-[var(--font-mono)] text-xs text-[#F6D889]">
                  {gameState.phase === 'shuffling'
                    ? 'Shuffling deck...'
                    : gameState.phase === 'ready_to_deal'
                      ? 'Ready to deal cards...'
                      : `Receiving cards (${gameState.myHand.length} / ${gameState.cardsPerPlayerTarget})...`}
                </div>
              )}

              {!isMyTurn &&
                !canRespondToClaim &&
                !isDealingStage &&
                !gameState.isSpectator &&
                gameState.phase === 'playing' && (
                  <div className="rounded-xl bg-[#1A1410] border border-[#E6B84C]/15 px-4 py-2 text-xs text-[#B9A992]">
                    Waiting for active player to place cards...
                  </div>
                )}
            </div>

            {/* Right: Emoji Reactions + 1-Click Spicy Hindi Roast */}
            <div className="flex items-center gap-1 rounded-xl bg-[#1A1410] border border-[#E6B84C]/20 p-1">
              {REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => sendReaction(emoji)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-base transition hover:scale-115 hover:bg-white/[0.07] cursor-pointer"
                  title={`React ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  const hindiOnly = HINDI_MEME_ROASTS.slice(0, 8);
                  const pick = hindiOnly[Math.floor(Math.random() * hindiOnly.length)];
                  sendVoicePhrase(pick.phrase);
                }}
                className="ml-1 flex h-8 items-center gap-1 rounded-lg bg-[#E1384B]/20 border border-[#E1384B]/55 px-2.5 font-[var(--font-mono)] text-[10px] font-bold text-[#FFC4CB] transition hover:bg-[#E1384B] hover:text-white cursor-pointer"
                title="Drop a random Hindi meme roast!"
              >
                🔥 ROAST
              </button>
            </div>
          </div>

          {/* Player's Horizontal Curved Hand Fan */}
          {!gameState.isSpectator && (
            <div className="relative flex min-h-[136px] sm:min-h-[152px] items-end justify-center overflow-x-auto pb-1 pt-6 sm:px-36">
              {gameState.myHand.length === 0 ? (
                <div className="rounded-2xl border border-[#E6B84C]/25 bg-[#1A1410]/85 px-6 py-4 text-center">
                  <p className="font-[var(--font-display)] text-sm font-bold text-[#F6D889]">
                    {isDealingStage
                      ? 'Waiting for your cards to arrive from the dealer...'
                      : 'Hand Empty — Survive the Challenge Window to Win!'}
                  </p>
                </div>
              ) : (
                <div className="flex items-end justify-center px-6">
                  {gameState.myHand.map((card, idx) => {
                    const total = gameState.myHand.length;
                    const mid = (total - 1) / 2;
                    const offset = idx - mid;
                    const angle = Math.max(-18, Math.min(18, offset * (total > 10 ? 1.8 : 2.6)));
                    const liftY = Math.abs(offset) * (total > 10 ? 1.4 : 2.2);
                    const isSelected = selectedIds.includes(card.id);
                    const matchesRequired = card.rank === gameState.requiredRank;
                    const overlapMargin =
                      total > 14
                        ? '-mx-5 sm:-mx-4'
                        : total > 9
                          ? '-mx-4 sm:-mx-3'
                          : '-mx-2.5 sm:-mx-1.5';

                    return (
                      <motion.div
                        key={card.id}
                        initial={{ opacity: 0, y: -110, scale: 0.65 }}
                        animate={{ opacity: 1, y: liftY, scale: 1, rotate: angle }}
                        transition={{
                          type: 'spring',
                          stiffness: 350,
                          damping: 26,
                        }}
                        style={{
                          zIndex: isSelected ? 40 + idx : idx + 1,
                        }}
                        className={`relative ${overlapMargin}`}
                      >
                        {matchesRequired && isMyTurn && (
                          <span
                            className="pointer-events-none absolute -top-2.5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#E6B84C] px-1.5 py-0.5 font-[var(--font-mono)] text-[8px] font-black text-[#140E08] shadow"
                            title="Matches required rank"
                          >
                            MATCH
                          </span>
                        )}
                        <PlayingCard
                          card={card}
                          size="md"
                          selected={isSelected}
                          disabled={!isMyTurn}
                          onClick={() => toggleCardSelection(card.id)}
                        />
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* FLOATING LIVE CHAT & FAMOUS MEMES DRAWER (BOTTOM-LEFT) */}
      <LiveChatDrawer />

      {/* FLOATING OPTIONAL VOICE CONTROL PANEL (BOTTOM-RIGHT) */}
      <VoiceControlPanel roomCode={gameState.roomCode} userId={user.id} />

      {/* DRAMATIC CHALLENGE REVEAL OVERLAY */}
      <AnimatePresence>
        {gameState.phase === 'challenge_reveal' && gameState.challengeResult && (
          <ChallengeRevealOverlay result={gameState.challengeResult} />
        )}
      </AnimatePresence>

      {/* WINNER CELEBRATION OVERLAY */}
      {gameState.phase === 'finished' && gameState.winner && (
        <WinnerModal
          winner={gameState.winner}
          myPlayerId={gameState.myPlayerId}
          isHost={isHost}
          onReturnToLobby={returnToLobby}
          onLeaveToHome={leaveRoom}
        />
      )}
    </div>
  );
};
