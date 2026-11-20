type SoundKey =
  | 'cardSelect'
  | 'cardPlay'
  | 'cardDeal'
  | 'shuffle'
  | 'playerJoin'
  | 'turnAlert'
  | 'challenge'
  | 'bluffCaught'
  | 'truthConfirmed'
  | 'voicePhrase'
  | 'voiceJoin'
  | 'voiceLeave'
  | 'voiceMute'
  | 'win'
  | 'loss'
  | 'click';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private volume = 0.55;

  public configure(enabled: boolean, volume: number): void {
    this.enabled = enabled;
    this.volume = Math.max(0, Math.min(1, volume));
  }

  private ensureContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    gainPeak = 0.16,
    delay = 0,
    endFreq?: number
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }

    const peak = Math.max(0.001, gainPeak * this.volume);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  private playNoiseSnap(duration = 0.045, delay = 0, gainPeak = 0.12, filterFreq = 2200): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleCount * 0.35));
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = 1.4;

    const gain = ctx.createGain();
    const now = ctx.currentTime + delay;
    gain.gain.setValueAtTime(Math.max(0.001, gainPeak * this.volume), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
  }

  public play(sound: SoundKey): void {
    if (!this.enabled) return;
    switch (sound) {
      case 'cardSelect':
        this.playTone(620, 0.06, 'triangle', 0.12, 0, 860);
        break;
      case 'cardPlay':
        this.playNoiseSnap(0.06, 0, 0.14, 1600);
        this.playTone(260, 0.09, 'triangle', 0.18, 0, 140);
        break;
      case 'cardDeal':
        this.playNoiseSnap(0.04, 0, 0.15, 2800);
        this.playTone(420, 0.045, 'triangle', 0.08, 0, 290);
        break;
      case 'shuffle':
        for (let i = 0; i < 8; i++) {
          this.playNoiseSnap(0.035, i * 0.055, 0.12, 1800 + i * 160);
        }
        break;
      case 'voicePhrase':
        this.playTone(540, 0.07, 'sine', 0.1, 0, 720);
        break;
      case 'voiceJoin':
        this.playTone(480, 0.08, 'sine', 0.11, 0);
        this.playTone(720, 0.12, 'sine', 0.12, 0.07);
        break;
      case 'voiceLeave':
        this.playTone(520, 0.08, 'sine', 0.1, 0);
        this.playTone(340, 0.12, 'sine', 0.1, 0.07);
        break;
      case 'voiceMute':
        this.playTone(390, 0.06, 'triangle', 0.09, 0, 310);
        break;
      case 'playerJoin':
        this.playTone(440, 0.12, 'sine', 0.12, 0);
        this.playTone(660, 0.18, 'sine', 0.14, 0.09);
        break;
      case 'turnAlert':
        this.playTone(523.25, 0.11, 'sine', 0.13, 0);
        this.playTone(783.99, 0.16, 'triangle', 0.14, 0.1);
        break;
      case 'challenge':
        this.playTone(190, 0.34, 'sawtooth', 0.16, 0, 110);
        this.playTone(380, 0.28, 'triangle', 0.18, 0.04, 240);
        break;
      case 'bluffCaught':
        this.playTone(330, 0.14, 'sawtooth', 0.14, 0);
        this.playTone(233, 0.26, 'sawtooth', 0.16, 0.12, 175);
        break;
      case 'truthConfirmed':
        this.playTone(523.25, 0.12, 'triangle', 0.15, 0);
        this.playTone(659.25, 0.14, 'triangle', 0.15, 0.09);
        this.playTone(783.99, 0.22, 'sine', 0.16, 0.18);
        break;
      case 'win':
        this.playTone(523.25, 0.14, 'triangle', 0.16, 0);
        this.playTone(659.25, 0.14, 'triangle', 0.16, 0.11);
        this.playTone(783.99, 0.16, 'triangle', 0.18, 0.22);
        this.playTone(1046.5, 0.38, 'sine', 0.2, 0.34);
        break;
      case 'loss':
        this.playTone(392, 0.18, 'triangle', 0.14, 0);
        this.playTone(349.23, 0.18, 'triangle', 0.14, 0.16);
        this.playTone(293.66, 0.32, 'sine', 0.15, 0.32);
        break;
      case 'click':
        this.playTone(480, 0.04, 'sine', 0.08, 0, 380);
        break;
    }
  }
}

export const soundEngine = new SoundEngine();
