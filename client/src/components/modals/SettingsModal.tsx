import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Disc3,
  LogOut,
  Music2,
  Pause,
  Play,
  Sparkles,
  UserCheck,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useGameStore } from '../../store/useGameStore';
import { useMusicStore } from '../../store/useMusicStore';
import { MUSIC_TRACKS } from '../../lib/music';
import { soundEngine } from '../../lib/sound';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ open, onClose }) => {
  const { soundEnabled, volume, reducedMotion, setSoundEnabled, setVolume, setReducedMotion } =
    useSettingsStore();
  const {
    playing: musicPlaying,
    trackIndex,
    volume: musicVolume,
    toggle: toggleMusic,
    selectTrack,
    setVolume: setMusicVolume,
  } = useMusicStore();
  const { user, setModal, logoutAndReGuest } = useGameStore();

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
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            className="relative z-10 w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl bg-[#18130F] border border-white/10 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
              <h2 className="font-[var(--font-display)] text-lg font-bold text-[#FAF3E3]">
                Settings, Music & Audio
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-[#B9A992] hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 p-6">
              {/* Background Song Player */}
              <div className="rounded-xl bg-[#120E0B] border border-[#E6B84C]/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {musicPlaying ? (
                      <Disc3 className="h-5 w-5 animate-spin text-[#1CD696]" />
                    ) : (
                      <Music2 className="h-5 w-5 text-[#E6B84C]" />
                    )}
                    <div>
                      <p className="text-sm font-semibold text-[#FAF3E3]">Background Song</p>
                      <p className="text-[11px] text-[#B9A992]">Play lounge & trap beats while bluffing</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={toggleMusic}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                      musicPlaying
                        ? 'bg-[#1CD696] text-[#0B0907]'
                        : 'bg-[#E6B84C] text-[#0B0907]'
                    }`}
                  >
                    {musicPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    {musicPlaying ? 'Pause' : 'Play'}
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-1.5">
                  {MUSIC_TRACKS.map((t, idx) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => selectTrack(idx)}
                      className={`flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition cursor-pointer ${
                        trackIndex === idx
                          ? 'bg-[#E6B84C]/20 border border-[#E6B84C]/60 text-[#FAF3E3]'
                          : 'bg-[#18130F] border border-white/[0.06] text-[#B9A992] hover:text-white'
                      }`}
                    >
                      <span className="font-semibold">{t.title}</span>
                      <span className="font-[var(--font-mono)] text-[10px] text-[#1CD696]">
                        {t.vibe}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#B9A992]">Song Volume</span>
                    <span className="font-[var(--font-mono)] text-[#1CD696]">
                      {Math.round(musicVolume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={0.8}
                    step={0.05}
                    value={musicVolume}
                    onChange={(e) => setMusicVolume(Number(e.target.value))}
                    className="w-full accent-[#1CD696] cursor-pointer"
                  />
                </div>
              </div>

              {/* Sound FX Toggle */}
              <div className="flex items-center justify-between rounded-xl bg-[#120E0B] border border-white/[0.07] p-4">
                <div className="flex items-center gap-3">
                  {soundEnabled ? (
                    <Volume2 className="h-5 w-5 text-[#1CD696]" />
                  ) : (
                    <VolumeX className="h-5 w-5 text-[#E1384B]" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-[#FAF3E3]">Sound Effects</p>
                    <p className="text-xs text-[#B9A992]">Cards, shuffle, challenges & fanfare</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = !soundEnabled;
                    setSoundEnabled(next);
                    if (next) soundEngine.play('cardSelect');
                  }}
                  className={`h-6 w-11 rounded-full p-0.5 transition cursor-pointer ${
                    soundEnabled ? 'bg-[#1CD696]' : 'bg-white/15'
                  }`}
                >
                  <div
                    className={`h-5 w-5 rounded-full bg-[#0B0907] transition-transform ${
                      soundEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* SFX Volume */}
              <div className="space-y-2 px-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#B9A992]">SFX Volume</span>
                  <span className="font-[var(--font-mono)] text-[#1CD696]">
                    {Math.round(volume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  disabled={!soundEnabled}
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  onMouseUp={() => soundEngine.play('cardSelect')}
                  className="w-full accent-[#E6B84C] cursor-pointer disabled:opacity-40"
                />
              </div>

              {/* Reduced Motion */}
              <div className="flex items-center justify-between rounded-xl bg-[#120E0B] border border-white/[0.07] p-4">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-[#E6B84C]" />
                  <div>
                    <p className="text-sm font-semibold text-[#FAF3E3]">Reduced Motion</p>
                    <p className="text-xs text-[#B9A992]">Minimize card flight & particle motion</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReducedMotion(!reducedMotion)}
                  className={`h-6 w-11 rounded-full p-0.5 transition cursor-pointer ${
                    reducedMotion ? 'bg-[#E6B84C]' : 'bg-white/15'
                  }`}
                >
                  <div
                    className={`h-5 w-5 rounded-full bg-[#0B0907] transition-transform ${
                      reducedMotion ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Account section */}
              {user && (
                <div className="border-t border-white/[0.07] pt-4 space-y-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#B9A992]">
                    Account ({user.isGuest ? 'Guest Session' : user.email})
                  </p>
                  <div className="flex gap-2">
                    {user.isGuest ? (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          setModal('auth', true);
                        }}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#E6B84C] py-2.5 text-xs font-bold uppercase tracking-wider text-[#0B0907] hover:bg-[#F3CF7A] cursor-pointer"
                      >
                        <UserCheck className="h-4 w-4" />
                        Sign In / Save Account
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          logoutAndReGuest();
                        }}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#E1384B]/15 border border-[#E1384B]/35 py-2.5 text-xs font-semibold text-[#FF9BA6] hover:bg-[#E1384B]/25 cursor-pointer"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
