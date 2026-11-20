import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Headphones,
  MessageSquareQuote,
  Mic,
  MicOff,
  PhoneOff,
  Radio,
  RefreshCw,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { HINDI_MEME_ROASTS } from '../../lib/hindiMemes';
import { useVoiceStore } from '../../store/useVoiceStore';
import { useGameStore } from '../../store/useGameStore';

interface VoiceControlPanelProps {
  roomCode: string;
  userId: string;
}

export const VoiceControlPanel: React.FC<VoiceControlPanelProps> = ({ roomCode, userId }) => {
  const {
    status,
    micEnabled,
    muted,
    pushToTalk,
    speakerEnabled,
    speakerVolume,
    speaking,
    micLevel,
    connectedAudioPeers,
    transportMode,
    autoplayBlocked,
    receivingAudio,
    selfTesting,
    error,
    peers,
    enableMic,
    disableMic,
    toggleMute,
    setMuted,
    togglePushToTalk,
    toggleSpeaker,
    setSpeakerVolume,
    toggleSelfTest,
    unlockAudio,
    clearError,
  } = useVoiceStore();

  const { sendVoicePhrase } = useGameStore();
  const [expanded, setExpanded] = useState(false);
  const [showPhrases, setShowPhrases] = useState(false);

  // Hold 'V' key for Push-to-Talk (zero echo!)
  useEffect(() => {
    if (!micEnabled || !pushToTalk) return;
    const isTyping = (target: EventTarget | null) =>
      target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

    const onDown = (e: KeyboardEvent) => {
      if (e.repeat || isTyping(e.target)) return;
      if (e.key.toLowerCase() === 'v') setMuted(false);
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'v') setMuted(true);
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [micEnabled, pushToTalk, setMuted]);

  const activeVoicePeers = peers.filter((p) => p.micEnabled);
  const statusDot =
    status === 'connected'
      ? muted
        ? 'bg-amber-400'
        : speaking
          ? 'bg-emerald-400 animate-ping'
          : 'bg-emerald-400'
      : status === 'listening'
        ? 'bg-[#1CD696]'
        : status === 'connecting' || status === 'reconnecting'
          ? 'bg-[#E6B84C] animate-pulse'
          : status === 'error'
            ? 'bg-[#E1384B]'
            : 'bg-[#6E6151]';

  return (
    <div className="fixed bottom-3 right-3 z-30 flex flex-col items-end gap-2">
      {/* Browser Autoplay Unmute Prompt */}
      <AnimatePresence>
        {autoplayBlocked && speakerEnabled && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            onClick={unlockAudio}
            className="glass-panel flex items-center gap-2 rounded-xl border border-[#1CD696]/70 bg-[#0D271E]/95 px-3.5 py-2 text-xs font-bold text-[#1CD696] shadow-xl hover:bg-[#1CD696] hover:text-[#0B0907] cursor-pointer"
          >
            <Volume2 className="h-4 w-4 animate-pulse" />
            Tap to Hear Room Voice
          </motion.button>
        )}
      </AnimatePresence>

      {/* Permission / Error Banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            className="glass-panel w-[calc(100vw-24px)] max-w-[300px] rounded-2xl border border-[#E1384B]/55 p-3.5 shadow-2xl"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#E1384B]" />
              <div className="flex-1 text-xs leading-relaxed text-[#FFD2D8]">{error}</div>
            </div>
            <div className="mt-2.5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={clearError}
                className="rounded-lg px-2.5 py-1 text-[11px] text-[#B9A992] hover:text-white cursor-pointer"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => enableMic(userId, roomCode)}
                className="inline-flex items-center gap-1 rounded-lg bg-[#E6B84C] px-3 py-1 text-[11px] font-bold text-[#0B0907] hover:bg-[#F3CF7A] cursor-pointer"
              >
                <RefreshCw className="h-3 w-3" />
                Retry Mic
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expandable Discord-Style Voice Lounge Drawer */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="glass-panel w-[calc(100vw-24px)] max-w-[310px] rounded-2xl border border-[#E6B84C]/40 p-4 shadow-2xl space-y-3.5"
          >
            <div className="flex items-center justify-between border-b border-[#E6B84C]/18 pb-2.5">
              <div className="flex items-center gap-2">
                <Radio className={`h-4 w-4 ${micEnabled || receivingAudio ? 'text-emerald-400' : 'text-[#E6B84C]'}`} />
                <div>
                  <p className="font-[var(--font-mono)] text-[10px] font-bold uppercase tracking-widest text-[#F6D889]">
                    VOICE LOUNGE
                  </p>
                  <p className="font-[var(--font-mono)] text-[9px] text-[#B9A992]">
                    {status === 'connected'
                      ? transportMode === 'p2p'
                        ? `HD WebRTC · ${connectedAudioPeers} peer${connectedAudioPeers === 1 ? '' : 's'}`
                        : 'Connected · Ready'
                      : status === 'listening'
                        ? 'Listen-Only Active'
                        : 'Microphone Off'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.05] text-[#B9A992] hover:text-white cursor-pointer"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>

            {/* Active Voice Participants */}
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 font-[var(--font-mono)] text-[9px] font-bold uppercase tracking-wider text-[#B9A992]">
                <Users className="h-3 w-3 text-[#E6B84C]" />
                ON MIC ({activeVoicePeers.length})
              </p>
              {activeVoicePeers.length === 0 ? (
                <p className="rounded-xl bg-[#0B0907]/80 px-3 py-2 text-[11px] text-[#7D6E5B]">
                  Nobody on mic yet. Tap Enable Mic to start talking!
                </p>
              ) : (
                <div className="max-h-28 space-y-1.5 overflow-y-auto pr-1">
                  {activeVoicePeers.map((p) => (
                    <div
                      key={p.userId}
                      className={`flex items-center justify-between rounded-xl px-3 py-1.5 text-xs border ${
                        p.speaking
                          ? 'bg-[#10271E] border-emerald-400/50 text-[#FAF3E3]'
                          : 'bg-[#0B0907]/75 border-white/[0.06] text-[#DFD2BE]'
                      }`}
                    >
                      <span className="truncate font-semibold">
                        {p.username} {p.userId === userId ? '(You)' : ''}
                      </span>
                      {p.muted ? (
                        <MicOff className="h-3.5 w-3.5 text-[#E1384B]" />
                      ) : p.speaking ? (
                        <span className="font-[var(--font-mono)] text-[9px] font-bold text-emerald-400">
                          SPEAKING
                        </span>
                      ) : (
                        <Mic className="h-3.5 w-3.5 text-emerald-400/75" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Voice Mode: Open Mic vs Push-to-Talk */}
            {micEnabled && (
              <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-[#0B0907] p-1 border border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => pushToTalk && togglePushToTalk()}
                  className={`rounded-lg py-1.5 text-[11px] font-bold transition cursor-pointer ${
                    !pushToTalk ? 'bg-[#E6B84C] text-[#0B0907]' : 'text-[#B9A992]'
                  }`}
                >
                  Open Mic
                </button>
                <button
                  type="button"
                  onClick={() => !pushToTalk && togglePushToTalk()}
                  className={`rounded-lg py-1.5 text-[11px] font-bold transition cursor-pointer ${
                    pushToTalk ? 'bg-[#E6B84C] text-[#0B0907]' : 'text-[#B9A992]'
                  }`}
                >
                  Push-to-Talk
                </button>
              </div>
            )}

            {/* Room Voice Volume Slider */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-[#B9A992]">Voice Speaker Volume</span>
                <span className="font-[var(--font-mono)] text-[#1CD696]">
                  {speakerEnabled ? `${Math.round(speakerVolume * 100)}%` : 'MUTED'}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={speakerEnabled ? speakerVolume : 0}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (!speakerEnabled && val > 0) toggleSpeaker();
                  setSpeakerVolume(val);
                }}
                className="w-full accent-[#1CD696] cursor-pointer"
              />
            </div>

            {/* Secondary Controls: Mic Self-Test + Disconnect */}
            {micEnabled && (
              <div className="flex items-center gap-2 pt-1 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={toggleSelfTest}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-bold border transition cursor-pointer ${
                    selfTesting
                      ? 'bg-[#1CD696] border-[#1CD696] text-[#0B0907]'
                      : 'bg-[#120E0B] border-white/10 text-[#DFD2BE] hover:border-[#1CD696]'
                  }`}
                >
                  <Headphones className="h-3.5 w-3.5" />
                  {selfTesting ? 'Stop Test' : 'Test Mic'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    disableMic();
                    setExpanded(false);
                  }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#E1384B]/18 border border-[#E1384B]/45 py-2 text-[11px] font-bold text-[#FF9BA6] hover:bg-[#E1384B] hover:text-white cursor-pointer"
                >
                  <PhoneOff className="h-3.5 w-3.5" />
                  Leave Voice
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Hindi Roasts Popover */}
      <AnimatePresence>
        {showPhrases && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            className="glass-panel w-[calc(100vw-24px)] max-w-[290px] max-h-72 overflow-y-auto rounded-2xl border border-[#E6B84C]/40 p-3 shadow-2xl"
          >
            <p className="mb-2 px-1 font-[var(--font-mono)] text-[10px] font-bold uppercase tracking-widest text-[#1CD696]">
              QUICK VOICE ROASTS 🔥
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              {HINDI_MEME_ROASTS.map((item) => (
                <button
                  key={item.phrase}
                  type="button"
                  onClick={() => {
                    sendVoicePhrase(item.phrase);
                    setShowPhrases(false);
                  }}
                  className="flex items-center justify-between gap-2 rounded-xl bg-[#120E0B]/90 border border-white/[0.07] px-3 py-2 text-left text-xs font-semibold text-[#FAF3E3] transition hover:border-[#E6B84C]/65 cursor-pointer"
                >
                  <span>&ldquo;{item.phrase}&rdquo;</span>
                  <span className="shrink-0 rounded bg-[#E6B84C]/18 px-1.5 py-0.5 font-[var(--font-mono)] text-[8px] font-bold text-[#F6D889]">
                    {item.tag}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* COMPACT MOBILE-FRIENDLY FLOATING VOICE PILL */}
      <div
        className={`glass-panel flex items-center gap-1.5 rounded-2xl px-2.5 py-1.5 shadow-2xl border transition ${
          speaking && micEnabled && !muted
            ? 'border-emerald-400/70 shadow-[0_0_24px_rgba(16,185,129,0.28)]'
            : micEnabled
              ? 'border-[#E6B84C]/55'
              : 'border-[#E6B84C]/25'
        }`}
      >
        {/* Live status dot + mini EQ */}
        <button
          type="button"
          onClick={() => {
            setExpanded((v) => !v);
            setShowPhrases(false);
          }}
          className="flex items-center gap-1.5 rounded-xl px-1.5 py-1 hover:bg-white/[0.05] cursor-pointer"
          title="Open Voice Lounge settings"
        >
          <span className={`h-2 w-2 rounded-full ${statusDot}`} />
          {micEnabled && !muted ? (
            <div className="flex h-3.5 items-end gap-0.5">
              {[0.3, 0.7, 0.5].map((w, i) => (
                <span
                  key={i}
                  style={{
                    height: `${Math.max(3, Math.min(13, Math.round((micLevel / 100) * 14 * (0.5 + w))))}px`,
                  }}
                  className={`w-1 rounded-full transition-all duration-75 ${
                    speaking ? 'bg-emerald-400' : 'bg-[#E6B84C]'
                  }`}
                />
              ))}
            </div>
          ) : (
            <ChevronUp
              className={`h-3.5 w-3.5 text-[#B9A992] transition-transform ${
                expanded ? 'rotate-180' : ''
              }`}
            />
          )}
        </button>

        {/* Primary Mic Action */}
        {!micEnabled ? (
          <button
            type="button"
            disabled={status === 'connecting'}
            onClick={() => enableMic(userId, roomCode)}
            className="gold-btn flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-extrabold transition disabled:opacity-50 cursor-pointer"
          >
            <Mic className="h-3.5 w-3.5" />
            <span>{status === 'connecting' ? 'Joining...' : 'Voice'}</span>
          </button>
        ) : pushToTalk ? (
          <button
            type="button"
            onPointerDown={() => setMuted(false)}
            onPointerUp={() => setMuted(true)}
            onPointerLeave={() => setMuted(true)}
            onPointerCancel={() => setMuted(true)}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold select-none transition cursor-pointer ${
              !muted
                ? 'bg-emerald-400 text-[#0B0907]'
                : 'bg-[#241B13] border border-[#E6B84C]/60 text-[#F6D889]'
            }`}
          >
            <Mic className="h-3.5 w-3.5" />
            <span>{!muted ? 'Live' : 'Hold'}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={toggleMute}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold transition cursor-pointer ${
              muted
                ? 'bg-[#E1384B]/22 border border-[#E1384B]/60 text-[#FF9BA6]'
                : 'bg-emerald-500/20 border border-emerald-400/60 text-emerald-300'
            }`}
          >
            {muted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{muted ? 'Muted' : 'Live'}</span>
          </button>
        )}

        {/* Speaker Toggle */}
        <button
          type="button"
          onClick={toggleSpeaker}
          className={`flex h-8 w-8 items-center justify-center rounded-xl border transition cursor-pointer ${
            speakerEnabled
              ? 'bg-[#18130F] border-white/10 text-[#1CD696] hover:border-[#1CD696]'
              : 'bg-[#E1384B]/18 border-[#E1384B]/45 text-[#FF9BA6]'
          }`}
          title={speakerEnabled ? 'Mute voice speakers' : 'Unmute voice speakers'}
          aria-label="Toggle voice speaker"
        >
          {speakerEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
        </button>

        {/* Quick Voice Roasts Toggle */}
        <button
          type="button"
          onClick={() => {
            setShowPhrases((v) => !v);
            setExpanded(false);
          }}
          className={`flex h-8 w-8 items-center justify-center rounded-xl border transition cursor-pointer ${
            showPhrases
              ? 'bg-[#E6B84C]/22 border-[#E6B84C] text-[#F6D889]'
              : 'bg-[#18130F] border-white/10 text-[#DFD2BE] hover:border-[#E6B84C]/55'
          }`}
          title="Quick voice roasts"
          aria-label="Quick voice roasts"
        >
          <MessageSquareQuote className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
