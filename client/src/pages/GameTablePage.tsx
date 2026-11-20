import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Clock,
  Copy,
  Eye,
  Flame,
  Gauge,
  Layers,
  LogOut,
  MessageCircle,
  Mic,
  MicOff,
  MoreVertical,
  ScrollText,
  Send,
  Settings,
  ShieldAlert,
  SkipForward,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { RANKS, type PublicPlayerGameState, type Rank, type ReactionEmoji } from '@shared/types';
import { useGameStore } from '../store/useGameStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useVoiceStore } from '../store/useVoiceStore';
import { useToastStore } from '../store/useToastStore';
import { soundEngine } from '../lib/sound';
import { PlayingCard } from '../components/PlayingCard';
import { AvatarBadge } from '../components/AvatarBadge';
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
    passTurn,
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
  const [declaredRank, setDeclaredRank] = useState<Rank>('A');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [showLog, setShowLog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showYourTurnBanner, setShowYourTurnBanner] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [mobileVoiceOpen, setMobileVoiceOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [inspectedPlayer, setInspectedPlayer] = useState<PublicPlayerGameState | null>(null);
  const prevTurnKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!gameState) return;
    const handSet = new Set(gameState.myHand.map((c) => c.id));
    setSelectedIds((prev) => prev.filter((id) => handSet.has(id)));
  }, [gameState?.myHand]);

  // Default declaredRank to the first card in hand whenever a fresh round starts on your turn
  useEffect(() => {
    if (!gameState) return;
    if (
      gameState.phase === 'playing' &&
      gameState.isFreshRound &&
      gameState.currentTurnPlayerId === gameState.myPlayerId &&
      gameState.myHand.length > 0
    ) {
      setSelectedIds([]);
      setDeclaredRank(gameState.myHand[0].rank);
    }
  }, [
    gameState?.roundNumber,
    gameState?.isFreshRound,
    gameState?.currentTurnPlayerId,
    gameState?.myPlayerId,
    gameState?.phase,
  ]);

  // Flash a crisp "YOUR TURN" banner whenever line-by-line turn passes to you
  useEffect(() => {
    if (!gameState) return;
    const turnKey = `${gameState.phase}:${gameState.currentTurnPlayerId}:${gameState.roundNumber}:${gameState.pileCount}`;
    const prevKey = prevTurnKeyRef.current;
    prevTurnKeyRef.current = turnKey;

    const wasMyTurn = prevKey?.startsWith(`playing:${gameState.myPlayerId}:`) ?? false;
    if (
      gameState.phase === 'playing' &&
      !gameState.isSpectator &&
      gameState.currentTurnPlayerId === gameState.myPlayerId &&
      !wasMyTurn
    ) {
      setShowYourTurnBanner(true);
      const t = setTimeout(() => setShowYourTurnBanner(false), 1400);
      return () => clearTimeout(t);
    }
  }, [
    gameState?.phase,
    gameState?.currentTurnPlayerId,
    gameState?.myPlayerId,
    gameState?.isSpectator,
    gameState?.roundNumber,
    gameState?.pileCount,
  ]);

  const orderedOpponents = useMemo(() => {
    if (!gameState) return [];
    const myIdx = gameState.players.findIndex((p) => p.id === gameState.myPlayerId);
    if (myIdx < 0) return gameState.players;
    return [...gameState.players.slice(myIdx + 1), ...gameState.players.slice(0, myIdx)];
  }, [gameState]);

  const myHandRanks = useMemo(() => {
    const set = new Set<Rank>();
    if (gameState) {
      for (const c of gameState.myHand) set.add(c.rank);
    }
    return set;
  }, [gameState?.myHand]);

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
  const activePlayer = gameState.players.find((p) => p.id === gameState.currentTurnPlayerId);
  const activeSeatNum = activePlayer ? activePlayer.seatIndex + 1 : 1;

  const isDealingStage =
    gameState.phase === 'shuffling' ||
    gameState.phase === 'ready_to_deal' ||
    gameState.phase === 'dealing';

  const isMyTurn =
    !gameState.isSpectator &&
    gameState.phase === 'playing' &&
    gameState.currentTurnPlayerId === gameState.myPlayerId;

  const isFreshRound = gameState.isFreshRound || gameState.requiredRank === null;
  const canPlayCards = isMyTurn && !gameState.pendingWinnerId;
  const canPassOrChallenge =
    isMyTurn &&
    !isFreshRound &&
    gameState.lastPlay !== null &&
    gameState.lastPlay.playerId !== gameState.myPlayerId;

  const isHost = lobby?.hostId === user.id;
  const maxSelectableCards = gameState.deckCount === 2 ? 6 : 4;

  const activeDeadline = gameState.turnDeadline;
  const totalWindowSec = gameState.turnDurationSec;
  const remainingSec = isDealingStage
    ? gameState.turnDurationSec
    : Math.max(0, Math.ceil((activeDeadline - nowMs) / 1000));
  const timerPercent = isDealingStage
    ? 100
    : Math.max(0, Math.min(100, ((activeDeadline - nowMs) / (totalWindowSec * 1000)) * 100));

  const activeClaimRank: Rank = isFreshRound
    ? declaredRank
    : (gameState.requiredRank as Rank);

  const selectedCards = gameState.myHand.filter((c) => selectedIds.includes(c.id));
  const selectionIsBluff =
    selectedCards.length > 0 &&
    selectedCards.some((c) => c.rank !== activeClaimRank);

  const vibrateTap = (ms = 14) => {
    try {
      navigator.vibrate?.(ms);
    } catch {
      // ignore unsupported browsers
    }
  };

  const toggleCardSelection = (cardId: string) => {
    if (!canPlayCards) return;
    soundEngine.play('cardSelect');
    vibrateTap(12);
    const tappedCard = gameState.myHand.find((c) => c.id === cardId);
    setSelectedIds((prev) => {
      if (prev.includes(cardId)) return prev.filter((id) => id !== cardId);
      if (prev.length >= maxSelectableCards) {
        pushToast({
          type: 'warning',
          message: `You can play up to ${maxSelectableCards} cards per turn.`,
        });
        return prev;
      }
      // On a fresh round, auto-select the rank of the first card tapped for effortless honest play
      if (isFreshRound && prev.length === 0 && tappedCard) {
        setDeclaredRank(tappedCard.rank);
      }
      return [...prev, cardId];
    });
  };

  const handlePlaySelected = async () => {
    if (!canPlayCards || selectedIds.length === 0 || submitting) return;
    vibrateTap(22);
    setSubmitting(true);
    try {
      await playCards(selectedIds, isFreshRound ? declaredRank : undefined);
      setSelectedIds([]);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePassTurn = async () => {
    if (!canPassOrChallenge || submitting) return;
    vibrateTap(16);
    setSubmitting(true);
    try {
      setSelectedIds([]);
      await passTurn();
    } finally {
      setSubmitting(false);
    }
  };

  const handleChallengePlay = async () => {
    if (!canPassOrChallenge || submitting) return;
    vibrateTap(30);
    setSubmitting(true);
    try {
      setSelectedIds([]);
      await challengePlay();
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(gameState.roomCode).catch(() => { });
    pushToast({ type: 'success', message: `Room code ${gameState.roomCode} copied!` });
  };

  const myLatestReaction = [...reactions]
    .reverse()
    .find((r) => r.playerId === gameState.myPlayerId);

  const rankWord = gameState.requiredRank
    ? (RANK_NAMES[gameState.requiredRank] ?? gameState.requiredRank)
    : 'Any Rank';

  return (
    <div className="relative flex h-[100dvh] md:h-auto md:min-h-[100dvh] flex-col justify-between bg-[#0B0907] overflow-hidden touch-manipulation">
      {/* Subtle warm chandelier ambient spotlight over room */}
      <div
        className="pointer-events-none absolute top-0 left-1/2 h-[420px] w-[780px] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(circle, #E6B84C 0%, transparent 72%)' }}
      />

      {/* TOP MAHOGANY & BRASS HUD */}
      <header className="z-30 shrink-0 border-b border-[#E6B84C]/20 bg-[#120D0A]/92 backdrop-blur-xl px-2.5 py-2 md:px-6 md:py-2.5">
        {/* MOBILE SINGLE-ROW HEADER (< md): Room Code, Timer, Chat, Voice, More */}
        <div className="flex md:hidden items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCopyCode}
              className="flex h-9 items-center gap-1 rounded-xl bg-[#1C140F] border border-[#E6B84C]/35 px-2.5 font-[var(--font-mono)] text-[11px] font-bold tracking-wider text-[#FAF3E3] cursor-pointer"
              title="Copy room code"
            >
              {gameState.roomCode}
              <Copy className="h-3 w-3 text-[#E6B84C]" />
            </button>

            <div className="flex h-9 items-center gap-1 rounded-xl bg-[#1C140F] border border-[#E6B84C]/20 px-2.5">
              <Clock
                className={`h-3.5 w-3.5 ${
                  !isDealingStage && remainingSec <= 5
                    ? 'text-[#E1384B] animate-pulse'
                    : 'text-[#E6B84C]'
                }`}
              />
              <span
                className={`font-[var(--font-mono)] text-xs font-bold ${
                  !isDealingStage && remainingSec <= 5 ? 'text-[#E1384B]' : 'text-[#FAF3E3]'
                }`}
              >
                {isDealingStage ? '--' : `${remainingSec}s`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setMobileVoiceOpen(false);
                setShowMoreMenu(false);
                setMobileChatOpen((v) => !v);
              }}
              className={`relative flex h-9 items-center gap-1 rounded-xl border px-2.5 text-[11px] font-bold cursor-pointer ${
                mobileChatOpen
                  ? 'bg-[#E6B84C]/20 border-[#E6B84C] text-[#F6D889]'
                  : 'bg-[#1C140F] border-[#E6B84C]/25 text-[#FAF3E3]'
              }`}
              aria-label="Open Chat"
            >
              <MessageCircle className="h-3.5 w-3.5 text-[#1CD696]" />
              <span>Chat</span>
              {chatUnread > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#E1384B] px-1 font-[var(--font-mono)] text-[9px] font-bold text-white">
                  {chatUnread > 9 ? '9+' : chatUnread}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setMobileChatOpen(false);
                setShowMoreMenu(false);
                setMobileVoiceOpen((v) => !v);
              }}
              className={`flex h-9 items-center gap-1 rounded-xl border px-2.5 text-[11px] font-bold cursor-pointer ${
                myVoiceMicEnabled && !myVoiceMuted
                  ? 'bg-emerald-500/20 border-emerald-400/70 text-emerald-300'
                  : myVoiceMicEnabled && myVoiceMuted
                    ? 'bg-[#E1384B]/20 border-[#E1384B]/60 text-[#FF9BA6]'
                    : mobileVoiceOpen
                      ? 'bg-[#E6B84C]/20 border-[#E6B84C] text-[#F6D889]'
                      : 'bg-[#1C140F] border-[#E6B84C]/25 text-[#FAF3E3]'
              }`}
              aria-label="Open Voice Controls"
            >
              {myVoiceMicEnabled && myVoiceMuted ? (
                <MicOff className="h-3.5 w-3.5" />
              ) : (
                <Mic
                  className={`h-3.5 w-3.5 ${
                    myVoiceSpeaking && myVoiceMicEnabled && !myVoiceMuted ? 'animate-pulse' : ''
                  }`}
                />
              )}
              <span>
                {myVoiceMicEnabled ? (myVoiceMuted ? 'Muted' : 'Live') : 'Voice'}
              </span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setMobileChatOpen(false);
                  setMobileVoiceOpen(false);
                  setShowMoreMenu((v) => !v);
                }}
                className={`flex h-9 w-9 items-center justify-center rounded-xl border cursor-pointer ${
                  showMoreMenu
                    ? 'bg-[#E6B84C]/20 border-[#E6B84C] text-[#F6D889]'
                    : 'bg-[#1C140F] border-[#E6B84C]/25 text-[#FAF3E3]'
                }`}
                aria-label="More options"
              >
                <MoreVertical className="h-4 w-4" />
              </button>

              {showMoreMenu && (
                <div className="glass-panel absolute right-0 top-11 z-50 w-56 rounded-2xl border border-[#E6B84C]/40 p-2.5 shadow-2xl space-y-1.5">
                  <div className="flex items-center justify-between px-2 py-1 border-b border-white/10">
                    <span className="font-[var(--font-mono)] text-[10px] font-bold uppercase tracking-wider text-[#E6B84C]">
                      Round {gameState.roundNumber} · Pile {gameState.pileCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowMoreMenu(false)}
                      className="text-[#B9A992] hover:text-white cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="px-1 py-1">
                    <MusicPlayerPill compact />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      setShowLog((v) => !v);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-[#FAF3E3] hover:bg-white/[0.06] cursor-pointer"
                  >
                    <ScrollText className="h-4 w-4 text-[#E6B84C]" />
                    Match History / Log
                  </button>

                  <button
                    type="button"
                    onClick={toggleSound}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-[#FAF3E3] hover:bg-white/[0.06] cursor-pointer"
                  >
                    {soundEnabled ? (
                      <Volume2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <VolumeX className="h-4 w-4 text-[#E1384B]" />
                    )}
                    Sound: {soundEnabled ? 'On' : 'Off'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      setModal('settings', true);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-[#FAF3E3] hover:bg-white/[0.06] cursor-pointer"
                  >
                    <Settings className="h-4 w-4 text-[#B9A992]" />
                    Settings
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      leaveRoom();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl bg-[#E1384B]/15 px-2.5 py-2 text-xs font-bold text-[#FF9BA6] hover:bg-[#E1384B]/25 cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                    Leave Table
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* DESKTOP HEADER (md+) */}
        <div className="mx-auto hidden md:flex max-w-7xl flex-wrap items-center justify-between gap-3">
          {/* Left: Room Code + Round + Total Cards in Pile */}
          <div className="flex items-center gap-2.5">
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
              R<strong className="text-[#FAF3E3]">{gameState.roundNumber}</strong>
            </div>

            <div
              className="flex items-center gap-1.5 rounded-xl bg-[#1C140F] border border-[#E6B84C]/25 px-3 py-1.5 font-[var(--font-mono)] text-xs text-[#B9A992]"
              title="Total cards currently in the center pile"
            >
              <Layers className="h-3.5 w-3.5 text-[#E6B84C]" />
              <span>
                PILE <strong className="text-[#F6D889]">{gameState.pileCount}</strong>
              </span>
            </div>

            {gameState.isSpectator && (
              <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-500/15 border border-emerald-400/40 px-2.5 py-1.5 font-[var(--font-mono)] text-[10px] font-bold text-emerald-300">
                <Eye className="h-3.5 w-3.5" /> SPECTATING
              </span>
            )}
          </div>

          {/* Center: Crystal-Clear Active Card Medallion + Timer */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#261B0F] via-[#1C140C] to-[#261B0F] border border-[#E6B84C]/65 px-3 py-1.5 shadow-[0_0_24px_rgba(230,184,76,0.2)]">
              <span className="font-[var(--font-mono)] text-[10px] font-bold uppercase tracking-wider text-[#D8B974]">
                {isFreshRound ? 'PICK CARD' : 'ACTIVE CARD'}
              </span>
              <span className="flex h-7 min-w-7 items-center justify-center rounded-lg bg-gradient-to-b from-[#F5D582] to-[#C89428] px-2 font-[var(--font-display)] text-sm font-black text-[#140E08] shadow">
                {isFreshRound ? 'ANY' : gameState.requiredRank}
              </span>
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-[#1C140F] border border-[#E6B84C]/20 px-3 py-1.5">
              <Clock
                className={`h-3.5 w-3.5 ${!isDealingStage && remainingSec <= 5
                  ? 'text-[#E1384B] animate-pulse'
                  : 'text-[#E6B84C]'
                  }`}
              />
              <span
                className={`font-[var(--font-mono)] text-xs font-bold w-7 text-right ${!isDealingStage && remainingSec <= 5 ? 'text-[#E1384B]' : 'text-[#FAF3E3]'
                  }`}
              >
                {isDealingStage ? '--' : `${remainingSec}s`}
              </span>
              <div className="hidden sm:block h-1.5 w-16 overflow-hidden rounded-full bg-[#0B0907]">
                <div
                  className={`h-full transition-all duration-200 ${!isDealingStage && remainingSec <= 5 ? 'bg-[#E1384B]' : 'bg-[#E6B84C]'
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
              className={`flex h-9 w-9 items-center justify-center rounded-xl border transition cursor-pointer ${showLog
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
      <main className="relative mx-auto flex w-full max-w-6xl flex-1 min-h-0 flex-col items-center justify-center px-2.5 py-1.5 md:px-6 md:py-5">
        {/* Opponents Row: compact horizontal scroll inside row on mobile */}
        <div className="z-20 mb-2 md:mb-5 flex w-full flex-nowrap md:flex-wrap items-center md:items-start justify-start md:justify-center gap-2 md:gap-5 overflow-x-auto md:overflow-visible pb-1 px-0.5">
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
                onInspect={setInspectedPlayer}
              />
            );
          })}
        </div>

        {/* ROYAL EMERALD BAIZE OVAL TABLE WITH MAHOGANY & GOLD RAIL */}
        <div className="relative flex w-full max-w-3xl flex-col items-center justify-center overflow-hidden rounded-[36px] md:rounded-[125px] poker-felt px-4 py-3 md:px-6 md:py-10">
          {/* Brushed gold double betting line stitched onto the emerald felt */}
          <div className="pointer-events-none absolute inset-2 md:inset-3.5 rounded-[28px] md:rounded-[112px] border border-[#E6B84C]/35" />
          <div className="pointer-events-none absolute inset-3 md:inset-5 rounded-[24px] md:rounded-[104px] border border-dashed border-[#E6B84C]/22" />

          {/* Faint inlaid table watermark */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.07]">
            <span className="font-[var(--font-display)] text-4xl md:text-7xl font-black tracking-[0.28em] text-[#F6D889]">
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
                <div className="flex items-center gap-2 rounded-2xl bg-[#140E08]/95 border-2 border-[#E6B84C] px-5 py-2 md:px-7 md:py-3 shadow-[0_0_55px_rgba(230,184,76,0.55)]">
                  <Sparkles className="h-4 w-4 md:h-5 md:w-5 text-[#E6B84C]" />
                  <span className="font-[var(--font-display)] text-lg md:text-3xl font-black tracking-widest text-[#FAF3E3]">
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
              {/* Turn Message + Required Rank right near the cards */}
              <div className="z-10 mb-2 md:mb-4">
                {gameState.phase === 'playing' && (
                  <div
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-[var(--font-mono)] text-[10px] md:text-xs font-bold uppercase tracking-wider border shadow-lg text-center ${
                      isMyTurn
                        ? gameState.pendingWinnerId
                          ? 'bg-[#3A0E16]/95 border-[#E1384B] text-[#FFC4CB]'
                          : 'bg-[#1F160B]/95 border-[#E6B84C] text-[#F6D889]'
                        : 'bg-[#091F16]/90 border-[#E6B84C]/30 text-[#D7E6DD]'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        isMyTurn
                          ? gameState.pendingWinnerId
                            ? 'bg-[#E1384B] animate-ping'
                            : 'bg-[#E6B84C] animate-ping'
                          : 'bg-emerald-400'
                      }`}
                    />
                    {isMyTurn
                      ? isFreshRound
                        ? 'YOUR TURN · PICK ANY RANK'
                        : gameState.pendingWinnerId
                          ? `YOUR TURN · FINAL HAND (${rankWord.toUpperCase()}S)`
                          : `YOUR TURN · PLAY ${rankWord.toUpperCase()}S`
                      : `SEAT #${activeSeatNum} ${activePlayer?.username ?? 'Player'} · ${
                          isFreshRound ? 'ANY RANK' : `${rankWord.toUpperCase()}S`
                        }`}
                  </div>
                )}
              </div>

              {/* Central Discard Pile (Compact on Mobile, single pile count) */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="relative flex h-20 w-24 md:h-28 md:w-32 items-center justify-center">
                  {gameState.pileCount === 0 ? (
                    <div className="flex h-20 w-14 md:h-28 md:w-20 flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#E6B84C]/35 bg-[#07261A]/60 text-center">
                      <span className="font-[var(--font-mono)] text-[8px] md:text-[9px] font-bold uppercase tracking-wider text-[#C6B99B]">
                        EMPTY
                      </span>
                      <span className="font-[var(--font-mono)] text-[8px] md:text-[9px] uppercase tracking-wider text-[#8BA999]">
                        PILE
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="scale-75 md:scale-100 flex items-center justify-center">
                        {Array.from({ length: Math.min(5, gameState.pileCount) }).map((_, i) => (
                          <motion.div
                            key={`${gameState.lastPlay?.playId ?? 'pile'}-${i}`}
                            initial={{ scale: 0.85, y: -18, opacity: 0 }}
                            animate={{
                              scale: 1,
                              y: 0,
                              opacity: 1,
                              rotate: (i - 2) * 7,
                            }}
                            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                            className="absolute"
                          >
                            <PlayingCard faceDown size="sm" />
                          </motion.div>
                        ))}
                      </div>
                      <div className="absolute -bottom-2 z-20 whitespace-nowrap rounded-full bg-[#150E09] border border-[#E6B84C]/70 px-2.5 py-0.5 font-[var(--font-mono)] text-[10px] font-bold text-[#F6D889] shadow-lg">
                        {gameState.pileCount} {gameState.pileCount === 1 ? 'card' : 'cards'} in pile
                      </div>
                    </>
                  )}
                </div>

                {/* One Clear Line for Last Claim */}
                <AnimatePresence mode="wait">
                  {gameState.lastPlay ? (
                    <motion.div
                      key={gameState.lastPlay.playId}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="mt-3 md:mt-4 text-center"
                    >
                      <p className="text-xs md:text-base font-bold text-[#FAF3E3] drop-shadow">
                        <span className="text-[#F6D889]">{gameState.lastPlay.playerName}</span>{' '}
                        played {gameState.lastPlay.count} as{' '}
                        <span className="text-[#F6D889]">
                          {RANK_NAMES[gameState.lastPlay.declaredRank] ??
                            gameState.lastPlay.declaredRank}
                          s
                        </span>
                      </p>
                      {gameState.pendingWinnerId && (
                        <p className="mt-1 inline-flex items-center gap-1 rounded-lg bg-[#3D1218]/95 border border-[#E6B84C] px-2.5 py-0.5 font-[var(--font-mono)] text-[10px] font-bold text-[#F6D889]">
                          <Flame className="h-3 w-3 text-[#E1384B]" />
                          FINAL HAND! Catch Lie or they win!
                        </p>
                      )}
                    </motion.div>
                  ) : (
                    <motion.p
                      key="fresh-table"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-3 md:mt-4 text-[11px] md:text-xs text-[#CBE0D4] text-center"
                    >
                      New pile —{' '}
                      <strong className="text-[#F6D889]">
                        {isMyTurn ? 'you' : activePlayer?.username ?? 'starter'}
                      </strong>{' '}
                      can open with any rank.
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
                    className={`rounded-lg px-2.5 py-2 leading-relaxed ${entry.type === 'challenge_bluff'
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

      {/* BOTTOM WALNUT CONSOLE: Hand + Actions together with safe-area padding */}
      <section className="z-20 shrink-0 border-t border-[#E6B84C]/20 bg-[#120E0B]/96 backdrop-blur-xl px-2.5 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6 md:pt-3 md:pb-6">
        <div className="mx-auto max-w-6xl">
          {/* MOBILE LAYOUT (< md): Hand + Side Rank Picker (on fresh round) + 44px Action Row below */}
          <div className="flex md:hidden flex-col gap-2">
            {/* Hand Row (+ compact Rank Picker beside it when opening a fresh pile) */}
            {!gameState.isSpectator && (
              <div className="flex items-center gap-2">
                {canPlayCards && isFreshRound && (
                  <div className="flex shrink-0 flex-col items-center rounded-xl bg-[#1A130D] border border-[#E6B84C]/40 p-1.5">
                    <span className="mb-1 font-[var(--font-mono)] text-[8px] font-bold uppercase tracking-wider text-[#D8B974]">
                      RANK
                    </span>
                    <div className="grid grid-cols-2 gap-1 max-h-[92px] overflow-y-auto pr-0.5">
                      {RANKS.map((r) => {
                        const active = declaredRank === r;
                        const inHand = myHandRanks.has(r);
                        return (
                          <button
                            key={r}
                            type="button"
                            onClick={() => {
                              vibrateTap(10);
                              setDeclaredRank(r);
                            }}
                            className={`relative flex h-7 w-7 items-center justify-center rounded-md font-[var(--font-mono)] text-[11px] font-extrabold cursor-pointer ${
                              active
                                ? 'bg-[#E6B84C] text-[#140E08]'
                                : inHand
                                  ? 'bg-[#261D15] border border-[#E6B84C]/35 text-[#FAF3E3]'
                                  : 'bg-[#120D0A] border border-white/10 text-[#968674]'
                            }`}
                          >
                            {r}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  {gameState.myHand.length === 0 ? (
                    <div className="rounded-xl border border-[#E6B84C]/25 bg-[#1A1410]/85 px-4 py-3 text-center">
                      <p className="font-[var(--font-display)] text-xs font-bold text-[#F6D889]">
                        {isDealingStage
                          ? 'Dealing your cards...'
                          : 'Hand Empty — Survive to Win!'}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-nowrap items-end gap-1.5 overflow-x-auto px-1 pt-2.5 pb-1">
                      {gameState.myHand.map((card) => {
                        const isSelected = selectedIds.includes(card.id);
                        const matchesClaim = card.rank === activeClaimRank;
                        return (
                          <div
                            key={card.id}
                            className={`relative shrink-0 transition-transform ${
                              isSelected ? '-translate-y-2' : ''
                            }`}
                          >
                            {matchesClaim && canPlayCards && (
                              <span className="pointer-events-none absolute -top-2 left-1/2 z-20 -translate-x-1/2 rounded-full bg-[#E6B84C] px-1 py-0.2 font-[var(--font-mono)] text-[7px] font-black text-[#140E08]">
                                {activeClaimRank}
                              </span>
                            )}
                            <PlayingCard
                              card={card}
                              size="sm"
                              selected={isSelected}
                              disabled={!canPlayCards}
                              onClick={() => toggleCardSelection(card.id)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Mobile 44px+ Action Bar right under the hand */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {canPlayCards && (
                <button
                  type="button"
                  disabled={selectedIds.length === 0 || submitting}
                  onClick={handlePlaySelected}
                  className={`flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-extrabold uppercase tracking-wide transition disabled:opacity-40 cursor-pointer ${
                    selectionIsBluff ? 'crimson-btn' : 'gold-btn'
                  }`}
                >
                  <Send className="h-3.5 w-3.5 shrink-0" />
                  {selectedIds.length === 0
                    ? `Tap Cards (${activeClaimRank})`
                    : selectionIsBluff
                      ? `Bluff ${selectedIds.length} as ${RANK_NAMES[activeClaimRank]}s`
                      : `Play ${selectedIds.length} as ${RANK_NAMES[activeClaimRank]}s`}
                </button>
              )}

              {canPassOrChallenge && (
                <>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handlePassTurn}
                    className="flex min-h-[44px] items-center justify-center gap-1 rounded-xl bg-[#0E4A34] border border-emerald-400/60 px-3.5 text-xs font-extrabold uppercase text-emerald-200 disabled:opacity-40 cursor-pointer"
                  >
                    <SkipForward className="h-3.5 w-3.5" />
                    Pass
                  </button>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleChallengePlay}
                    className="crimson-btn flex min-h-[44px] items-center justify-center gap-1 rounded-xl px-3.5 text-xs font-extrabold uppercase disabled:opacity-40 cursor-pointer"
                  >
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                    Call Bluff
                  </button>
                </>
              )}

              {isDealingStage && (
                <div className="flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[#1A1410] border border-[#E6B84C]/35 px-3 font-[var(--font-mono)] text-xs text-[#F6D889]">
                  {gameState.phase === 'shuffling'
                    ? 'Shuffling deck...'
                    : gameState.phase === 'ready_to_deal'
                      ? 'Ready to deal...'
                      : `Dealing (${gameState.myHand.length}/${gameState.cardsPerPlayerTarget})...`}
                </div>
              )}

              {!isMyTurn &&
                !isDealingStage &&
                !gameState.isSpectator &&
                gameState.phase === 'playing' && (
                  <div className="flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[#1A1410] border border-[#E6B84C]/20 px-3 text-xs text-[#B9A992]">
                    Waiting for{' '}
                    <strong className="mx-1 text-[#F6D889]">
                      {activePlayer?.username ?? 'player'}
                    </strong>{' '}
                    (Seat #{activeSeatNum})...
                  </div>
                )}
            </div>
          </div>

          {/* DESKTOP LAYOUT (md+): Unchanged Action Bar + Curved Hand Fan */}
          <div className="hidden md:block">
          {/* Action Bar Row */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            {/* Left: My Bluff Meter & Match Reputation */}
            {me ? (
              <div
                className={`relative flex items-center gap-3 rounded-xl px-3.5 py-2 border transition ${myVoiceSpeaking && myVoiceMicEnabled && !myVoiceMuted
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
                      className={`pointer-events-none absolute -top-2 left-2 z-30 shadow-xl whitespace-nowrap ${myLatestReaction.phrase
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
                          className={`h-3 w-3 ${myVoiceSpeaking
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

            {/* Center: Embossed Casino Action Controls (STRICT LINE-BY-LINE — ONLY ACTIVE ON YOUR TURN) */}
            <div className="flex flex-col items-center gap-2.5">
              {/* Fresh-Round 1-Tap Rank Picker: lets you play or bluff ANY rank A–K */}
              {canPlayCards && isFreshRound && (
                <div className="flex flex-col items-center gap-1.5 rounded-2xl bg-[#1A130D] border border-[#E6B84C]/35 px-2.5 py-2 shadow-lg max-w-full">
                  <span className="font-[var(--font-mono)] text-[9px] font-bold uppercase tracking-widest text-[#D8B974]">
                    WHICH CARD DO YOU WANT TO SAY? (GREEN DOT = YOU HAVE IT)
                  </span>
                  <div className="flex flex-wrap items-center justify-center gap-1">
                    {RANKS.map((r) => {
                      const active = declaredRank === r;
                      const inHand = myHandRanks.has(r);
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => {
                            vibrateTap(10);
                            setDeclaredRank(r);
                          }}
                          className={`relative flex h-8 min-w-[30px] sm:min-w-[32px] items-center justify-center rounded-lg px-1.5 font-[var(--font-mono)] text-xs font-extrabold transition cursor-pointer ${active
                            ? 'bg-gradient-to-b from-[#F5D582] to-[#C89428] text-[#140E08] shadow-[0_0_12px_rgba(230,184,76,0.5)] scale-105'
                            : inHand
                              ? 'bg-[#261D15] border border-[#E6B84C]/40 text-[#FAF3E3] hover:border-[#E6B84C]'
                              : 'bg-[#140F0C] border border-white/10 text-[#968674] hover:text-[#FAF3E3] hover:border-white/25'
                            }`}
                          title={
                            inHand
                              ? `Declare ${RANK_NAMES[r]} (you have this rank)`
                              : `Bluff ${RANK_NAMES[r]} (not in your hand)`
                          }
                        >
                          {r}
                          {inHand && !active && (
                            <span className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-emerald-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-center gap-2">
                {canPlayCards && (
                  <>
                    {selectedIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedIds([])}
                        className="rounded-xl bg-[#1E1712] border border-[#E6B84C]/25 px-3.5 py-2.5 text-xs font-bold text-[#D6C7B2] hover:border-[#E6B84C] cursor-pointer"
                      >
                        Clear ({selectedIds.length})
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={selectedIds.length === 0 || submitting}
                      onClick={handlePlaySelected}
                      className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-extrabold uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer ${selectionIsBluff ? 'crimson-btn' : 'gold-btn'
                        }`}
                    >
                      <Send className="h-3.5 w-3.5" />
                      {selectedIds.length === 0
                        ? `Tap Cards (${activeClaimRank})`
                        : selectionIsBluff
                          ? `BLUFF (${selectedIds.length}× ${activeClaimRank})`
                          : `Play (${selectedIds.length}× ${activeClaimRank})`}
                    </button>
                  </>
                )}

                {canPassOrChallenge && (
                  <>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handlePassTurn}
                      className="flex items-center gap-1.5 rounded-xl bg-[#0E4A34] border border-emerald-400/60 px-4 py-2.5 text-xs font-extrabold uppercase tracking-wider text-emerald-200 transition hover:bg-emerald-500 hover:text-[#09150F] disabled:opacity-40 cursor-pointer"
                      title="Skip your turn — if everyone passes, the pile burns and the last player starts a new round"
                    >
                      <SkipForward className="h-3.5 w-3.5" />
                      Pass
                    </button>

                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleChallengePlay}
                      className="crimson-btn flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-extrabold uppercase tracking-wider transition hover:-translate-y-0.5 disabled:opacity-40 cursor-pointer"
                      title={`Catch ${gameState.lastPlay?.playerName ?? 'previous player'}'s lie by revealing their cards`}
                    >
                      <ShieldAlert className="h-4 w-4" />
                      Catch Lie (Bluff!)
                    </button>
                  </>
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
                  !isDealingStage &&
                  !gameState.isSpectator &&
                  gameState.phase === 'playing' && (
                    <div className="rounded-xl bg-[#1A1410] border border-[#E6B84C]/20 px-4 py-2 text-xs text-[#B9A992]">
                      Line-by-line turns · Waiting for{' '}
                      <strong className="text-[#F6D889]">
                        {activePlayer?.username ?? 'active player'}
                      </strong>{' '}
                      (Seat #{activeSeatNum})...
                    </div>
                  )}
              </div>
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

          {/* Player's Hand Header (Total Cards + Selected Count) */}
          {!gameState.isSpectator && (
            <div className="mb-1 flex items-center justify-center gap-3 font-[var(--font-mono)] text-[10px] font-bold uppercase tracking-wider">
              <span className="text-[#C8B9A2]">
                YOUR HAND: <strong className="text-[#FAF3E3]">{gameState.myHand.length} CARDS</strong>
              </span>
              {selectedIds.length > 0 && (
                <span className="rounded-full bg-[#E6B84C]/20 border border-[#E6B84C]/50 px-2.5 py-0.5 text-[#F6D889]">
                  SELECTED: {selectedIds.length} → SAYING {selectedIds.length}× {activeClaimRank}
                </span>
              )}
            </div>
          )}

          {/* Player's Horizontal Curved Hand Fan */}
          {!gameState.isSpectator && (
            <div className="relative flex min-h-[136px] sm:min-h-[152px] items-end justify-center overflow-x-auto pb-1 pt-5 sm:px-36">
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
                    const matchesClaim = card.rank === activeClaimRank;
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
                        {matchesClaim && canPlayCards && (
                          <span
                            className="pointer-events-none absolute -top-2.5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#E6B84C] px-1.5 py-0.5 font-[var(--font-mono)] text-[8px] font-black text-[#140E08] shadow"
                            title={`Matches ${activeClaimRank}`}
                          >
                            MATCH
                          </span>
                        )}
                        <PlayingCard
                          card={card}
                          size="md"
                          selected={isSelected}
                          disabled={!canPlayCards}
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
        </div>
      </section>

      {/* PLAYER STATS MODAL (Opened when tapping an opponent on mobile) */}
      <AnimatePresence>
        {inspectedPlayer && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setInspectedPlayer(null)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              className="glass-panel relative z-10 w-full max-w-sm rounded-2xl border border-[#E6B84C]/45 p-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <AvatarBadge
                    avatar={inspectedPlayer.avatar}
                    size="sm"
                    isBot={inspectedPlayer.isBot}
                  />
                  <div>
                    <p className="text-sm font-bold text-[#FAF3E3]">{inspectedPlayer.username}</p>
                    <p className="font-[var(--font-mono)] text-[10px] text-[#E6B84C]">
                      Seat #{inspectedPlayer.seatIndex + 1} · {inspectedPlayer.cardCount} cards
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectedPlayer(null)}
                  className="rounded-lg p-1 text-[#B9A992] hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between font-[var(--font-mono)] text-[10px] text-[#B9A992]">
                  <span>BLUFF HEAT</span>
                  <span className="font-bold text-[#F6D889]">
                    {inspectedPlayer.bluffMetrics.label} ({inspectedPlayer.bluffMetrics.observedMeter}%)
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[#0B0907]">
                  <div
                    className={`h-full rounded-full ${
                      inspectedPlayer.bluffMetrics.observedMeter >= 70
                        ? 'bg-[#E1384B]'
                        : inspectedPlayer.bluffMetrics.observedMeter >= 45
                          ? 'bg-[#E6B84C]'
                          : 'bg-emerald-400'
                    }`}
                    style={{ width: `${inspectedPlayer.bluffMetrics.observedMeter}%` }}
                  />
                </div>
              </div>

              <div className="mt-3.5 grid grid-cols-2 gap-2 rounded-xl bg-[#0F0B09] p-3 font-[var(--font-mono)] text-xs">
                <span className="text-[#B9A992]">Caught Bluffs:</span>
                <span className="text-right font-bold text-[#E1384B]">
                  {inspectedPlayer.bluffMetrics.caughtBluffs}
                </span>
                <span className="text-[#B9A992]">Verified Truths:</span>
                <span className="text-right font-bold text-emerald-400">
                  {inspectedPlayer.bluffMetrics.verifiedTruths}
                </span>
                <span className="text-[#B9A992]">Correct Calls:</span>
                <span className="text-right font-bold text-[#E6B84C]">
                  {inspectedPlayer.matchStats.correctChallenges}
                </span>
                <span className="text-[#B9A992]">Wrong Calls:</span>
                <span className="text-right font-bold text-[#B9A992]">
                  {inspectedPlayer.matchStats.wrongChallenges}
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* LIVE CHAT & FAMOUS MEMES DRAWER (Header-triggered on mobile, bottom-left on desktop) */}
      <LiveChatDrawer
        externalOpen={mobileChatOpen}
        onExternalOpenChange={setMobileChatOpen}
        onUnreadChange={setChatUnread}
        hideMobileTrigger
      />

      {/* OPTIONAL VOICE CONTROL PANEL (Header-triggered on mobile, bottom-right on desktop) */}
      <VoiceControlPanel
        roomCode={gameState.roomCode}
        userId={user.id}
        externalExpanded={mobileVoiceOpen}
        onExternalExpandedChange={setMobileVoiceOpen}
        hideMobileTrigger
      />

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
