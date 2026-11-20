import { create } from 'zustand';
import type { VoicePeerState } from '@shared/types';
import { voiceManager, type VoiceTransportMode } from '../lib/voice';

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
  pushToTalk: boolean;
  speakerEnabled: boolean;
  speaking: boolean;
  micLevel: number;
  connectedAudioPeers: number;
  transportMode: VoiceTransportMode;
  autoplayBlocked: boolean;
  receivingAudio: boolean;
  selfTesting: boolean;
  error: string | null;
  peers: VoicePeerState[];

  prepareRoom: (userId: string, roomCode: string) => void;
  setPeers: (peers: VoicePeerState[], myUserId?: string, roomCode?: string) => void;
  enableMic: (userId: string, roomCode: string) => Promise<void>;
  disableMic: () => Promise<void>;
  toggleMute: () => void;
  setMuted: (muted: boolean) => void;
  togglePushToTalk: () => void;
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
    onTransportMode: (transportMode) => set({ transportMode }),
    onAutoplayBlocked: (autoplayBlocked) => set({ autoplayBlocked }),
    onReceivingAudio: (receivingAudio) => set({ receivingAudio }),
  });

  return {
    status: 'idle',
    micEnabled: false,
    muted: false,
    pushToTalk: false,
    speakerEnabled: true,
    speaking: false,
    micLevel: 0,
    connectedAudioPeers: 0,
    transportMode: 'none',
    autoplayBlocked: false,
    receivingAudio: false,
    selfTesting: false,
    error: null,
    peers: [],

    prepareRoom: (userId, roomCode) => {
      voiceManager.prepareRoomListener(userId, roomCode);
    },

    setPeers: (peers, myUserId, roomCode) => {
      set({ peers });
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

    setMuted: (nextMuted) => {
      if (!get().micEnabled) return;
      voiceManager.setMuted(nextMuted);
    },

    togglePushToTalk: () => {
      const nextPtt = !get().pushToTalk;
      set({ pushToTalk: nextPtt });
      if (get().micEnabled) {
        // In Push-to-Talk mode, stay muted until player holds talk button or V key!
        voiceManager.setMuted(nextPtt);
      }
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
        transportMode: 'none',
        autoplayBlocked: false,
        receivingAudio: false,
        selfTesting: false,
        error: null,
        peers: [],
      });
    },
  };
});
