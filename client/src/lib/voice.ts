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
  onIceFailure: (failed: boolean) => void;
}

interface PeerEntry {
  pc: RTCPeerConnection;
  makingOffer: boolean;
  ignoreOffer: boolean;
  polite: boolean;
  iceFailTimer: ReturnType<typeof setTimeout> | null;
}

class VoiceManager {
  private localStream: MediaStream | null = null;
  private peers = new Map<string, PeerEntry>();
  private pendingCandidates = new Map<string, RTCIceCandidateInit[]>();
  private remoteAudios = new Map<string, HTMLAudioElement>();
  private audioContainer: HTMLDivElement | null = null;

  // Optional local self-test loopback
  private selfTestAudio: HTMLAudioElement | null = null;

  private voiceToken: string | null = null;
  private iceServers: RTCIceServer[] = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
  ];
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
  private gestureUnlockBound = false;

  private cb: VoiceCallbacks = {
    onStatus: () => {},
    onError: () => {},
    onMicLevel: () => {},
    onMicState: () => {},
    onConnectedPeers: () => {},
    onAutoplayBlocked: () => {},
    onIceFailure: () => {},
  };

  public setCallbacks(cb: VoiceCallbacks): void {
    this.cb = cb;
  }

  private bindGlobalGestureUnlock(): void {
    if (this.gestureUnlockBound || typeof window === 'undefined') return;
    this.gestureUnlockBound = true;
    const unlock = () => {
      if (this.remoteAudios.size > 0 && this.speakerEnabled) {
        this.unlockRemoteAudioPlayback();
      }
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
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

  private updateConnectedPeersCount(): void {
    let connected = 0;
    let anyFailed = false;
    for (const entry of this.peers.values()) {
      const state = entry.pc.connectionState;
      const ice = entry.pc.iceConnectionState;
      if (state === 'connected' || ice === 'connected' || ice === 'completed') {
        connected++;
        if (entry.iceFailTimer) {
          clearTimeout(entry.iceFailTimer);
          entry.iceFailTimer = null;
        }
      } else if (state === 'failed' || ice === 'failed') {
        anyFailed = true;
      }
    }
    this.cb.onConnectedPeers(connected);
    this.cb.onIceFailure(anyFailed && connected === 0);
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
      // Only create peer entry; negotiationneeded triggers automatically with Perfect Negotiation!
      const entry = this.getOrCreatePeer(payload.peer.userId);
      // If we are impolite (initiator) and no offer is in flight, kick off negotiation
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
   * Joins the room's isolated WebRTC voice mesh in LISTEN-ONLY mode (NEVER requests mic permission!)
   */
  public async ensureListening(userId: string, roomCode: string): Promise<void> {
    if (!this.speakerEnabled) return;
    if ((this.micEnabled || this.listeningJoined) && this.activeRoomCode === roomCode) return;

    this.myUserId = userId;
    this.activeRoomCode = roomCode;
    this.bindGlobalGestureUnlock();

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
    this.cb.onIceFailure(false);
    this.cb.onStatus('connecting');
    this.myUserId = userId;
    this.activeRoomCode = roomCode;
    this.bindGlobalGestureUnlock();

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

      // Attach local audio track to existing peers cleanly OR recreate if recvonly
      const audioTrack = stream.getAudioTracks()[0];
      for (const [peerId, entry] of this.peers.entries()) {
        const sender = entry.pc.getSenders().find((s) => s.track?.kind === 'audio' || !s.track);
        if (sender && entry.pc.getTransceivers().some((t) => t.direction === 'sendrecv')) {
          await sender.replaceTrack(audioTrack);
        } else {
          // Upgrade recvonly transceiver to sendrecv and renegotiate cleanly
          const trans = entry.pc.getTransceivers().find((t) => t.receiver.track?.kind === 'audio');
          if (trans) {
            trans.direction = 'sendrecv';
            await trans.sender.replaceTrack(audioTrack);
          } else {
            entry.pc.addTrack(audioTrack, stream);
          }
          await this.negotiatePeer(peerId, entry);
        }
      }

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

      // Connect to any peers not yet in our map
      for (const peer of joinRes.peers ?? []) {
        if (peer.userId === this.myUserId) continue;
        if (!this.peers.has(peer.userId)) {
          const entry = this.getOrCreatePeer(peer.userId);
          await this.negotiatePeer(peer.userId, entry);
        }
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
    this.cb.onIceFailure(false);
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

  private getOrCreatePeer(targetUserId: string): PeerEntry {
    const existing = this.peers.get(targetUserId);
    if (existing) return existing;

    const pc = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceCandidatePoolSize: 4,
    });

    // Polite peer yields on offer collision (W3C Perfect Negotiation)
    const polite = Boolean(this.myUserId && this.myUserId > targetUserId);
    const entry: PeerEntry = {
      pc,
      makingOffer: false,
      ignoreOffer: false,
      polite,
      iceFailTimer: null,
    };
    this.peers.set(targetUserId, entry);

    if (this.localStream) {
      for (const track of this.localStream.getAudioTracks()) {
        pc.addTrack(track, this.localStream);
      }
    } else {
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

    // Flag ICE failure if peer stays stuck in checking/disconnected for >10s (typically needs TURN on 4G/5G)
    entry.iceFailTimer = setTimeout(() => {
      const ice = pc.iceConnectionState;
      if (ice !== 'connected' && ice !== 'completed' && pc.connectionState !== 'connected') {
        this.cb.onIceFailure(true);
      }
    }, 10000);

    pc.onconnectionstatechange = () => {
      this.updateConnectedPeersCount();
      if (pc.connectionState === 'closed') {
        this.closePeer(targetUserId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      this.updateConnectedPeersCount();
      if (pc.iceConnectionState === 'failed' && !entry.polite) {
        pc.restartIce();
        this.negotiatePeer(targetUserId, entry).catch(() => {});
      }
    };

    return entry;
  }

  private async negotiatePeer(targetUserId: string, entry: PeerEntry): Promise<void> {
    if (!this.voiceToken || entry.makingOffer) return;
    try {
      entry.makingOffer = true;
      const offer = await entry.pc.createOffer();
      if (entry.pc.signalingState !== 'stable') return;
      await entry.pc.setLocalDescription(offer);
      getSocket()?.emit('voice:signal', {
        token: this.voiceToken,
        targetUserId,
        signalType: 'offer',
        data: entry.pc.localDescription,
      });
    } catch {
      // ignore transient collision
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
          // Polite peer cleanly rolls back its own local offer and accepts remote offer!
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
    const entry = this.peers.get(userId);
    if (entry) {
      if (entry.iceFailTimer) clearTimeout(entry.iceFailTimer);
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
    this.updateConnectedPeersCount();
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
