import { create } from 'zustand';
import { MUSIC_TRACKS, musicEngine, type MusicTrack } from '../lib/music';

interface MusicStoreState {
  playing: boolean;
  trackIndex: number;
  track: MusicTrack;
  volume: number;
  toggle: () => void;
  start: () => void;
  stop: () => void;
  nextTrack: () => void;
  selectTrack: (idx: number) => void;
  setVolume: (v: number) => void;
}

export const useMusicStore = create<MusicStoreState>((set) => ({
  playing: false,
  trackIndex: 0,
  track: MUSIC_TRACKS[0],
  volume: 0.35,

  toggle: () => {
    const playing = musicEngine.toggle();
    set({ playing });
  },
  start: () => {
    musicEngine.start();
    set({ playing: true });
  },
  stop: () => {
    musicEngine.stop();
    set({ playing: false });
  },
  nextTrack: () => {
    musicEngine.nextTrack();
    const st = musicEngine.getState();
    set({ trackIndex: st.trackIndex, track: st.track, playing: st.playing });
  },
  selectTrack: (idx) => {
    musicEngine.selectTrack(idx);
    const st = musicEngine.getState();
    set({ trackIndex: st.trackIndex, track: st.track, playing: st.playing });
  },
  setVolume: (v) => {
    musicEngine.setVolume(v);
    set({ volume: v });
  },
}));
