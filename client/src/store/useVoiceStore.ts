import { create } from 'zustand';
import type { VoicePeerState } from '@shared/types';
import { voiceManager } from '../lib/voice';

export type VoiceConnectionStatus =
  | 'idle'
  | 'listening'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

interface VoiceStoreState {
  status: VoiceConnectionStatus;
  micEnabled: boolean;
  muted: boolean;
  speakerEnabled: boolean;
  speaking: boolean;
  micLevel: number;
  connectedAudioPeers: number;
  autoplayBlocked: boolean;
  iceFailed: boolean;
  selfTesting: boolean;
  error: string | null;
  peers: VoicePeerState[];

  setPeers: (peers: VoicePeerState[], myUserId?: string, roomCode?: string) => void;
  enableMic: (userId: string, roomCode: string) => Promise<void>;
  disableMic: () => Promise<void>;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  toggleSelfTest: () => void;
  unlockAudio: () => void;
  clearError: () => void;
  resetOnLeaveRoom: () => void;
}

export const useVoiceStore = create<VoiceStoreState>((set, get) => {
  voiceManager.setCallbacks({
    onStatus: (status) => set({ status }),
    onError: (error) => set({ error }),
    onMicLevel: (micLevel, speaking) => set({ micLevel, speaking }),
    onMicState: (micEnabled, muted) => set({ micEnabled, muted }),
    onConnectedPeers: (connectedAudioPeers) => set({ connectedAudioPeers }),
    onAutoplayBlocked: (autoplayBlocked) => set({ autoplayBlocked }),
    onIceFailure: (iceFailed) => set({ iceFailed }),
  });

  return {
    status: 'idle',
    micEnabled: false,
    muted: false,
    speakerEnabled: true,
    speaking: false,
    micLevel: 0,
    connectedAudioPeers: 0,
    autoplayBlocked: false,
    iceFailed: false,
    selfTesting: false,
    error: null,
    peers: [],

    setPeers: (peers, myUserId, roomCode) => {
      set({ peers });
      // If another player enabled their mic and our speaker is ON, auto-join listen-only
      // (NEVER asks for microphone permission!) so we immediately hear them!
      const state = get();
      if (
        myUserId &&
        roomCode &&
        state.speakerEnabled &&
        !state.micEnabled &&
        peers.some((p) => p.micEnabled && p.userId !== myUserId)
      ) {
        voiceManager.ensureListening(myUserId, roomCode).catch(() => {});
      }
    },

    enableMic: async (userId, roomCode) => {
      await voiceManager.enableMicrophone(userId, roomCode);
    },

    disableMic: async () => {
      set({ selfTesting: false });
      await voiceManager.disconnectVoice();
    },

    toggleMute: () => {
      const { micEnabled, muted } = get();
      if (!micEnabled) return;
      voiceManager.setMuted(!muted);
    },

    toggleSpeaker: () => {
      const next = !get().speakerEnabled;
      voiceManager.setSpeakerEnabled(next);
      set({ speakerEnabled: next });
    },

    toggleSelfTest: () => {
      const next = !get().selfTesting;
      const active = voiceManager.setSelfTest(next);
      set({ selfTesting: active });
    },

    unlockAudio: () => {
      voiceManager.unlockRemoteAudioPlayback();
    },

    clearError: () => set({ error: null, status: get().micEnabled ? 'connected' : 'idle' }),

    resetOnLeaveRoom: () => {
      voiceManager.disconnectVoice().catch(() => {});
      voiceManager.unbindSocketListeners();
      set({
        status: 'idle',
        micEnabled: false,
        muted: false,
        speaking: false,
        micLevel: 0,
        connectedAudioPeers: 0,
        autoplayBlocked: false,
        iceFailed: false,
        selfTesting: false,
        error: null,
        peers: [],
      });
    },
  };
});
