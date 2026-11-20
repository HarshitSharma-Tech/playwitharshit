import type { Socket } from 'socket.io-client';
import type { VoicePeerState, VoiceTokenPayload } from '@shared/types';
import { emitAck, getSocket } from './socket';

type VoiceStatus = 'idle' | 'listening' | 'connecting' | 'connected' | 'reconnecting' | 'error';
export type VoiceTransportMode = 'none' | 'p2p' | 'relay';

export interface VoiceCallbacks {
  onStatus: (status: VoiceStatus) => void;
  onError: (message: string | null) => void;
  onMicLevel: (level: number, speaking: boolean) => void;
  onMicState: (micEnabled: boolean, muted: boolean) => void;
  onConnectedPeers: (count: number) => void;
  onTransportMode: (mode: VoiceTransportMode) => void;
  onAutoplayBlocked: (blocked: boolean) => void;
  onReceivingAudio: (receiving: boolean) => void;
}

interface PeerEntry {
  pc: RTCPeerConnection;
  makingOffer: boolean;
  ignoreOffer: boolean;
  polite: boolean;
  hasLiveRemoteAudio: boolean;
}

const TARGET_SAMPLE_RATE = 16000;

function downsampleToInt16(input: Float32Array, inputRate: number): Int16Array {
  if (inputRate <= TARGET_SAMPLE_RATE) {
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  }
  const ratio = inputRate / TARGET_SAMPLE_RATE;
  const outLength = Math.floor(input.length / ratio);
  const out = new Int16Array(outLength);
  let offset = 0;
  for (let i = 0; i < outLength; i++) {
    const nextOffset = Math.min(input.length, Math.round((i + 1) * ratio));
    let sum = 0;
    let count = 0;
    for (let j = offset; j < nextOffset; j++) {
      sum += input[j];
      count++;
    }
    const avg = count > 0 ? sum / count : 0;
    const clamped = Math.max(-1, Math.min(1, avg));
    out[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    offset = nextOffset;
  }
  return out;
}

class VoiceManager {
  private localStream: MediaStream | null = null;
  private peers = new Map<string, PeerEntry>();
  private pendingCandidates = new Map<string, RTCIceCandidateInit[]>();
  private remoteAudios = new Map<string, HTMLAudioElement>();
  private audioContainer: HTMLDivElement | null = null;
  private selfTestAudio: HTMLAudioElement | null = null;

  // Strongly held AudioContext nodes so Chrome never garbage-collects ScriptProcessor
  private captureCtx: AudioContext | null = null;
  private captureSource: MediaStreamAudioSourceNode | null = null;
  private captureProcessor: ScriptProcessorNode | null = null;
  private captureSilentGain: GainNode | null = null;

  private playbackCtx: AudioContext | null = null;
  private playbackGain: GainNode | null = null;
  private nextPlayTimeByPeer = new Map<string, number>();
  private relayActivePeers = new Set<string>();
  private relayLastHeardByPeer = new Map<string, number>();
  private receivingTimer: ReturnType<typeof setTimeout> | null = null;

  private voiceToken: string | null = null;
  private iceServers: RTCIceServer[] = [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun.cloudflare.com:3478',
      ],
    },
  ];
  private myUserId: string | null = null;
  private activeRoomCode: string | null = null;
  private speakerEnabled = true;
  private micEnabled = false;
  private muted = false;
  private listeningJoined = false;

  private analyser: AnalyserNode | null = null;
  private levelRafId: number | null = null;
  private lastSpeaking = false;
  private speakingHoldUntil = 0;
  private boundSocket: Socket | null = null;
  private gestureUnlockBound = false;

  private cb: VoiceCallbacks = {
    onStatus: () => {},
    onError: () => {},
    onMicLevel: () => {},
    onMicState: () => {},
    onConnectedPeers: () => {},
    onTransportMode: () => {},
    onAutoplayBlocked: () => {},
    onReceivingAudio: () => {},
  };

  public setCallbacks(cb: VoiceCallbacks): void {
    this.cb = cb;
  }

  private bindGlobalGestureUnlock(): void {
    if (this.gestureUnlockBound || typeof window === 'undefined') return;
    this.gestureUnlockBound = true;
    const unlock = () => {
      if (this.speakerEnabled) {
        this.unlockRemoteAudioPlayback();
      }
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
  }

  private ensureAudioContainer(): HTMLDivElement {
    if (!this.audioContainer) {
      const div = document.createElement('div');
      div.id = 'bluffed-voice-audio-root';
      div.style.display = 'none';
      document.body.appendChild(div);
      this.audioContainer = div;
    }
    return this.audioContainer;
  }

  private ensurePlaybackContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.playbackCtx || this.playbackCtx.state === 'closed') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.playbackCtx = new AudioCtx();
      this.playbackGain = this.playbackCtx.createGain();
      this.playbackGain.gain.value = this.speakerEnabled ? 1.15 : 0.0;
      this.playbackGain.connect(this.playbackCtx.destination);
    }
    return this.playbackCtx;
  }

  /**
   * Only consider WebRTC P2P fully carrying audio if the peer connection is connected
   * AND we have actually received a live remote audio track (or sent ours cleanly).
   */
  private isPeerPlayingOverWebRTC(userId: string): boolean {
    const entry = this.peers.get(userId);
    if (!entry) return false;
    const connected =
      entry.pc.connectionState === 'connected' ||
      entry.pc.iceConnectionState === 'connected' ||
      entry.pc.iceConnectionState === 'completed';
    return connected && entry.hasLiveRemoteAudio;
  }

  private getConfirmedP2PPeerIds(): string[] {
    const ids: string[] = [];
    for (const [uid] of this.peers.entries()) {
      if (this.isPeerPlayingOverWebRTC(uid)) {
        ids.push(uid);
      }
    }
    return ids;
  }

  private pulseReceivingAudio(): void {
    this.cb.onReceivingAudio(true);
    if (this.receivingTimer) clearTimeout(this.receivingTimer);
    this.receivingTimer = setTimeout(() => {
      this.cb.onReceivingAudio(false);
    }, 600);
  }

  private refreshTransportState(): void {
    const p2pIds = this.getConfirmedP2PPeerIds();
    const now = Date.now();
    for (const [uid, ts] of this.relayLastHeardByPeer.entries()) {
      if (now - ts > 8000) {
        this.relayLastHeardByPeer.delete(uid);
        this.relayActivePeers.delete(uid);
      }
    }
    const combined = new Set<string>([...p2pIds, ...this.relayActivePeers]);
    this.cb.onConnectedPeers(combined.size);

    if (p2pIds.length > 0) {
      this.cb.onTransportMode('p2p');
    } else if (this.relayActivePeers.size > 0 || this.micEnabled) {
      this.cb.onTransportMode('relay');
    } else {
      this.cb.onTransportMode('none');
    }
  }

  /**
   * Call immediately when entering ANY room so this client is ready to receive
   * relayed voice audio immediately without ever requesting microphone permission.
   */
  public prepareRoomListener(userId: string, roomCode: string): void {
    this.myUserId = userId;
    this.activeRoomCode = roomCode;
    this.bindSocketListeners();
    this.bindGlobalGestureUnlock();
  }

  public bindSocketListeners(): void {
    const socket = getSocket();
    if (!socket || this.boundSocket === socket) return;

    this.unbindSocketListeners();
    this.boundSocket = socket;
    this.bindGlobalGestureUnlock();

    socket.on('voice:peer_joined', async (payload: { roomCode: string; peer: VoicePeerState }) => {
      if (!this.voiceToken || payload.roomCode !== this.activeRoomCode) return;
      if (payload.peer.userId === this.myUserId) return;
      // Only initiate WebRTC offer if we have our mic ON or we are the designated offerer
      const entry = this.getOrCreatePeer(payload.peer.userId);
      if (!entry.polite && entry.pc.signalingState === 'stable') {
        await this.negotiatePeer(payload.peer.userId, entry);
      }
    });

    socket.on(
      'voice:signal',
      async (payload: {
        roomCode: string;
        fromUserId: string;
        signalType: 'offer' | 'answer' | 'ice-candidate';
        data: unknown;
      }) => {
        if (!this.voiceToken || payload.roomCode !== this.activeRoomCode) return;
        await this.handleIncomingSignal(payload.fromUserId, payload.signalType, payload.data);
      }
    );

    // Server-relayed audio fallback: guaranteed audio delivery across all 4G/5G/NATs!
    socket.on(
      'voice:relay_audio',
      (payload: {
        roomCode: string;
        fromUserId: string;
        sampleRate: number;
        pcm: ArrayBuffer | Uint8Array;
      }) => {
        if (!this.speakerEnabled) return;
        if (payload.fromUserId === this.myUserId) return;
        if (this.activeRoomCode && payload.roomCode !== this.activeRoomCode) return;

        // Only skip relay if we have ALREADY confirmed a live playing WebRTC audio track from this exact sender!
        if (this.isPeerPlayingOverWebRTC(payload.fromUserId)) {
          return;
        }

        this.playRelayedChunk(
          payload.fromUserId,
          payload.sampleRate || TARGET_SAMPLE_RATE,
          payload.pcm
        );
      }
    );

    socket.on('voice:peer_left', (payload: { roomCode: string; userId: string }) => {
      if (payload.roomCode !== this.activeRoomCode) return;
      this.closePeer(payload.userId);
    });

    socket.on('disconnect', () => {
      if (this.micEnabled || this.listeningJoined) {
        this.cb.onStatus('reconnecting');
      }
    });

    socket.on('connect', () => {
      if ((this.micEnabled || this.listeningJoined) && this.activeRoomCode && this.myUserId) {
        this.rejoinVoiceAfterReconnect().catch(() => {
          if (this.micEnabled) {
            this.cb.onStatus('error');
            this.cb.onError('Voice connection dropped. Click Enable Mic to reconnect.');
          }
        });
      }
    });
  }

  public unbindSocketListeners(): void {
    if (this.boundSocket) {
      this.boundSocket.off('voice:peer_joined');
      this.boundSocket.off('voice:signal');
      this.boundSocket.off('voice:relay_audio');
      this.boundSocket.off('voice:peer_left');
      this.boundSocket = null;
    }
  }

  private playRelayedChunk(
    fromUserId: string,
    sampleRate: number,
    rawPcm: ArrayBuffer | Uint8Array
  ): void {
    const ctx = this.ensurePlaybackContext();
    if (!ctx || !this.playbackGain) return;

    if (ctx.state === 'suspended') {
      ctx
        .resume()
        .then(() => {
          this.cb.onAutoplayBlocked(false);
        })
        .catch(() => {
          this.cb.onAutoplayBlocked(true);
        });
      // If still suspended right this millisecond, prompt user to tap once
      if (ctx.state === 'suspended') {
        this.cb.onAutoplayBlocked(true);
        return;
      }
    }
    this.cb.onAutoplayBlocked(false);

    let int16: Int16Array;
    if (rawPcm instanceof ArrayBuffer) {
      int16 = new Int16Array(rawPcm);
    } else if (ArrayBuffer.isView(rawPcm)) {
      int16 = new Int16Array(rawPcm.buffer, rawPcm.byteOffset, Math.floor(rawPcm.byteLength / 2));
    } else {
      return;
    }
    if (int16.length === 0) return;

    const audioBuffer = ctx.createBuffer(1, int16.length, sampleRate);
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < int16.length; i++) {
      channelData[i] = int16[i] / 32768;
    }

    const src = ctx.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(this.playbackGain);

    const now = ctx.currentTime;
    let startAt = this.nextPlayTimeByPeer.get(fromUserId) ?? now + 0.04;
    if (startAt < now + 0.008) {
      startAt = now + 0.03;
    } else if (startAt > now + 0.35) {
      startAt = now + 0.05;
    }

    src.start(startAt);
    this.nextPlayTimeByPeer.set(fromUserId, startAt + audioBuffer.duration);

    this.pulseReceivingAudio();
    const wasTracked = this.relayActivePeers.has(fromUserId);
    this.relayActivePeers.add(fromUserId);
    this.relayLastHeardByPeer.set(fromUserId, Date.now());
    if (!wasTracked) {
      this.refreshTransportState();
    }
  }

  /**
   * Joins the room's isolated voice channel in LISTEN-ONLY mode (NEVER asks for mic permission!)
   */
  public async ensureListening(userId: string, roomCode: string): Promise<void> {
    if (!this.speakerEnabled) return;
    this.myUserId = userId;
    this.activeRoomCode = roomCode;
    this.bindSocketListeners();
    this.ensurePlaybackContext();

    if ((this.micEnabled || this.listeningJoined) && this.activeRoomCode === roomCode) return;

    try {
      const tokenRes = await emitAck<{
        ok: boolean;
        payload?: VoiceTokenPayload;
        error?: string;
      }>('voice:get_token');
      if (!tokenRes.ok || !tokenRes.payload) return;

      this.voiceToken = tokenRes.payload.token;
      this.iceServers = tokenRes.payload.iceServers;

      const joinRes = await emitAck<{
        ok: boolean;
        peers?: VoicePeerState[];
      }>('voice:join', {
        token: this.voiceToken,
        micEnabled: false,
        muted: true,
      });

      if (!joinRes.ok) return;
      this.listeningJoined = true;
      if (!this.micEnabled) {
        this.cb.onStatus('listening');
      }

      // Let peers who actually have mics ON initiate the offer, or initiate cleanly if impolite
      for (const peer of joinRes.peers ?? []) {
        if (peer.userId === this.myUserId) continue;
        const entry = this.getOrCreatePeer(peer.userId);
        if (!entry.polite) {
          await this.negotiatePeer(peer.userId, entry);
        }
      }
    } catch {
      // Non-fatal
    }
  }

  public async enableMicrophone(userId: string, roomCode: string): Promise<boolean> {
    this.cb.onError(null);
    this.cb.onStatus('connecting');
    this.myUserId = userId;
    this.activeRoomCode = roomCode;
    this.bindGlobalGestureUnlock();

    // User gesture! Resume playback AudioContext right away so we can hear others immediately too!
    const playCtx = this.ensurePlaybackContext();
    if (playCtx && playCtx.state === 'suspended') {
      playCtx.resume().catch(() => {});
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.cb.onStatus('error');
      this.cb.onError('Your browser does not support microphone capture.');
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      this.localStream = stream;
      this.micEnabled = true;
      this.muted = false;
      this.cb.onMicState(true, false);

      const tokenRes = await emitAck<{
        ok: boolean;
        payload?: VoiceTokenPayload;
        error?: string;
      }>('voice:get_token');

      if (!tokenRes.ok || !tokenRes.payload) {
        throw new Error(tokenRes.error || 'Failed to authenticate voice channel.');
      }

      this.voiceToken = tokenRes.payload.token;
      this.iceServers = tokenRes.payload.iceServers;
      this.bindSocketListeners();

      // Cleanly rebuild peers so our outgoing audio track is ALWAYS included from the first SDP offer!
      this.closeAllPeers();

      const joinRes = await emitAck<{
        ok: boolean;
        peers?: VoicePeerState[];
        error?: string;
      }>('voice:join', {
        token: this.voiceToken,
        micEnabled: true,
        muted: false,
      });

      if (!joinRes.ok) {
        throw new Error(joinRes.error || 'Could not join room voice channel.');
      }

      this.listeningJoined = true;
      this.startCaptureAndMonitor(stream);
      this.cb.onStatus('connected');
      this.refreshTransportState();

      // Send fresh offers to all existing voice peers in the room
      for (const peer of joinRes.peers ?? []) {
        if (peer.userId === this.myUserId) continue;
        const entry = this.getOrCreatePeer(peer.userId);
        await this.negotiatePeer(peer.userId, entry);
      }

      this.unlockRemoteAudioPlayback();
      return true;
    } catch (err) {
      this.stopLocalMedia();
      this.micEnabled = false;
      this.muted = false;
      this.cb.onMicState(false, false);
      this.cb.onStatus('error');
      this.cb.onError(this.formatMicError(err));
      return false;
    }
  }

  public setSelfTest(enabled: boolean): boolean {
    if (!this.localStream || !this.micEnabled) {
      this.stopSelfTest();
      return false;
    }
    if (enabled) {
      if (!this.selfTestAudio) {
        this.selfTestAudio = document.createElement('audio');
        this.selfTestAudio.autoplay = true;
        this.selfTestAudio.setAttribute('playsinline', 'true');
        this.ensureAudioContainer().appendChild(this.selfTestAudio);
      }
      this.selfTestAudio.srcObject = this.localStream;
      this.selfTestAudio.muted = false;
      this.selfTestAudio.volume = 0.85;
      this.selfTestAudio.play().catch(() => {});
      return true;
    }
    this.stopSelfTest();
    return false;
  }

  private stopSelfTest(): void {
    if (this.selfTestAudio) {
      this.selfTestAudio.pause();
      this.selfTestAudio.srcObject = null;
      this.selfTestAudio.remove();
      this.selfTestAudio = null;
    }
  }

  public unlockRemoteAudioPlayback(): void {
    const ctx = this.ensurePlaybackContext();
    if (ctx && ctx.state === 'suspended') {
      ctx
        .resume()
        .then(() => this.cb.onAutoplayBlocked(false))
        .catch(() => this.cb.onAutoplayBlocked(true));
    } else {
      this.cb.onAutoplayBlocked(false);
    }

    for (const audio of this.remoteAudios.values()) {
      audio.muted = !this.speakerEnabled;
      const p = audio.play();
      if (p) {
        p.then(() => this.cb.onAutoplayBlocked(false)).catch(() =>
          this.cb.onAutoplayBlocked(true)
        );
      }
    }
  }

  private async rejoinVoiceAfterReconnect(): Promise<void> {
    if (!this.activeRoomCode) return;
    this.cb.onStatus('reconnecting');
    const tokenRes = await emitAck<{
      ok: boolean;
      payload?: VoiceTokenPayload;
      error?: string;
    }>('voice:get_token');
    if (!tokenRes.ok || !tokenRes.payload) throw new Error('Token refresh failed.');
    this.voiceToken = tokenRes.payload.token;
    this.iceServers = tokenRes.payload.iceServers;

    this.closeAllPeers();
    const joinRes = await emitAck<{ ok: boolean; peers?: VoicePeerState[] }>('voice:join', {
      token: this.voiceToken,
      micEnabled: this.micEnabled,
      muted: this.muted,
    });
    if (!joinRes.ok) throw new Error('Rejoin failed.');
    this.cb.onStatus(this.micEnabled ? 'connected' : 'listening');
    this.refreshTransportState();
    for (const peer of joinRes.peers ?? []) {
      if (peer.userId === this.myUserId) continue;
      const entry = this.getOrCreatePeer(peer.userId);
      if (!entry.polite) {
        await this.negotiatePeer(peer.userId, entry);
      }
    }
  }

  public setMuted(nextMuted: boolean): void {
    this.muted = nextMuted;
    if (this.localStream) {
      for (const track of this.localStream.getAudioTracks()) {
        track.enabled = !nextMuted;
      }
    }
    if (nextMuted) {
      this.lastSpeaking = false;
      this.cb.onMicLevel(0, false);
    }
    this.cb.onMicState(this.micEnabled, this.muted);
    getSocket()?.emit('voice:state', {
      micEnabled: this.micEnabled,
      muted: this.muted,
      speaking: false,
    });
  }

  public setSpeakerEnabled(enabled: boolean): void {
    this.speakerEnabled = enabled;
    if (this.playbackGain && this.playbackCtx) {
      this.playbackGain.gain.setTargetAtTime(enabled ? 1.15 : 0.0, this.playbackCtx.currentTime, 0.02);
    }
    for (const audio of this.remoteAudios.values()) {
      audio.muted = !enabled;
      if (enabled) {
        audio.play().catch(() => this.cb.onAutoplayBlocked(true));
      }
    }
    if (enabled) {
      this.unlockRemoteAudioPlayback();
    }
  }

  public async disconnectVoice(): Promise<void> {
    this.stopSelfTest();
    this.stopLocalMedia();
    this.closeAllPeers();
    this.relayActivePeers.clear();
    this.relayLastHeardByPeer.clear();
    this.nextPlayTimeByPeer.clear();
    this.voiceToken = null;
    this.micEnabled = false;
    this.muted = false;
    this.listeningJoined = false;
    this.lastSpeaking = false;
    this.cb.onMicLevel(0, false);
    this.cb.onMicState(false, false);
    this.cb.onConnectedPeers(0);
    this.cb.onTransportMode('none');
    this.cb.onAutoplayBlocked(false);
    this.cb.onReceivingAudio(false);
    this.cb.onStatus('idle');
    this.cb.onError(null);

    try {
      const sock = getSocket();
      if (sock?.connected) {
        sock.emit('voice:leave');
      }
    } catch {
      // ignore
    }
  }

  private stopLocalMedia(): void {
    this.stopSelfTest();
    if (this.levelRafId !== null) {
      cancelAnimationFrame(this.levelRafId);
      this.levelRafId = null;
    }
    if (this.captureProcessor) {
      this.captureProcessor.disconnect();
      this.captureProcessor.onaudioprocess = null;
      this.captureProcessor = null;
    }
    if (this.captureSource) {
      this.captureSource.disconnect();
      this.captureSource = null;
    }
    if (this.captureSilentGain) {
      this.captureSilentGain.disconnect();
      this.captureSilentGain = null;
    }
    if (this.captureCtx) {
      this.captureCtx.close().catch(() => {});
      this.captureCtx = null;
      this.analyser = null;
    }
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        track.stop();
      }
      this.localStream = null;
    }
  }

  /**
   * Captures mic volume AND streams compact 16kHz Int16 chunks over Socket.IO
   * to any room member who does NOT already have a confirmed playing WebRTC audio track.
   */
  private startCaptureAndMonitor(stream: MediaStream): void {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.7;
      source.connect(analyser);

      const processor = ctx.createScriptProcessor(4096, 1, 1);
      const silentGain = ctx.createGain();
      silentGain.gain.value = 0.00001; // non-zero keeps Chrome audio graph active without audible bleed

      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(ctx.destination);

      processor.onaudioprocess = (evt) => {
        if (!this.micEnabled || this.muted || !this.voiceToken) return;
        const sock = getSocket();
        if (!sock?.connected) return;

        const input = evt.inputBuffer.getChannelData(0);
        // Gentle noise gate (0.002 catches even quiet laptop/phone mics!)
        let sumSq = 0;
        for (let i = 0; i < input.length; i += 4) {
          sumSq += input[i] * input[i];
        }
        const rms = Math.sqrt(sumSq / (input.length / 4));
        const now = Date.now();
        if (rms > 0.002) {
          this.speakingHoldUntil = Math.max(this.speakingHoldUntil, now + 600);
        }
        if (now > this.speakingHoldUntil) return;

        const pcm = downsampleToInt16(input, ctx.sampleRate);
        // Send relay to everyone EXCEPT peers who already confirmed live WebRTC audio!
        const confirmedP2P = this.getConfirmedP2PPeerIds();
        sock.emit('voice:relay_audio', {
          token: this.voiceToken,
          sampleRate: TARGET_SAMPLE_RATE,
          pcm: pcm.buffer,
          excludeUserIds: confirmedP2P,
        });
      };

      this.captureCtx = ctx;
      this.captureSource = source;
      this.captureProcessor = processor;
      this.captureSilentGain = silentGain;
      this.analyser = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!this.analyser || !this.micEnabled) return;
        if (this.muted) {
          this.cb.onMicLevel(0, false);
          this.levelRafId = requestAnimationFrame(tick);
          return;
        }

        this.analyser.getByteTimeDomainData(data);
        let sumSq = 0;
        for (let i = 0; i < data.length; i++) {
          const norm = (data[i] - 128) / 128;
          sumSq += norm * norm;
        }
        const rms = Math.sqrt(sumSq / data.length);
        const level = Math.min(100, Math.round(rms * 460));
        const now = Date.now();
        if (level > 6) {
          this.speakingHoldUntil = Math.max(this.speakingHoldUntil, now + 500);
        }
        const speakingNow = now < this.speakingHoldUntil;

        this.cb.onMicLevel(level, speakingNow);

        if (speakingNow !== this.lastSpeaking) {
          this.lastSpeaking = speakingNow;
          getSocket()?.emit('voice:state', {
            micEnabled: this.micEnabled,
            muted: this.muted,
            speaking: speakingNow,
          });
        }

        this.levelRafId = requestAnimationFrame(tick);
      };

      this.levelRafId = requestAnimationFrame(tick);
    } catch {
      // Fallback gracefully
    }
  }

  private getOrCreatePeer(targetUserId: string): PeerEntry {
    const existing = this.peers.get(targetUserId);
    if (existing) return existing;

    const pc = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceCandidatePoolSize: 4,
    });

    const polite = Boolean(this.myUserId && this.myUserId > targetUserId);
    const entry: PeerEntry = {
      pc,
      makingOffer: false,
      ignoreOffer: false,
      polite,
      hasLiveRemoteAudio: false,
    };
    this.peers.set(targetUserId, entry);

    // Only attach local tracks if we have mic ON.
    // NEVER pre-add a recvonly transceiver here (avoids SDP m-line mismatch on answerers!).
    if (this.localStream) {
      for (const track of this.localStream.getAudioTracks()) {
        pc.addTrack(track, this.localStream);
      }
    }

    pc.onicecandidate = (evt) => {
      if (evt.candidate && this.voiceToken) {
        getSocket()?.emit('voice:signal', {
          token: this.voiceToken,
          targetUserId,
          signalType: 'ice-candidate',
          data: evt.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (evt) => {
      const track = evt.track;
      if (track.kind !== 'audio') return;

      const remoteStream = evt.streams[0] ?? new MediaStream([track]);
      let audio = this.remoteAudios.get(targetUserId);
      if (!audio) {
        audio = document.createElement('audio');
        audio.autoplay = true;
        audio.setAttribute('playsinline', 'true');
        this.ensureAudioContainer().appendChild(audio);
        this.remoteAudios.set(targetUserId, audio);
      }
      audio.srcObject = remoteStream;
      audio.muted = !this.speakerEnabled;
      audio.volume = 1.0;

      const markLive = () => {
        entry.hasLiveRemoteAudio = track.readyState === 'live' && !track.muted;
        this.refreshTransportState();
      };
      track.onunmute = markLive;
      track.onmute = () => {
        entry.hasLiveRemoteAudio = false;
        this.refreshTransportState();
      };
      track.onended = () => {
        entry.hasLiveRemoteAudio = false;
        this.refreshTransportState();
      };

      const playPromise = audio.play();
      if (playPromise) {
        playPromise
          .then(() => {
            this.cb.onAutoplayBlocked(false);
            markLive();
          })
          .catch(() => {
            this.cb.onAutoplayBlocked(true);
            entry.hasLiveRemoteAudio = false;
            this.refreshTransportState();
          });
      }
    };

    pc.onconnectionstatechange = () => {
      this.refreshTransportState();
      if (pc.connectionState === 'closed') {
        this.closePeer(targetUserId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      this.refreshTransportState();
    };

    return entry;
  }

  private async negotiatePeer(targetUserId: string, entry: PeerEntry): Promise<void> {
    if (!this.voiceToken || entry.makingOffer) return;
    try {
      entry.makingOffer = true;
      // Add recvonly transceiver ONLY when initiating an offer with no local mic track
      if (!this.localStream && entry.pc.getTransceivers().length === 0) {
        entry.pc.addTransceiver('audio', { direction: 'recvonly' });
      }
      const offer = await entry.pc.createOffer({ offerToReceiveAudio: true });
      if (entry.pc.signalingState !== 'stable') return;
      await entry.pc.setLocalDescription(offer);
      getSocket()?.emit('voice:signal', {
        token: this.voiceToken,
        targetUserId,
        signalType: 'offer',
        data: entry.pc.localDescription,
      });
    } catch {
      // ignore collision
    } finally {
      entry.makingOffer = false;
    }
  }

  private async flushPendingCandidates(targetUserId: string, pc: RTCPeerConnection): Promise<void> {
    const queued = this.pendingCandidates.get(targetUserId);
    if (!queued || queued.length === 0) return;
    this.pendingCandidates.delete(targetUserId);
    for (const cand of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch {
        // ignore stale candidate
      }
    }
  }

  private async handleIncomingSignal(
    fromUserId: string,
    signalType: 'offer' | 'answer' | 'ice-candidate',
    data: unknown
  ): Promise<void> {
    if (!this.voiceToken) return;
    const entry = this.getOrCreatePeer(fromUserId);
    const { pc } = entry;

    try {
      if (signalType === 'offer' || signalType === 'answer') {
        const description = data as RTCSessionDescriptionInit;
        const offerCollision =
          signalType === 'offer' && (entry.makingOffer || pc.signalingState !== 'stable');

        entry.ignoreOffer = !entry.polite && offerCollision;
        if (entry.ignoreOffer) return;

        if (offerCollision && entry.polite) {
          await pc.setLocalDescription({ type: 'rollback' });
        }

        await pc.setRemoteDescription(new RTCSessionDescription(description));
        await this.flushPendingCandidates(fromUserId, pc);

        if (signalType === 'offer') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          getSocket()?.emit('voice:signal', {
            token: this.voiceToken,
            targetUserId: fromUserId,
            signalType: 'answer',
            data: pc.localDescription,
          });
        }
      } else if (signalType === 'ice-candidate' && data) {
        if (entry.ignoreOffer) return;
        const candidateInit = data as RTCIceCandidateInit;
        if (pc.remoteDescription && pc.remoteDescription.type) {
          await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
        } else {
          const list = this.pendingCandidates.get(fromUserId) ?? [];
          list.push(candidateInit);
          this.pendingCandidates.set(fromUserId, list);
        }
      }
    } catch {
      // gracefully recover
    }
  }

  private closePeer(userId: string): void {
    this.pendingCandidates.delete(userId);
    this.relayActivePeers.delete(userId);
    this.relayLastHeardByPeer.delete(userId);
    this.nextPlayTimeByPeer.delete(userId);
    const entry = this.peers.get(userId);
    if (entry) {
      entry.pc.close();
      this.peers.delete(userId);
    }
    const audio = this.remoteAudios.get(userId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
      this.remoteAudios.delete(userId);
    }
    this.refreshTransportState();
  }

  private closeAllPeers(): void {
    for (const uid of Array.from(this.peers.keys())) {
      this.closePeer(uid);
    }
  }

  private formatMicError(err: unknown): string {
    if (err instanceof DOMException) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        return 'Microphone permission was denied. Allow mic access in your browser settings and click Retry.';
      }
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        return 'No microphone was detected on this device.';
      }
      if (err.name === 'NotReadableError') {
        return 'Your microphone is currently in use by another application.';
      }
    }
    return err instanceof Error ? err.message : 'Unable to start voice chat.';
  }
}

export const voiceManager = new VoiceManager();
