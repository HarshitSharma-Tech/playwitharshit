import type { Socket } from 'socket.io-client';
import type { VoicePeerState, VoiceTokenPayload } from '@shared/types';
import { emitAck, getSocket } from './socket';

type VoiceStatus = 'idle' | 'listening' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface VoiceCallbacks {
  onStatus: (status: VoiceStatus) => void;
  onError: (message: string | null) => void;
  onMicLevel: (level: number, speaking: boolean) => void;
  onMicState: (micEnabled: boolean, muted: boolean) => void;
  onConnectedPeers: (count: number) => void;
  onAutoplayBlocked: (blocked: boolean) => void;
}

class VoiceManager {
  private localStream: MediaStream | null = null;
  private peerConnections = new Map<string, RTCPeerConnection>();
  private pendingCandidates = new Map<string, RTCIceCandidateInit[]>();
  private remoteAudios = new Map<string, HTMLAudioElement>();
  private audioContainer: HTMLDivElement | null = null;

  // Optional local self-test loopback so user can verify their own mic
  private selfTestAudio: HTMLAudioElement | null = null;
  private selfTesting = false;

  private voiceToken: string | null = null;
  private iceServers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
  private myUserId: string | null = null;
  private activeRoomCode: string | null = null;
  private speakerEnabled = true;
  private micEnabled = false;
  private muted = false;
  private listeningJoined = false;

  // Audio activity detector
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private levelRafId: number | null = null;
  private lastSpeaking = false;
  private speakingHoldUntil = 0;
  private boundSocket: Socket | null = null;

  private cb: VoiceCallbacks = {
    onStatus: () => {},
    onError: () => {},
    onMicLevel: () => {},
    onMicState: () => {},
    onConnectedPeers: () => {},
    onAutoplayBlocked: () => {},
  };

  public setCallbacks(cb: VoiceCallbacks): void {
    this.cb = cb;
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

  private updateConnectedPeersCount(): void {
    let connected = 0;
    for (const pc of this.peerConnections.values()) {
      if (pc.connectionState === 'connected' || pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        connected++;
      }
    }
    this.cb.onConnectedPeers(connected);
  }

  public bindSocketListeners(): void {
    const socket = getSocket();
    if (!socket || this.boundSocket === socket) return;

    this.unbindSocketListeners();
    this.boundSocket = socket;

    socket.on('voice:peer_joined', async (payload: { roomCode: string; peer: VoicePeerState }) => {
      if (!this.voiceToken || payload.roomCode !== this.activeRoomCode) return;
      if (payload.peer.userId === this.myUserId) return;
      // Deterministically let the lexicographically smaller userId initiate offer to prevent glare
      if (this.myUserId && this.myUserId < payload.peer.userId) {
        await this.createAndSendOffer(payload.peer.userId);
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
      this.boundSocket.off('voice:peer_left');
      this.boundSocket = null;
    }
  }

  /**
   * Joins the room's isolated WebRTC voice mesh in LISTEN-ONLY mode (NEVER asks for mic permission!)
   * so players who don't enable their microphone can still hear teammates who do.
   */
  public async ensureListening(userId: string, roomCode: string): Promise<void> {
    if (!this.speakerEnabled) return;
    if (this.micEnabled || this.listeningJoined) {
      if (this.activeRoomCode === roomCode) return;
    }
    this.myUserId = userId;
    this.activeRoomCode = roomCode;

    try {
      const tokenRes = await emitAck<{
        ok: boolean;
        payload?: VoiceTokenPayload;
        error?: string;
      }>('voice:get_token');
      if (!tokenRes.ok || !tokenRes.payload) return;

      this.voiceToken = tokenRes.payload.token;
      this.iceServers = tokenRes.payload.iceServers;
      this.bindSocketListeners();

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

      for (const peer of joinRes.peers ?? []) {
        if (peer.userId === this.myUserId) continue;
        if (this.myUserId && this.myUserId < peer.userId) {
          await this.createAndSendOffer(peer.userId);
        }
      }
    } catch {
      // Non-fatal; listen-only fails silently without disturbing gameplay
    }
  }

  public async enableMicrophone(userId: string, roomCode: string): Promise<boolean> {
    this.cb.onError(null);
    this.cb.onStatus('connecting');
    this.myUserId = userId;
    this.activeRoomCode = roomCode;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.cb.onStatus('error');
      this.cb.onError('Your browser does not support WebRTC microphone capture.');
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

      // Close any old receive-only peers so fresh bidirectional audio tracks negotiate cleanly
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
      this.startSpeakingMonitor(stream);
      this.cb.onStatus('connected');

      // Actively offer to ALL existing peers in the room when enabling mic so tracks always attach!
      const existingPeers = joinRes.peers ?? [];
      for (const peer of existingPeers) {
        if (peer.userId === this.myUserId) continue;
        await this.createAndSendOffer(peer.userId);
      }

      // Also retry playback on any existing remote audio elements since this click is a user gesture
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
    this.selfTesting = enabled;
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
    } else {
      this.stopSelfTest();
      return false;
    }
  }

  private stopSelfTest(): void {
    this.selfTesting = false;
    if (this.selfTestAudio) {
      this.selfTestAudio.pause();
      this.selfTestAudio.srcObject = null;
      this.selfTestAudio.remove();
      this.selfTestAudio = null;
    }
  }

  public unlockRemoteAudioPlayback(): void {
    let anyBlocked = false;
    for (const audio of this.remoteAudios.values()) {
      audio.muted = !this.speakerEnabled;
      const p = audio.play();
      if (p) {
        p.catch(() => {
          anyBlocked = true;
          this.cb.onAutoplayBlocked(true);
        });
      }
    }
    if (!anyBlocked) {
      this.cb.onAutoplayBlocked(false);
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
    for (const peer of joinRes.peers ?? []) {
      if (this.myUserId && this.myUserId < peer.userId) {
        await this.createAndSendOffer(peer.userId);
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
    for (const audio of this.remoteAudios.values()) {
      audio.muted = !enabled;
      if (enabled) {
        audio.play().catch(() => this.cb.onAutoplayBlocked(true));
      }
    }
    if (enabled) {
      this.cb.onAutoplayBlocked(false);
    }
  }

  public async disconnectVoice(): Promise<void> {
    this.stopSelfTest();
    this.stopLocalMedia();
    this.closeAllPeers();
    this.voiceToken = null;
    this.micEnabled = false;
    this.muted = false;
    this.listeningJoined = false;
    this.lastSpeaking = false;
    this.cb.onMicLevel(0, false);
    this.cb.onMicState(false, false);
    this.cb.onConnectedPeers(0);
    this.cb.onAutoplayBlocked(false);
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
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
      this.analyser = null;
    }
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        track.stop();
      }
      this.localStream = null;
    }
  }

  private startSpeakingMonitor(stream: MediaStream): void {
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

      this.audioCtx = ctx;
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
        const level = Math.min(100, Math.round(rms * 420));
        const now = Date.now();
        if (level > 10) {
          this.speakingHoldUntil = now + 420;
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

  private getOrCreatePeer(targetUserId: string): RTCPeerConnection {
    const existing = this.peerConnections.get(targetUserId);
    if (existing) return existing;

    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    this.peerConnections.set(targetUserId, pc);

    if (this.localStream) {
      for (const track of this.localStream.getAudioTracks()) {
        pc.addTrack(track, this.localStream);
      }
    } else {
      // Receive-only transceiver so listen-only peers still receive remote voice audio!
      pc.addTransceiver('audio', { direction: 'recvonly' });
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
      const remoteStream = evt.streams[0] ?? new MediaStream([evt.track]);
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
      const playPromise = audio.play();
      if (playPromise) {
        playPromise
          .then(() => this.cb.onAutoplayBlocked(false))
          .catch(() => this.cb.onAutoplayBlocked(true));
      }
    };

    pc.onconnectionstatechange = () => {
      this.updateConnectedPeersCount();
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.closePeer(targetUserId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      this.updateConnectedPeersCount();
    };

    return pc;
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

  private async createAndSendOffer(targetUserId: string): Promise<void> {
    if (!this.voiceToken) return;
    try {
      const pc = this.getOrCreatePeer(targetUserId);
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      getSocket()?.emit('voice:signal', {
        token: this.voiceToken,
        targetUserId,
        signalType: 'offer',
        data: offer,
      });
    } catch {
      // ignore transient negotiation errors
    }
  }

  private async handleIncomingSignal(
    fromUserId: string,
    signalType: 'offer' | 'answer' | 'ice-candidate',
    data: unknown
  ): Promise<void> {
    if (!this.voiceToken) return;
    try {
      if (signalType === 'offer') {
        // If an offer arrives from a peer who just enabled mic, recreate peer cleanly if needed
        const existing = this.peerConnections.get(fromUserId);
        if (existing && existing.signalingState !== 'stable') {
          this.closePeer(fromUserId);
        }
        const pc = this.getOrCreatePeer(fromUserId);
        await pc.setRemoteDescription(
          new RTCSessionDescription(data as RTCSessionDescriptionInit)
        );
        await this.flushPendingCandidates(fromUserId, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        getSocket()?.emit('voice:signal', {
          token: this.voiceToken,
          targetUserId: fromUserId,
          signalType: 'answer',
          data: answer,
        });
      } else if (signalType === 'answer') {
        const pc = this.peerConnections.get(fromUserId);
        if (pc && pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(
            new RTCSessionDescription(data as RTCSessionDescriptionInit)
          );
          await this.flushPendingCandidates(fromUserId, pc);
        }
      } else if (signalType === 'ice-candidate' && data) {
        const pc = this.getOrCreatePeer(fromUserId);
        const candidateInit = data as RTCIceCandidateInit;
        if (pc.remoteDescription && pc.remoteDescription.type) {
          await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
        } else {
          // Buffer ICE candidates until remoteDescription is applied!
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
    const pc = this.peerConnections.get(userId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(userId);
    }
    const audio = this.remoteAudios.get(userId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
      this.remoteAudios.delete(userId);
    }
    this.updateConnectedPeersCount();
  }

  private closeAllPeers(): void {
    for (const uid of Array.from(this.peerConnections.keys())) {
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
