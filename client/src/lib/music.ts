export interface MusicTrack {
  id: string;
  title: string;
  vibe: string;
  bpm: number;
}

export const MUSIC_TRACKS: MusicTrack[] = [
  { id: 'desi-trap', title: 'Desi Midnight Trap', vibe: 'Dark Phrygian Beat', bpm: 110 },
  { id: 'velvet-lounge', title: 'VIP Velvet Lounge', vibe: 'Poker Chillhop', bpm: 96 },
  { id: 'showdown', title: 'Showdown Tension', vibe: 'High-Stakes Synth', bpm: 124 },
];

// Scale frequencies (Hz)
const N = {
  D2: 73.42, Eb2: 77.78, F2: 87.31, G2: 98.0, A2: 110.0, Bb2: 116.54, C3: 130.81,
  D3: 146.83, Eb3: 155.56, F3: 174.61, Fs3: 185.0, G3: 196.0, A3: 220.0, Bb3: 233.08, C4: 261.63,
  D4: 293.66, Eb4: 311.13, E4: 329.63, F4: 349.23, Fs4: 369.99, G4: 392.0, A4: 440.0, Bb4: 466.16, C5: 523.25, D5: 587.33,
};

class MusicEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private playing = false;
  private trackIndex = 0;
  private volume = 0.35;
  private step = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public getState() {
    return {
      playing: this.playing,
      trackIndex: this.trackIndex,
      track: MUSIC_TRACKS[this.trackIndex],
      volume: this.volume,
    };
  }

  public setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.04);
    }
  }

  public start(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (this.playing) return;
    this.playing = true;
    this.step = 0;
    this.scheduleLoop();
  }

  public stop(): void {
    this.playing = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public toggle(): boolean {
    if (this.playing) this.stop();
    else this.start();
    return this.playing;
  }

  public selectTrack(idx: number): void {
    this.trackIndex = ((idx % MUSIC_TRACKS.length) + MUSIC_TRACKS.length) % MUSIC_TRACKS.length;
    if (this.playing) {
      this.stop();
      this.start();
    }
  }

  public nextTrack(): void {
    this.selectTrack(this.trackIndex + 1);
  }

  private scheduleLoop(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    const track = MUSIC_TRACKS[this.trackIndex];
    // 16th-note step duration in ms
    const stepMs = Math.round((60 / track.bpm / 4) * 1000);
    this.tickStep();
    this.intervalId = setInterval(() => {
      if (!this.playing) return;
      this.tickStep();
    }, stepMs);
  }

  private playKick(time: number, punch = 0.45): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(145, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.13);
    gain.gain.setValueAtTime(punch, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.24);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.26);
  }

  private playSnare(time: number, level = 0.22): void {
    if (!this.ctx || !this.masterGain) return;
    const sampleCount = Math.floor(this.ctx.sampleRate * 0.11);
    const buf = this.ctx.createBuffer(1, sampleCount, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleCount * 0.3));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1100;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(level, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.11);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(time);
  }

  private playHat(time: number, level = 0.08): void {
    if (!this.ctx || !this.masterGain) return;
    const sampleCount = Math.floor(this.ctx.sampleRate * 0.035);
    const buf = this.ctx.createBuffer(1, sampleCount, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleCount * 0.22));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6500;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(level, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.035);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(time);
  }

  private playSynth(
    freq: number,
    time: number,
    dur: number,
    type: OscillatorType,
    level: number,
    cutoff = 1800
  ): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, time);
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(level, time + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + dur + 0.03);
  }

  private tickStep(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime + 0.01;
    const s = this.step % 32;
    const track = MUSIC_TRACKS[this.trackIndex];

    if (track.id === 'desi-trap') {
      // Punchy 808 + Bollywood Phrygian-dominant sitar/pluck hook
      if (s === 0 || s === 6 || s === 10 || s === 16 || s === 22 || s === 28) {
        this.playKick(now, 0.42);
      }
      if (s === 8 || s === 24) this.playSnare(now, 0.22);
      if (s % 2 === 0 || s === 15 || s === 31) this.playHat(now, s % 4 === 0 ? 0.09 : 0.05);

      const bassSeq: Record<number, number> = {
        0: N.D2, 6: N.D2, 10: N.Eb2, 16: N.D2, 22: N.G2, 26: N.F2, 28: N.Eb2,
      };
      if (bassSeq[s]) this.playSynth(bassSeq[s], now, 0.36, 'triangle', 0.32, 420);

      // Desi Bhairav/Phrygian melodic pluck hook
      const melody: Record<number, number> = {
        0: N.D4, 2: N.Fs4, 4: N.G4, 6: N.A4, 8: N.G4, 10: N.Fs4, 12: N.Eb4, 14: N.D4,
        16: N.D4, 18: N.Fs4, 20: N.G4, 22: N.Bb4, 24: N.A4, 26: N.G4, 28: N.Fs4, 30: N.Eb4,
      };
      if (melody[s]) this.playSynth(melody[s], now, 0.22, 'sawtooth', 0.09, 2200);
    } else if (track.id === 'velvet-lounge') {
      // Smooth late-night casino lounge chillhop
      if (s === 0 || s === 10 || s === 16 || s === 26) this.playKick(now, 0.34);
      if (s === 8 || s === 24) this.playSnare(now, 0.14);
      if (s % 4 === 2) this.playHat(now, 0.055);

      if (s === 0) {
        [N.D3, N.F3, N.A3, N.C4].forEach((f) => this.playSynth(f, now, 1.4, 'sine', 0.075, 1200));
      } else if (s === 16) {
        [N.G3, N.Bb3, N.D4, N.F4].forEach((f) => this.playSynth(f, now, 1.4, 'sine', 0.075, 1200));
      }
      const bass: Record<number, number> = { 0: N.D2, 10: N.A2, 16: N.G2, 26: N.F2 };
      if (bass[s]) this.playSynth(bass[s], now, 0.55, 'triangle', 0.26, 350);

      const lead: Record<number, number> = { 4: N.A4, 12: N.G4, 14: N.F4, 20: N.D5, 28: N.C5 };
      if (lead[s]) this.playSynth(lead[s], now, 0.35, 'triangle', 0.08, 1600);
    } else {
      // Showdown Tension — driving competitive synth arp
      if (s % 4 === 0) this.playKick(now, 0.38);
      if (s % 8 === 4) this.playSnare(now, 0.18);
      if (s % 2 === 1) this.playHat(now, 0.07);

      const arp = [N.D3, N.F3, N.A3, N.D4, N.C4, N.A3, N.G3, N.F3];
      this.playSynth(arp[s % arp.length], now, 0.14, 'sawtooth', 0.075, 1900);
      if (s % 8 === 0) {
        const root = s < 16 ? N.D2 : N.Bb2;
        this.playSynth(root, now, 0.48, 'sawtooth', 0.18, 360);
      }
    }

    this.step += 1;
  }
}

export const musicEngine = new MusicEngine();
