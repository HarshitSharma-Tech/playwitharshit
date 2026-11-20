import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bot,
  Check,
  Crown,
  Disc3,
  Flame,
  KeyRound,
  Music2,
  Play,
  PlusCircle,
  Radio,
  Sparkles,
  Swords,
  User,
  Users,
} from 'lucide-react';
import type { Card, PlatformStats } from '@shared/types';
import { api } from '../lib/api';
import { useGameStore } from '../store/useGameStore';
import { useMusicStore } from '../store/useMusicStore';
import { useToastStore } from '../store/useToastStore';
import { PlayingCard } from '../components/PlayingCard';
import { AVATAR_OPTIONS } from '../components/AvatarBadge';

const HERO_AVATARS = AVATAR_OPTIONS.slice(0, 5);

const INTERACTIVE_DECK_PREVIEW: Array<{ card?: Card; faceDown?: boolean; angle: number }> = [
  { faceDown: true, angle: -20 },
  { card: { id: 'p_q', rank: 'Q', suit: 'diamonds' }, angle: -10 },
  { card: { id: 'p_a', rank: 'A', suit: 'spades' }, angle: 0 },
  { card: { id: 'p_k', rank: 'K', suit: 'hearts' }, angle: 10 },
  { faceDown: true, angle: 20 },
];

const TICKER_ITEMS = [
  '♠ ROYAL SPEAKEASY LIVE · 2–6 PLAYER BLUFF TABLES',
  '🎙️ OPTIONAL LIVE WEBRTC VOICE CHAT + DESI ROASTS',
  '🔥 "DEKH RAHA HAI BINOD? KAISE BLUFF KAR RAHA HAI!"',
  '🃏 1 DECK (52) OR 2 DECKS (104) CUSTOM SHUFFLE & CLOCKWISE DEAL',
  '👑 "YE BABURAO KA STYLE HAI — 3-CARD FINAL BLUFF!"',
  '🎵 LOUNGE RADIO: DESI MIDNIGHT TRAP · VIP VELVET LOUNGE · SHOWDOWN',
];

export const HomePage: React.FC = () => {
  const { user, updateProfile, startQuickPlay, setModal, setView } = useGameStore();
  const { playing: musicPlaying, track, toggle: toggleMusic, nextTrack } = useMusicStore();
  const pushToast = useToastStore((s) => s.push);

  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [playerName, setPlayerName] = useState(user?.username ?? '');
  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatar ?? 'ace');
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [deckFlipped, setDeckFlipped] = useState(false);

  useEffect(() => {
    if (user) {
      setPlayerName(user.username);
      setSelectedAvatar(user.avatar);
    }
  }, [user?.username, user?.avatar]);

  useEffect(() => {
    let active = true;
    api
      .getStats()
      .then((res) => {
        if (active) setStats(res);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingStats(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const persistNameIfChanged = async (): Promise<boolean> => {
    if (!user) return true;
    const trimmed = playerName.trim();
    if (trimmed === user.username && selectedAvatar === user.avatar) return true;
    if (trimmed.length < 3) {
      pushToast({ type: 'warning', message: 'Player name must be at least 3 characters.' });
      return false;
    }
    setSavingIdentity(true);
    try {
      await updateProfile({ username: trimmed, avatar: selectedAvatar });
      return true;
    } catch (err) {
      pushToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Could not update name.',
      });
      return false;
    } finally {
      setSavingIdentity(false);
    }
  };

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    await persistNameIfChanged();
  };

  const handleQuickPlay = async () => {
    if (await persistNameIfChanged()) startQuickPlay();
  };

  const handleCreateRoom = async () => {
    if (await persistNameIfChanged()) setModal('createRoom', true);
  };

  const handlePlayBots = async () => {
    if (await persistNameIfChanged()) setModal('bots', true);
  };

  const identityDirty =
    Boolean(user) &&
    (playerName.trim() !== user?.username || selectedAvatar !== user?.avatar);

  const selectedAvatarObj =
    AVATAR_OPTIONS.find((a) => a.id === selectedAvatar) ?? AVATAR_OPTIONS[0];

  return (
    <div className="pb-20">
      {/* LIVE CASINO CLUB MARQUEE TICKER */}
      <div className="overflow-hidden border-b border-[#E6B84C]/15 bg-[#120E0B] py-2">
        <div className="animate-marquee flex items-center gap-10 whitespace-nowrap font-[var(--font-mono)] text-[10px] font-semibold tracking-[0.22em] text-[#D8B974]">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span key={i} className="inline-flex items-center gap-3">
              {item}
              <span className="text-[#E1384B]">♦</span>
            </span>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-7 sm:px-6 lg:px-8">
        {/* CINEMATIC SPEAKEASY SPLIT HERO */}
        <section className="relative overflow-hidden rounded-[32px] border border-[#E6B84C]/30 bg-[#100C09] shadow-[0_32px_90px_-20px_rgba(0,0,0,0.95)]">
          {/* Warm Monte Carlo Speakeasy Photograph */}
          <img
            src="/images/hero-speakeasy.jpg"
            alt="Royal Underground Speakeasy Card Lounge"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-55 scale-105"
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(105deg, rgba(11,9,7,0.95) 0%, rgba(11,9,7,0.82) 52%, rgba(11,9,7,0.58) 100%)',
            }}
          />

          {/* Subtle golden corner ornament lines */}
          <div className="pointer-events-none absolute top-4 left-4 h-7 w-7 border-t-2 border-l-2 border-[#E6B84C]/55 rounded-tl-lg" />
          <div className="pointer-events-none absolute top-4 right-4 h-7 w-7 border-t-2 border-r-2 border-[#E6B84C]/55 rounded-tr-lg" />
          <div className="pointer-events-none absolute bottom-4 left-4 h-7 w-7 border-b-2 border-l-2 border-[#E6B84C]/55 rounded-bl-lg" />
          <div className="pointer-events-none absolute bottom-4 right-4 h-7 w-7 border-b-2 border-r-2 border-[#E6B84C]/55 rounded-br-lg" />

          <div className="relative z-10 grid grid-cols-1 items-center gap-10 px-6 py-10 sm:px-12 sm:py-14 lg:grid-cols-12">
            {/* LEFT 7 COLS: Editorial Typography, VIP Pass & Actions */}
            <div className="lg:col-span-7 text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E6B84C]/40 bg-[#18120C]/85 px-3.5 py-1.5 backdrop-blur-md">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-[var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.22em] text-[#F6D889]">
                  ROYAL UNDERGROUND BLUFF CLUB
                </span>
              </div>

              <h1 className="mt-5 font-[var(--font-display)] text-4xl font-extrabold leading-[1.04] tracking-wide text-[#FAF3E3] sm:text-5xl xl:text-6xl">
                TRUST NO ONE.
                <span className="mt-1 block font-[var(--font-editorial)] italic font-bold tracking-normal text-[#E6B84C]">
                  Question Everything.
                </span>
              </h1>

              <p className="mt-4 max-w-xl text-sm sm:text-base leading-relaxed text-[#D8CAB3]">
                The cards are simple. Your opponents aren&apos;t. Step into the velvet emerald
                table — bluff your friends over live mic, drop iconic Hindi memes, and catch
                liars red-handed.
              </p>

              {/* GOLD-EMBOSSED VIP MEMBERSHIP PASS (Name + Portrait Picker) */}
              <form
                onSubmit={handleSaveName}
                className="mt-7 rounded-2xl border border-[#E6B84C]/35 bg-gradient-to-br from-[#1C1510]/95 via-[#140F0B]/95 to-[#0D271D]/85 p-4 sm:p-5 shadow-2xl backdrop-blur-md"
              >
                <div className="mb-3 flex items-center justify-between border-b border-[#E6B84C]/15 pb-2.5">
                  <span className="flex items-center gap-1.5 font-[var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.22em] text-[#E6B84C]">
                    <Crown className="h-3.5 w-3.5" />
                    VIP TABLE PASS · {selectedAvatarObj.label.toUpperCase()}
                  </span>
                  <span className="font-[var(--font-mono)] text-[10px] text-[#B9A992]">
                    NO. {user?.id.slice(-4).toUpperCase() ?? '0001'}
                  </span>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <label
                      htmlFor="hero-player-name"
                      className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#B9A992]"
                    >
                      <User className="h-3.5 w-3.5 text-[#E6B84C]" />
                      Your Table Name
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="hero-player-name"
                        type="text"
                        minLength={3}
                        maxLength={20}
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        placeholder="Enter name (e.g. BaburaoDon)"
                        className="w-full rounded-xl bg-[#0B0907]/90 border border-[#E6B84C]/25 px-3.5 py-2.5 text-sm font-bold text-[#FAF3E3] placeholder-[#6E6151] focus:border-[#E6B84C] focus:outline-none"
                      />
                      {identityDirty && (
                        <button
                          type="submit"
                          disabled={savingIdentity}
                          className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-emerald-500 px-3.5 py-2.5 text-xs font-bold text-[#0B0907] hover:bg-emerald-400 cursor-pointer"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Save
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#B9A992]">
                      Choose Portrait
                    </span>
                    <div className="flex items-center gap-2">
                      {HERO_AVATARS.map((av) => {
                        const active = selectedAvatar === av.id;
                        return (
                          <button
                            key={av.id}
                            type="button"
                            onClick={() => {
                              setSelectedAvatar(av.id);
                              updateProfile({ avatar: av.id }).catch(() => {});
                            }}
                            title={av.label}
                            className={`relative h-11 w-11 overflow-hidden rounded-xl border-2 transition cursor-pointer ${
                              active
                                ? 'border-[#E6B84C] scale-110 ring-2 ring-[#E6B84C]/40 shadow-lg'
                                : 'border-white/15 opacity-75 hover:opacity-100 hover:scale-105'
                            }`}
                          >
                            <img
                              src={av.photo}
                              alt={av.label}
                              className="h-full w-full object-cover"
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </form>

              {/* PRIMARY EMBOSSED CASINO CTAs */}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleQuickPlay}
                  className="gold-btn flex flex-1 sm:flex-none items-center justify-center gap-2.5 rounded-2xl px-8 py-4 text-xs font-extrabold uppercase tracking-[0.18em] transition hover:-translate-y-0.5 cursor-pointer"
                >
                  <Play className="h-4 w-4 fill-current" />
                  Play Now
                </button>

                <button
                  type="button"
                  onClick={handleCreateRoom}
                  className="flex flex-1 sm:flex-none items-center justify-center gap-2.5 rounded-2xl bg-[#0D4430] border border-[#E6B84C]/55 px-7 py-4 text-xs font-extrabold uppercase tracking-[0.15em] text-[#FAF3E3] shadow-xl transition hover:-translate-y-0.5 hover:bg-[#12593F] cursor-pointer"
                >
                  <PlusCircle className="h-4 w-4 text-[#E6B84C]" />
                  Create Private Room
                </button>
              </div>

              {/* SECONDARY MODE CHIPS */}
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setModal('joinRoom', true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#E6B84C]/25 bg-[#16110E]/90 px-4 py-2 text-xs font-semibold text-[#FAF3E3] transition hover:border-[#E6B84C] cursor-pointer"
                >
                  <KeyRound className="h-3.5 w-3.5 text-[#E6B84C]" />
                  Join by Code
                </button>

                <button
                  type="button"
                  onClick={handlePlayBots}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#E1384B]/40 bg-[#241215]/90 px-4 py-2 text-xs font-semibold text-[#FFD5DA] transition hover:border-[#E1384B] hover:bg-[#31161A] cursor-pointer"
                >
                  <Bot className="h-3.5 w-3.5 text-[#E1384B]" />
                  Play vs AI Bots
                </button>
              </div>
            </div>

            {/* RIGHT 5 COLS: Interactive Collector Card Fan + Lounge Turntable */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center">
              <div
                onClick={() => setDeckFlipped((f) => !f)}
                className="group relative flex h-56 w-full cursor-pointer items-center justify-center select-none"
                title="Click to flip the collector deck!"
              >
                {/* Warm radial chandelier halo behind cards */}
                <div
                  className="pointer-events-none absolute h-48 w-48 rounded-full opacity-35 blur-3xl transition duration-500 group-hover:opacity-55"
                  style={{
                    background: 'radial-gradient(circle, #E6B84C 0%, transparent 70%)',
                  }}
                />
                <div className="relative flex items-center justify-center">
                  {INTERACTIVE_DECK_PREVIEW.map((item, idx) => (
                    <motion.div
                      key={idx}
                      whileHover={{ y: -22, scale: 1.08 }}
                      animate={{
                        rotate: item.angle + (deckFlipped ? 4 : 0),
                        x: (idx - 2) * 32,
                        y: Math.abs(idx - 2) * 8,
                      }}
                      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                      style={{ zIndex: idx + 1 }}
                      className="absolute"
                    >
                      <PlayingCard
                        card={item.card}
                        faceDown={deckFlipped ? !item.faceDown : item.faceDown}
                        size="md"
                      />
                    </motion.div>
                  ))}
                </div>
                <span className="absolute bottom-1 rounded-full bg-[#0B0907]/85 border border-[#E6B84C]/35 px-3 py-1 font-[var(--font-mono)] text-[9px] font-bold uppercase tracking-widest text-[#F6D889]">
                  TAP CARDS TO FLIP COLLECTOR DECK
                </span>
              </div>

              {/* Golden Turntable Lounge Radio Card */}
              <div className="mt-4 w-full max-w-sm rounded-2xl border border-[#E6B84C]/30 bg-[#140F0C]/90 p-3.5 backdrop-blur-md shadow-xl">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-[#E6B84C]/60 bg-gradient-to-br from-[#2C1E10] to-[#0B0907] ${
                        musicPlaying ? 'animate-spin' : ''
                      }`}
                    >
                      {musicPlaying ? (
                        <Disc3 className="h-5 w-5 text-[#E6B84C]" />
                      ) : (
                        <Music2 className="h-5 w-5 text-[#E6B84C]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-[var(--font-mono)] text-[9px] uppercase tracking-widest text-[#E6B84C]">
                        {musicPlaying ? 'NOW SPINNING' : 'CLUB SOUNDTRACK'}
                      </p>
                      <p className="truncate text-xs font-bold text-[#FAF3E3]">{track.title}</p>
                      <p className="text-[10px] text-[#B9A992]">{track.vibe}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={toggleMusic}
                      className="gold-btn rounded-xl px-3.5 py-2 text-[10px] font-extrabold uppercase tracking-wider cursor-pointer"
                    >
                      {musicPlaying ? 'Pause' : 'Play'}
                    </button>
                    <button
                      type="button"
                      onClick={nextTrack}
                      className="rounded-xl border border-[#E6B84C]/30 bg-[#1E1610] px-2.5 py-2 font-[var(--font-mono)] text-[10px] font-bold text-[#F6D889] hover:border-[#E6B84C] cursor-pointer"
                    >
                      NEXT
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* THREE CINEMA POSTER FEATURE CARDS */}
        <section className="mt-9 grid grid-cols-1 gap-6 md:grid-cols-3">
          {[
            {
              title: 'Host a Velvet Table',
              tag: 'PRIVATE ROOMS · LIVE MIC',
              image: '/images/hero-speakeasy.jpg',
              desc: '1 or 2 decks (52 or 104 cards), custom cards per player, riffle shuffling, live WebRTC voice chat, and room codes for your crew.',
              Icon: Users,
              accent: 'text-[#E6B84C]',
              actionLabel: 'Create Private Room',
              onAction: handleCreateRoom,
            },
            {
              title: 'Catch Liars Red-Handed',
              tag: 'REAL MEMES · DESI ROASTS',
              image: 'https://i.imgflip.com/3lmzyx.jpg',
              desc: 'Call BLUFF to trigger 3D card reveals, real iconic meme popups in live chat, and watch the liar absorb the entire pile.',
              Icon: Flame,
              accent: 'text-[#E1384B]',
              actionLabel: 'Battle AI Bots Now',
              onAction: handlePlayBots,
            },
            {
              title: 'Rule the Hall of Fame',
              tag: 'ASLI KHILADI RANKINGS',
              image: 'https://i.imgflip.com/39t1o.jpg',
              desc: 'Track your Observed Bluff Meter, earn Master Deceiver & Perfect Detective badges, and climb global & weekly leaderboards.',
              Icon: Crown,
              accent: 'text-emerald-400',
              actionLabel: 'Open Hall of Fame',
              onAction: () => setView('leaderboard'),
            },
          ].map((card) => {
            const Icon = card.Icon;
            return (
              <div
                key={card.title}
                className="group overflow-hidden rounded-2xl surface-card flex flex-col justify-between transition duration-300 hover:border-[#E6B84C]/55 hover:-translate-y-1.5"
              >
                <div>
                  <div className="relative h-44 w-full overflow-hidden">
                    <img
                      src={card.image}
                      alt={card.title}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#16110E] via-[#16110E]/35 to-transparent" />
                    <span className="absolute top-3 left-3 rounded-lg bg-[#0B0907]/85 border border-[#E6B84C]/40 px-2.5 py-1 font-[var(--font-mono)] text-[9px] font-bold tracking-widest text-[#F6D889]">
                      {card.tag}
                    </span>
                  </div>
                  <div className="px-6 pt-3 pb-2">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${card.accent}`} />
                      <h2 className="font-[var(--font-display)] text-lg font-bold tracking-wide text-[#FAF3E3]">
                        {card.title}
                      </h2>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-[#B9A992]">{card.desc}</p>
                  </div>
                </div>
                <div className="px-6 pb-5 pt-3">
                  <button
                    type="button"
                    onClick={card.onAction}
                    className="inline-flex items-center gap-1.5 font-[var(--font-mono)] text-xs font-bold uppercase tracking-wider text-[#E6B84C] transition group-hover:text-[#FAF3E3] cursor-pointer"
                  >
                    {card.actionLabel}
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              </div>
            );
          })}
        </section>

        {/* LIVE CLUB LEDGER & HIGHLIGHTS */}
        <section className="mt-10 rounded-3xl surface-card p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-emerald-400" />
                <span className="font-[var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-400">
                  LIVE CLUB LEDGER
                </span>
              </div>
              <h2 className="mt-1 font-[var(--font-display)] text-2xl font-bold tracking-wide text-[#FAF3E3]">
                Arena Pulse & Legendary Plays
              </h2>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#E6B84C]/20 bg-[#0B0907] px-3 py-1.5 font-[var(--font-mono)] text-[10px] text-[#B9A992]">
              <Swords className="h-3 w-3 text-[#E6B84C]" />
              LIVE SERVER COUNTERS + DEMO COMMUNITY BASELINE
            </span>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {loadingStats || !stats
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-24 animate-pulse rounded-2xl bg-[#0D0A08] border border-[#E6B84C]/10"
                  />
                ))
              : [
                  {
                    label: 'Total Hands Played',
                    value: stats.totalGamesPlayed.toLocaleString(),
                    note: 'Incl. demo baseline',
                    accent: 'text-[#FAF3E3]',
                  },
                  {
                    label: 'Players in Club',
                    value: stats.activePlayers.toLocaleString(),
                    note: 'Online + demo pulse',
                    accent: 'text-[#E6B84C]',
                  },
                  {
                    label: 'Live Open Tables',
                    value: stats.liveRooms.toString(),
                    note: 'Real-time server count',
                    accent: 'text-emerald-400',
                  },
                  {
                    label: 'Bluffs Exposed',
                    value: stats.bluffsCaughtToday.toLocaleString(),
                    note: 'Incl. demo baseline',
                    accent: 'text-[#E1384B]',
                  },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="rounded-2xl bg-[#0D0A08] border border-[#E6B84C]/15 p-4 sm:p-5"
                  >
                    <p className="text-xs font-medium text-[#B9A992]">{m.label}</p>
                    <p className={`mt-2 font-[var(--font-mono)] text-2xl sm:text-3xl font-bold ${m.accent}`}>
                      {m.value}
                    </p>
                    <p className="mt-1 font-[var(--font-mono)] text-[10px] text-[#7D6E5B]">
                      {m.note}
                    </p>
                  </div>
                ))}
          </div>

          <div className="mt-6">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#E6B84C]">
              <Sparkles className="h-3.5 w-3.5" />
              Club Highlights (Featured Demo Plays)
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {(stats?.highlights ?? []).map((hl) => (
                <div
                  key={hl.id}
                  className="rounded-2xl bg-[#0D0A08] border border-[#E6B84C]/15 p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-md bg-[#E6B84C]/15 border border-[#E6B84C]/30 px-2 py-0.5 font-[var(--font-mono)] text-[9px] font-bold text-[#F6D889]">
                      {hl.tag}
                    </span>
                    <span className="font-[var(--font-mono)] text-[11px] text-emerald-400">
                      @{hl.player}
                    </span>
                  </div>
                  <h3 className="mt-2.5 font-[var(--font-display)] text-sm font-bold text-[#FAF3E3]">
                    {hl.title}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-[#B9A992]">{hl.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
