import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bot,
  Check,
  Clock,
  Copy,
  Crown,
  Eye,
  Gauge,
  Layers,
  Lock,
  LogOut,
  Mic,
  MicOff,
  Play,
  Settings2,
  Share2,
  Shield,
  Shuffle,
  UserMinus,
  Users,
} from 'lucide-react';
import type { BotPersonality, ReactionEmoji } from '@shared/types';
import { useGameStore } from '../store/useGameStore';
import { useVoiceStore } from '../store/useVoiceStore';
import { useToastStore } from '../store/useToastStore';
import { AvatarBadge } from '../components/AvatarBadge';
import { CreateRoomModal } from '../components/modals/CreateRoomModal';
import { VoiceControlPanel } from '../components/game/VoiceControlPanel';
import { LiveChatDrawer } from '../components/game/LiveChatDrawer';

const REACTIONS: ReactionEmoji[] = ['😂', '😈', '🤔', '🔥', '👀'];

export const LobbyPage: React.FC = () => {
  const {
    lobby,
    user,
    reactions,
    toggleReady,
    addBotToLobby,
    kickPlayer,
    startGame,
    leaveRoom,
    sendReaction,
    updateRoomSettings,
  } = useGameStore();
  const voicePeers = useVoiceStore((s) => s.peers);
  const pushToast = useToastStore((s) => s.push);

  const [copiedCode, setCopiedCode] = useState(false);
  const [editSettingsOpen, setEditSettingsOpen] = useState(false);
  const [botPersonality, setBotPersonality] = useState<BotPersonality>('strategic');

  if (!lobby || !user) return null;

  const isHost = lobby.hostId === user.id;
  const me = lobby.players.find((p) => p.id === user.id);
  const isSpectator = !me && lobby.spectators.some((s) => s.id === user.id);
  const openSlots = Math.max(0, lobby.settings.maxPlayers - lobby.players.length);
  const allReady = lobby.players.every((p) => p.isBot || p.isHost || p.isReady);

  const totalDeckCards = lobby.settings.deckCount * 52;
  const seatedCount = Math.max(2, lobby.players.length);
  const effectivePerPlayer =
    lobby.settings.cardsPerPlayer === 0
      ? Math.floor(totalDeckCards / seatedCount)
      : lobby.settings.cardsPerPlayer;
  const totalDistributed = effectivePerPlayer * lobby.players.length;
  const distributionValid = totalDistributed <= totalDeckCards;

  const canStart = isHost && lobby.players.length >= 2 && allReady && distributionValid;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(lobby.code);
      setCopiedCode(true);
      pushToast({ type: 'success', message: `Room code ${lobby.code} copied!` });
      setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      pushToast({ type: 'info', message: `Room code: ${lobby.code}` });
    }
  };

  const shareInviteLink = async () => {
    const inviteUrl = `${window.location.origin}${window.location.pathname}?join=${lobby.code}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Join my BLUFFED room (${lobby.code})`,
          text: `Join "${lobby.settings.roomName}" on BLUFFED using code ${lobby.code}`,
          url: inviteUrl,
        });
      } else {
        await navigator.clipboard.writeText(inviteUrl);
        pushToast({
          type: 'success',
          title: 'Invitation Link Copied',
          message: 'Send the link to your friends to join instantly.',
        });
      }
    } catch {
      await navigator.clipboard.writeText(inviteUrl).catch(() => {});
      pushToast({ type: 'success', message: 'Invitation link copied to clipboard.' });
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">
      {/* Top Banner with Large Room Code */}
      <div className="rounded-3xl surface-card p-6 sm:p-8 shadow-2xl">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-[#E6B84C]/15 border border-[#E6B84C]/35 px-2.5 py-0.5 font-[var(--font-mono)] text-[10px] font-bold uppercase tracking-wider text-[#F6D889]">
                {lobby.mode === 'private' ? 'PRIVATE ROOM' : 'LIVE LOBBY'}
              </span>
              {lobby.settings.hasPassword && (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 border border-amber-400/30 px-2 py-0.5 font-[var(--font-mono)] text-[10px] text-amber-300">
                  <Lock className="h-3 w-3" /> LOCKED
                </span>
              )}
              {isSpectator && (
                <span className="inline-flex items-center gap-1 rounded-md bg-[#1CD696]/15 border border-[#1CD696]/35 px-2 py-0.5 font-[var(--font-mono)] text-[10px] text-[#1CD696]">
                  <Eye className="h-3 w-3" /> SPECTATING
                </span>
              )}
            </div>
            <h1 className="mt-2 font-[var(--font-display)] text-2xl sm:text-3xl font-extrabold text-[#FAF3E3]">
              {lobby.settings.roomName}
            </h1>
            <p className="mt-1 text-sm text-[#B9A992]">
              Waiting for players to join and ready up. Share the code below to invite friends.
            </p>
          </div>

          {/* Room Code Box */}
          <div className="flex flex-col items-stretch gap-2.5 sm:flex-row sm:items-center">
            <div className="flex items-center justify-between gap-4 rounded-2xl bg-[#0B0907] border border-[#E6B84C]/40 px-5 py-3.5">
              <div>
                <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-[#B9A992]">
                  ROOM CODE
                </p>
                <p className="font-[var(--font-mono)] text-2xl sm:text-3xl font-bold tracking-[0.24em] text-[#FAF3E3]">
                  {lobby.code}
                </p>
              </div>
              <button
                type="button"
                onClick={copyCode}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E6B84C]/15 text-[#E6B84C] transition hover:bg-[#E6B84C] hover:text-[#0B0907] cursor-pointer"
                title="Copy room code"
              >
                {copiedCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>

            <button
              type="button"
              onClick={shareInviteLink}
              className="flex items-center justify-center gap-2 rounded-2xl bg-[#1CD696]/15 border border-[#1CD696]/40 px-5 py-4 text-xs font-bold uppercase tracking-wider text-[#1CD696] transition hover:bg-[#1CD696] hover:text-[#0B0907] cursor-pointer"
            >
              <Share2 className="h-4 w-4" />
              Share Invite
            </button>
          </div>
        </div>
      </div>

      {/* Main Lobby Content Grid */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 Columns: Player Seats */}
        <div className="lg:col-span-2 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[#1CD696]" />
              <h2 className="font-[var(--font-heading)] text-base font-bold text-[#FAF3E3]">
                Table Seats ({lobby.players.length} / {lobby.settings.maxPlayers})
              </h2>
            </div>

            {isHost && lobby.settings.enableBots && openSlots > 0 && (
              <div className="flex items-center gap-2">
                <select
                  value={botPersonality}
                  onChange={(e) => setBotPersonality(e.target.value as BotPersonality)}
                  className="rounded-lg bg-[#18130F] border border-white/10 px-2.5 py-1.5 text-xs text-[#DFD2BE] focus:border-[#E6B84C] focus:outline-none"
                >
                  <option value="aggressive">Aggressive AI</option>
                  <option value="strategic">Strategic AI</option>
                  <option value="unpredictable">Unpredictable AI</option>
                  <option value="defensive">Defensive AI</option>
                </select>
                <button
                  type="button"
                  onClick={() => addBotToLobby(botPersonality)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#E6B84C]/15 border border-[#E6B84C]/40 px-3 py-1.5 text-xs font-semibold text-[#FAF3E3] transition hover:bg-[#E6B84C] hover:text-[#0B0907] cursor-pointer"
                >
                  <Bot className="h-3.5 w-3.5" />
                  Add Bot
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            {lobby.players.map((p) => {
              const latestReaction = [...reactions].reverse().find((r) => r.playerId === p.id);
              const vp = voicePeers.find((peer) => peer.userId === p.id);
              const isSpeaking = Boolean(vp?.micEnabled && !vp?.muted && vp?.speaking);

              return (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`relative rounded-2xl p-4 border transition ${
                    isSpeaking
                      ? 'bg-[#142329] border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.22)]'
                      : p.id === user.id
                        ? 'bg-[#241B13] border-[#E6B84C]/45'
                        : 'bg-[#18130F] border-white/[0.08]'
                  }`}
                >
                  {/* Floating reaction or voice phrase */}
                  {latestReaction && (
                    <motion.span
                      key={latestReaction.id}
                      initial={{ opacity: 0, y: 6, scale: 0.6 }}
                      animate={{ opacity: 1, y: -8, scale: 1 }}
                      className={`absolute -top-3.5 right-4 drop-shadow-lg ${
                        latestReaction.phrase
                          ? 'rounded-lg bg-[#241B13] border border-[#1CD696]/50 px-2.5 py-1 text-[11px] font-bold text-[#FAF3E3]'
                          : 'text-2xl'
                      }`}
                    >
                      {latestReaction.phrase ? `“${latestReaction.phrase}”` : latestReaction.emoji}
                    </motion.span>
                  )}

                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative">
                        {isSpeaking && (
                          <span className="pointer-events-none absolute -inset-1 rounded-xl border-2 border-emerald-400/75 animate-ping" />
                        )}
                        <AvatarBadge
                          avatar={p.avatar}
                          size="md"
                          active={p.isReady || p.isHost || isSpeaking}
                          isBot={p.isBot}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-bold text-[#FAF3E3]">
                            {p.username}
                          </span>
                          {p.id === user.id && (
                            <span className="font-[var(--font-mono)] text-[10px] text-[#1CD696]">
                              (YOU)
                            </span>
                          )}
                          {vp?.micEnabled &&
                            (vp.muted ? (
                              <MicOff className="h-3.5 w-3.5 text-[#FF9BA6]" />
                            ) : (
                              <Mic
                                className={`h-3.5 w-3.5 ${
                                  vp.speaking ? 'text-emerald-400 animate-pulse' : 'text-emerald-400/80'
                                }`}
                              />
                            ))}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {p.isHost && (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-400/15 px-1.5 py-0.5 font-[var(--font-mono)] text-[9px] font-bold uppercase text-amber-300">
                              <Crown className="h-2.5 w-2.5" /> HOST
                            </span>
                          )}
                          {lobby.settings.firstPlayerMode === 'host_selected' &&
                            lobby.settings.firstPlayerId === p.id && (
                              <span className="rounded bg-[#E6B84C]/20 px-1.5 py-0.5 font-[var(--font-mono)] text-[9px] font-bold uppercase text-[#FAF3E3]">
                                FIRST TURN
                              </span>
                            )}
                          {p.isBot && p.botPersonality && (
                            <span className="rounded bg-[#1CD696]/15 px-1.5 py-0.5 font-[var(--font-mono)] text-[9px] font-bold uppercase text-[#1CD696]">
                              {p.botPersonality}
                            </span>
                          )}
                          {!p.connected && (
                            <span className="rounded bg-[#E1384B]/20 px-1.5 py-0.5 font-[var(--font-mono)] text-[9px] font-bold uppercase text-[#FF9BA6]">
                              RECONNECTING
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`rounded-lg px-2.5 py-1 font-[var(--font-mono)] text-[10px] font-bold uppercase ${
                          p.isReady || p.isHost
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-white/[0.05] text-[#B9A992] border border-white/10'
                        }`}
                      >
                        {p.isHost ? 'HOST' : p.isReady ? 'READY' : 'NOT READY'}
                      </span>

                      {isHost && p.id !== user.id && (
                        <button
                          type="button"
                          onClick={() => kickPlayer(p.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E1384B]/10 text-[#E1384B] transition hover:bg-[#E1384B] hover:text-[#0B0907] cursor-pointer"
                          title={`Remove ${p.username}`}
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Player Reputation Micro Bar */}
                  <div className="mt-3.5 flex items-center justify-between gap-4 border-t border-white/[0.06] pt-2.5 font-[var(--font-mono)] text-[10px] text-[#B9A992]">
                    <div className="flex items-center gap-4">
                      <span>
                        Bluffs:{' '}
                        <strong className="text-[#F6D889]">{p.reputation.successfulBluffs}</strong>
                      </span>
                      <span>
                        Reads:{' '}
                        <strong className="text-[#1CD696]">{p.reputation.correctChallenges}</strong>
                      </span>
                    </div>
                    {isHost && lobby.settings.firstPlayerMode === 'host_selected' && (
                      <button
                        type="button"
                        onClick={() => updateRoomSettings({ firstPlayerId: p.id })}
                        className={`rounded px-2 py-0.5 text-[9px] font-bold uppercase transition cursor-pointer ${
                          lobby.settings.firstPlayerId === p.id
                            ? 'bg-[#E6B84C] text-[#0B0907]'
                            : 'bg-white/[0.05] text-[#B9A992] hover:text-white'
                        }`}
                      >
                        {lobby.settings.firstPlayerId === p.id ? 'Starts 1st' : 'Set 1st'}
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}

            {/* Empty Seat Placeholders */}
            {Array.from({ length: openSlots }).map((_, idx) => (
              <div
                key={`empty-${idx}`}
                className="flex items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#120E0B]/50 p-6 text-center"
              >
                <div>
                  <p className="text-xs font-semibold text-[#6E7690]">Open Seat</p>
                  <p className="mt-0.5 text-[11px] text-[#4E5670]">
                    Invite a friend with code {lobby.code}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Lobby Reactions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#18130F] border border-white/[0.07] px-4 py-3">
            <span className="text-xs font-medium text-[#B9A992]">Quick Table Emotes</span>
            <div className="flex items-center gap-1.5">
              {REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => sendReaction(emoji)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#120E0B] border border-white/[0.07] text-lg transition hover:scale-110 hover:border-[#E6B84C]/50 cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Settings Summary & Controls */}
        <div className="space-y-4">
          <div className="rounded-2xl surface-card p-5">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3.5">
              <h3 className="font-[var(--font-heading)] text-sm font-bold uppercase tracking-wider text-[#FAF3E3]">
                Match & Deck Rules
              </h3>
              {isHost && (
                <button
                  type="button"
                  onClick={() => setEditSettingsOpen(true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#1CD696] hover:underline cursor-pointer"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  Configure
                </button>
              )}
            </div>

            <dl className="mt-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-2 text-[#B9A992]">
                  <Layers className="h-3.5 w-3.5 text-[#E6B84C]" /> Decks
                </dt>
                <dd className="font-[var(--font-mono)] font-semibold text-[#FAF3E3]">
                  {lobby.settings.deckCount === 2 ? '2 Decks (104)' : '1 Deck (52)'}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-2 text-[#B9A992]">
                  <Shuffle className="h-3.5 w-3.5 text-[#1CD696]" /> Cards / Player
                </dt>
                <dd className="font-[var(--font-mono)] font-semibold text-[#FAF3E3]">
                  {lobby.settings.cardsPerPlayer === 0
                    ? `Full (${effectivePerPlayer} each)`
                    : `${lobby.settings.cardsPerPlayer} each`}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[#B9A992] pl-5.5">Distribution</dt>
                <dd className="font-[var(--font-mono)] text-[11px] text-[#1CD696]">
                  {totalDistributed} dealt · {Math.max(0, totalDeckCards - totalDistributed)} reserve
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-2 text-[#B9A992]">
                  <Gauge className="h-3.5 w-3.5 text-[#E6B84C]" /> Deal Mode & Speed
                </dt>
                <dd className="font-[var(--font-mono)] font-semibold uppercase text-[#FAF3E3]">
                  {lobby.settings.distributionMode === 'manual' ? 'Manual' : 'Auto'} ·{' '}
                  {lobby.settings.shuffleSpeed}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-2 text-[#B9A992]">
                  <Crown className="h-3.5 w-3.5 text-amber-400" /> First Player
                </dt>
                <dd className="font-[var(--font-mono)] font-semibold text-[#FAF3E3]">
                  {lobby.settings.firstPlayerMode === 'host_selected'
                    ? lobby.players.find((p) => p.id === lobby.settings.firstPlayerId)?.username ??
                      'Host Pick'
                    : 'Random'}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-2 text-[#B9A992]">
                  <Shield className="h-3.5 w-3.5 text-[#1CD696]" /> Difficulty
                </dt>
                <dd className="font-[var(--font-mono)] font-semibold uppercase text-[#FAF3E3]">
                  {lobby.settings.difficulty}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-2 text-[#B9A992]">
                  <Clock className="h-3.5 w-3.5 text-[#E6B84C]" /> Turn Timer
                </dt>
                <dd className="font-[var(--font-mono)] font-semibold text-[#FAF3E3]">
                  {lobby.settings.turnTimer}s
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-2 text-[#B9A992]">
                  <Eye className="h-3.5 w-3.5 text-[#1CD696]" /> Spectators
                </dt>
                <dd className="font-[var(--font-mono)] font-semibold text-[#FAF3E3]">
                  {lobby.settings.allowSpectators
                    ? `Allowed (${lobby.spectators.length})`
                    : 'Disabled'}
                </dd>
              </div>
            </dl>

            {/* Primary Action Buttons */}
            <div className="mt-6 space-y-2.5 border-t border-white/[0.06] pt-5">
              {isHost ? (
                <>
                  <button
                    type="button"
                    onClick={startGame}
                    disabled={!canStart}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#E6B84C] py-3.5 text-xs font-bold uppercase tracking-widest text-[#0B0907] shadow-lg transition hover:bg-[#F3CF7A] disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    Start Game & Shuffle
                  </button>
                  {!canStart && (
                    <p className="text-center text-[11px] text-[#B9A992]">
                      {!distributionValid
                        ? 'Requested cards exceed available deck size — adjust deck settings.'
                        : lobby.players.length < 2
                          ? 'Need at least 2 players (or add an AI bot) to start.'
                          : 'Waiting for all human players to mark Ready.'}
                    </p>
                  )}
                </>
              ) : !isSpectator ? (
                <button
                  type="button"
                  onClick={toggleReady}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-xs font-bold uppercase tracking-widest transition cursor-pointer ${
                    me?.isReady
                      ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300'
                      : 'bg-[#1CD696] text-[#0B0907] hover:bg-[#3EE4AB]'
                  }`}
                >
                  <Check className="h-4 w-4" />
                  {me?.isReady ? 'Ready (Click to Cancel)' : 'Mark Ready'}
                </button>
              ) : (
                <div className="rounded-xl bg-[#120E0B] p-3 text-center text-xs text-[#1CD696]">
                  You will watch live once the host deals the table.
                </div>
              )}

              <button
                type="button"
                onClick={leaveRoom}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#E1384B]/10 border border-[#E1384B]/30 py-2.5 text-xs font-semibold text-[#FF9BA6] transition hover:bg-[#E1384B]/20 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                Leave Room
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Live Room Chat & Famous Memes */}
      <LiveChatDrawer />

      {/* Optional Room Voice Control Panel */}
      <VoiceControlPanel roomCode={lobby.code} userId={user.id} />

      {/* Host Edit Settings Modal */}
      {isHost && (
        <CreateRoomModal
          open={editSettingsOpen}
          onClose={() => setEditSettingsOpen(false)}
          editMode
          initialSettings={lobby.settings}
          lobbyPlayers={lobby.players}
        />
      )}
    </div>
  );
};
