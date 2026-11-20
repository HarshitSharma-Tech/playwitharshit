import { create } from 'zustand';
import { soundEngine } from '../lib/sound';

const SETTINGS_KEY = 'bluffed_ui_settings';

interface SettingsState {
  soundEnabled: boolean;
  volume: number;
  reducedMotion: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  toggleSound: () => void;
  setVolume: (volume: number) => void;
  setReducedMotion: (reduced: boolean) => void;
}

function loadInitialSettings() {
  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        soundEnabled: parsed.soundEnabled ?? true,
        volume: typeof parsed.volume === 'number' ? parsed.volume : 0.55,
        reducedMotion: parsed.reducedMotion ?? prefersReduced ?? false,
      };
    }
  } catch {
    // ignore
  }
  return {
    soundEnabled: true,
    volume: 0.55,
    reducedMotion: prefersReduced ?? false,
  };
}

const initial = loadInitialSettings();
soundEngine.configure(initial.soundEnabled, initial.volume);

function persist(state: { soundEnabled: boolean; volume: number; reducedMotion: boolean }) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...initial,
  setSoundEnabled: (soundEnabled) => {
    const { volume, reducedMotion } = get();
    soundEngine.configure(soundEnabled, volume);
    persist({ soundEnabled, volume, reducedMotion });
    set({ soundEnabled });
  },
  toggleSound: () => {
    const next = !get().soundEnabled;
    get().setSoundEnabled(next);
  },
  setVolume: (volume) => {
    const clamped = Math.max(0, Math.min(1, volume));
    const { soundEnabled, reducedMotion } = get();
    soundEngine.configure(soundEnabled, clamped);
    persist({ soundEnabled, volume: clamped, reducedMotion });
    set({ volume: clamped });
  },
  setReducedMotion: (reducedMotion) => {
    const { soundEnabled, volume } = get();
    persist({ soundEnabled, volume, reducedMotion });
    set({ reducedMotion });
  },
}));
