import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Headphones,
  MessageSquareQuote,
  Mic,
  MicOff,
  PhoneOff,
  Radio,
  RefreshCw,
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
    speakerEnabled,
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
    toggleSpeaker,
    toggleSelfTest,
    unlockAudio,
    clearError,
  } = useVoiceStore();

  const { sendVoicePhrase } = useGameStore();
  const [showPhrases, setShowPhrases] = useState(false);

  const activeSpeakersCount = peers.filter((p) => p.micEnabled).length;
  const speakingPeers = peers.filter((p) => p.speaking && p.userId !== userId);

  const statusMeta =
    status === 'connected'
      ? {
          label: muted
            ? 'MUTED'
            : speaking
              ? 'SPEAKING'
              : transportMode === 'p2p'
                ? `LIVE P2P · ${connectedAudioPeers}P`
                : 'VOICE LIVE',
          dot: muted ? 'bg-amber-400' : speaking ? 'bg-emerald-400 animate-ping' : 'bg-emerald-400',
          text: muted ? 'text-amber-300' : 'text-emerald-300',
        }
      : status === 'listening'
        ? {
            label:
              transportMode === 'p2p'
                ? `LISTENING P2P`
                : connectedAudioPeers > 0
                  ? `LISTENING LIVE`
                  : 'LISTENING',
            dot: 'bg-[#1CD696]',
            text: 'text-[#1CD696]',
          }
        : status === 'connecting'
          ? { label: 'CONNECTING', dot: 'bg-[#1CD696] animate-pulse', text: 'text-[#1CD696]' }
          : status === 'reconnecting'
            ? { label: 'RECONNECTING', dot: 'bg-amber-400 animate-pulse', text: 'text-amber-300' }
            : status === 'error'
              ? { label: 'MIC BLOCKED', dot: 'bg-[#E1384B]', text: 'text-[#FF9BA6]' }
              : { label: 'MIC OFF', dot: 'bg-[#646D8A]', text: 'text-[#B9A992]' };

  return (
    <div className="fixed bottom-4 right-4 z-30 flex flex-col items-end gap-2">
      {/* Browser Autoplay Blocked Unmute Prompt */}
      <AnimatePresence>
        {autoplayBlocked && speakerEnabled && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            onClick={unlockAudio}
            className="glass-panel flex items-center gap-2 rounded-xl border border-[#1CD696]/60 bg-[#0E1E28]/95 px-3.5 py-2 text-xs font-bold text-[#1CD696] shadow-xl hover:bg-[#1CD696] hover:text-[#0B0907] cursor-pointer"
          >
            <Volume2 className="h-4 w-4 animate-pulse" />
            Click to Hear Room Voice Audio
          </motion.button>
        )}
      </AnimatePresence>

      {/* Permission / Connection Error Banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            className="glass-panel w-72 rounded-2xl border border-[#E1384B]/50 p-3.5 shadow-2xl"
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

      {/* Hindi Meme & Quick Voice Reactions Tray */}
      <AnimatePresence>
        {showPhrases && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            className="glass-panel w-72 max-h-80 overflow-y-auto rounded-2xl border border-[#E6B84C]/40 p-3 shadow-2xl"
          >
            <p className="mb-2 px-1 font-[var(--font-mono)] text-[10px] font-bold uppercase tracking-widest text-[#1CD696]">
              HINDI MEMES & DESI ROASTS 🔥
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
                  className="flex items-center justify-between gap-2 rounded-xl bg-[#120E0B]/90 border border-white/[0.07] px-3 py-2 text-left text-xs font-semibold text-[#FAF3E3] transition hover:border-[#E6B84C]/60 hover:bg-[#241B13] cursor-pointer"
                >
                  <span>&ldquo;{item.phrase}&rdquo;</span>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 font-[var(--font-mono)] text-[8px] font-bold ${
                      item.tone === 'roast'
                        ? 'bg-[#E1384B]/20 text-[#FF9BA6]'
                        : item.tone === 'hype'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-[#1CD696]/15 text-[#1CD696]'
                    }`}
                  >
                    {item.tag}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Compact Floating Voice Bar */}
      <div
        className={`glass-panel flex items-center gap-2 rounded-2xl px-3 py-2 shadow-2xl border transition ${
          speaking && micEnabled && !muted
            ? 'border-emerald-400/60 shadow-[0_0_24px_rgba(16,185,129,0.22)]'
            : micEnabled
              ? 'border-[#E6B84C]/45'
              : 'border-white/10'
        }`}
      >
        {/* Status + Live Activity Meter */}
        <div className="hidden sm:flex flex-col pr-1">
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${statusMeta.dot}`} />
            <span className={`font-[var(--font-mono)] text-[9px] font-bold tracking-wider ${statusMeta.text}`}>
              {statusMeta.label}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            {micEnabled ? (
              <div className="flex h-3 items-end gap-0.5" aria-label="Microphone activity">
                {[0.25, 0.45, 0.7, 0.55, 0.35].map((weight, i) => {
                  const h = muted
                    ? 2
                    : Math.max(2, Math.min(12, Math.round((micLevel / 100) * 14 * (0.6 + weight))));
                  return (
                    <span
                      key={i}
                      style={{ height: `${h}px` }}
                      className={`w-1 rounded-full transition-all duration-75 ${
                        muted
                          ? 'bg-[#565E78]'
                          : speaking
                            ? 'bg-emerald-400'
                            : 'bg-[#1CD696]/70'
                      }`}
                    />
                  );
                })}
              </div>
            ) : (
              <span className="flex items-center gap-1 font-[var(--font-mono)] text-[9px] text-[#B9A992]">
                <Radio
                  className={`h-2.5 w-2.5 ${
                    receivingAudio ? 'text-emerald-400 animate-ping' : 'text-[#1CD696]'
                  }`}
                />
                {receivingAudio
                  ? 'HEARING AUDIO'
                  : speakingPeers.length > 0
                    ? `${speakingPeers[0].username} speaking`
                    : `${activeSpeakersCount} in voice`}
              </span>
            )}
          </div>
        </div>

        {/* Enable / Disable Mic OR Mute/Unmute + Test Mic + Disconnect */}
        {!micEnabled ? (
          <button
            type="button"
            disabled={status === 'connecting'}
            onClick={() => enableMic(userId, roomCode)}
            className="flex items-center gap-1.5 rounded-xl bg-[#E6B84C] px-3 py-2 text-[11px] font-bold text-[#0B0907] transition hover:bg-[#F3CF7A] disabled:opacity-50 cursor-pointer"
            title="Enable optional microphone voice chat"
          >
            <Mic className="h-3.5 w-3.5" />
            <span>{status === 'connecting' ? 'Joining...' : 'Enable Mic'}</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={toggleMute}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold transition cursor-pointer ${
                muted
                  ? 'bg-[#E1384B]/20 border border-[#E1384B]/55 text-[#FF9BA6]'
                  : 'bg-emerald-500/20 border border-emerald-400/55 text-emerald-300'
              }`}
              title={muted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {muted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              <span>{muted ? 'Unmute' : 'Mute'}</span>
            </button>

            <button
              type="button"
              onClick={toggleSelfTest}
              className={`flex h-8 w-8 items-center justify-center rounded-xl border transition cursor-pointer ${
                selfTesting
                  ? 'bg-[#1CD696] border-[#1CD696] text-[#0B0907]'
                  : 'bg-[#18130F] border-white/10 text-[#B9A992] hover:border-[#1CD696]/50 hover:text-white'
              }`}
              title={selfTesting ? 'Stop mic self-test' : 'Test Mic (Hear yourself)'}
              aria-label="Test microphone audio"
            >
              <Headphones className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={disableMic}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#E1384B]/15 border border-[#E1384B]/35 text-[#FF9BA6] transition hover:bg-[#E1384B] hover:text-[#0B0907] cursor-pointer"
              title="Disconnect microphone completely"
              aria-label="Disconnect microphone"
            >
              <PhoneOff className="h-3.5 w-3.5" />
            </button>
          </>
        )}

        {/* Speaker On / Off Toggle */}
        <button
          type="button"
          onClick={toggleSpeaker}
          className={`flex h-8 w-8 items-center justify-center rounded-xl border transition cursor-pointer ${
            speakerEnabled
              ? 'bg-[#18130F] border-white/10 text-[#1CD696] hover:border-[#1CD696]/50'
              : 'bg-[#E1384B]/15 border-[#E1384B]/40 text-[#FF9BA6]'
          }`}
          title={
            speakerEnabled
              ? 'Mute room voice audio (Speaker Off)'
              : 'Enable room voice audio (Speaker On)'
          }
          aria-label="Toggle voice speaker"
        >
          {speakerEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
        </button>

        {/* Quick Voice Reactions Button */}
        <button
          type="button"
          onClick={() => setShowPhrases((v) => !v)}
          className={`flex h-8 w-8 items-center justify-center rounded-xl border transition cursor-pointer ${
            showPhrases
              ? 'bg-[#E6B84C]/20 border-[#E6B84C] text-[#FAF3E3]'
              : 'bg-[#18130F] border-white/10 text-[#DFD2BE] hover:border-[#E6B84C]/50'
          }`}
          title="Hindi memes & quick voice callouts"
          aria-label="Quick voice reactions"
        >
          <MessageSquareQuote className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
