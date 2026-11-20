import { create } from 'zustand';
import type {
  BotPersonality,
  CardsPerPlayerOption,
  ChatMessage,
  CreateRoomPayload,
  DeckCountOption,
  Difficulty,
  LobbyState,
  MatchHistoryItem,
  QuickPlayStatus,
  Rank,
  ReactionEmoji,
  ReactionEvent,
  SanitizedGameState,
  ShuffleSpeed,
  TurnTimerOption,
  UserProfile,
  VoicePeerState,
  VoicePhrase,
} from '@shared/types';
import { api, getStoredToken, setStoredToken } from '../lib/api';
import { connectSocket, disconnectSocket, emitAck, getSocket } from '../lib/socket';
import { soundEngine } from '../lib/sound';
import { useToastStore } from './useToastStore';
import { useVoiceStore } from './useVoiceStore';

export type AppView = 'home' | 'how-to-play' | 'leaderboard' | 'profile' | 'lobby' | 'game';

interface GameStoreState {
  initialized: boolean;
  connected: boolean;
  token: string | null;
  user: UserProfile | null;
  matchHistory: MatchHistoryItem[];
  activeView: AppView;

  lobby: LobbyState | null;
  gameState: SanitizedGameState | null;
  reactions: ReactionEvent[];
  chatMessages: ChatMessage[];
  quickPlay: QuickPlayStatus | null;

  // Modals
  showCreateRoomModal: boolean;
  showJoinRoomModal: boolean;
  joinModalPrefillCode: string;
  showBotsModal: boolean;
  showSettingsModal: boolean;
  showAuthModal: boolean;

  // Lifecycle & Navigation
  initSession: () => Promise<void>;
  setView: (view: AppView) => void;
  setModal: (
    modal: 'createRoom' | 'joinRoom' | 'bots' | 'settings' | 'auth',
    open: boolean,
    prefillCode?: string
  ) => void;

  // Auth & Profile
  login: (identifier: string, password: string) => Promise<void>;
  register: (payload: {
    username: string;
    email: string;
    password: string;
    avatar?: string;
  }) => Promise<void>;
  updateProfile: (payload: { username?: string; avatar?: string }) => Promise<void>;
  logoutAndReGuest: () => Promise<void>;
  refreshProfile: () => Promise<void>;

  // Rooms & Matchmaking
  createPrivateRoom: (payload: CreateRoomPayload) => Promise<void>;
  joinRoom: (code: string, password?: string, asSpectator?: boolean) => Promise<void>;
  createBotMatch: (payload: {
    bots: BotPersonality[];
    cardsPerPlayer: CardsPerPlayerOption;
    deckCount?: DeckCountOption;
    shuffleSpeed?: ShuffleSpeed;
    turnTimer: TurnTimerOption;
    difficulty: Difficulty;
  }) => Promise<void>;
  leaveRoom: () => Promise<void>;
  toggleReady: () => Promise<void>;
  addBotToLobby: (personality: BotPersonality) => Promise<void>;
  kickPlayer: (targetId: string) => Promise<void>;
  updateRoomSettings: (updates: Partial<CreateRoomPayload>) => Promise<void>;
  startGame: () => Promise<void>;
  triggerManualDeal: () => Promise<void>;
  returnToLobby: () => Promise<void>;

  startQuickPlay: () => Promise<void>;
  cancelQuickPlay: () => Promise<void>;
  quickPlayFillBots: () => Promise<void>;

  // Core Gameplay Actions
  playCards: (cardIds: string[], declaredRank?: Rank) => Promise<void>;
  passTurn: () => Promise<void>;
  acceptClaim: () => Promise<void>;
  challengePlay: () => Promise<void>;
  sendReaction: (emoji: ReactionEmoji) => void;
  sendVoicePhrase: (phrase: VoicePhrase) => void;
  sendChatMessage: (payload: {
    text: string;
    memeId?: string;
    memeTitle?: string;
    memeImage?: string;
    memeTag?: string;
  }) => Promise<void>;
}

const VIEW_STORAGE_KEY = 'bluffed_active_view';

function syncRoomUrl(roomCode: string | null): void {
  try {
    const url = new URL(window.location.href);
    if (roomCode) {
      url.searchParams.set('room', roomCode);
    } else {
      url.searchParams.delete('room');
    }
    window.history.replaceState({}, '', url.pathname + url.search);
  } catch {
    // ignore
  }
}

function saveNonGameView(view: AppView): void {
  try {
    if (view === 'lobby' || view === 'game') {
      sessionStorage.removeItem(VIEW_STORAGE_KEY);
    } else {
      sessionStorage.setItem(VIEW_STORAGE_KEY, view);
    }
  } catch {
    // ignore
  }
}

function loadSavedView(): AppView {
  try {
    const v = sessionStorage.getItem(VIEW_STORAGE_KEY);
    if (v === 'how-to-play' || v === 'leaderboard' || v === 'profile' || v === 'home') {
      return v;
    }
  } catch {
    // ignore
  }
  return 'home';
}

function attachSocketListeners(
  token: string,
  set: (partial: Partial<GameStoreState> | ((s: GameStoreState) => Partial<GameStoreState>)) => void,
  get: () => GameStoreState
) {
  const socket = connectSocket(token);
  socket.removeAllListeners();

  socket.on('connect', () => {
    set({ connected: true });
    socket.emit(
      'room:sync',
      {},
      (res: {
        ok: boolean;
        active?: {
          lobby: LobbyState;
          hasGame: boolean;
          gameState?: SanitizedGameState | null;
          chatHistory?: ChatMessage[];
        } | null;
      }) => {
        if (res?.ok && res.active) {
          const { lobby, hasGame, gameState, chatHistory } = res.active;
          const myId = get().user?.id;
          if (myId && lobby?.code) {
            useVoiceStore.getState().prepareRoom(myId, lobby.code);
            syncRoomUrl(lobby.code);
          }
          set({
            lobby,
            gameState: gameState ?? get().gameState,
            chatMessages: chatHistory ?? get().chatMessages,
            activeView: hasGame ? 'game' : 'lobby',
            showJoinRoomModal: false,
          });
        } else {
          // If the URL still has ?room=CODE (e.g. shared link or expired table), prefill Join Room
          const params = new URLSearchParams(window.location.search);
          const roomParam = params.get('room') || params.get('join');
          if (roomParam && /^[A-Za-z0-9]{4,8}$/.test(roomParam.trim())) {
            const code = roomParam.trim().toUpperCase();
            syncRoomUrl(null);
            set({
              showJoinRoomModal: true,
              joinModalPrefillCode: code,
            });
          }
        }
      }
    );
  });

  socket.on('disconnect', () => {
    set({ connected: false });
  });

  socket.on('connect_error', (err) => {
    set({ connected: false });
    if (err.message === 'UNAUTHORIZED') {
      setStoredToken(null);
      get().initSession();
    }
  });

  socket.on('room:state', (lobby: LobbyState) => {
    const prev = get().lobby;
    const myId = get().user?.id;
    if (myId && lobby?.code) {
      useVoiceStore.getState().prepareRoom(myId, lobby.code);
      syncRoomUrl(lobby.code);
    }
    if (prev && lobby.players.length > prev.players.length) {
      soundEngine.play('playerJoin');
    }
    set((s) => {
      const nextView: AppView =
        lobby.status === 'playing' || lobby.status === 'finished'
          ? 'game'
          : s.activeView === 'game' || s.activeView === 'home' || s.activeView === 'lobby'
            ? 'lobby'
            : s.activeView;
      return { lobby, activeView: nextView, quickPlay: null };
    });
  });

  socket.on('voice:peers', (payload: { roomCode: string; peers: VoicePeerState[] }) => {
    const myId = get().user?.id;
    useVoiceStore.getState().setPeers(payload?.peers ?? [], myId, payload?.roomCode);
  });

  socket.on('game:state', (nextState: SanitizedGameState) => {
    const prev = get().gameState;
    const myId = get().user?.id;

    // Shuffle sound when entering shuffling phase
    if (nextState.phase === 'shuffling' && prev?.phase !== 'shuffling') {
      soundEngine.play('shuffle');
    }

    // Crisp dealing tick for every individual card dealt clockwise
    if (
      nextState.phase === 'dealing' &&
      nextState.lastDealEvent &&
      nextState.lastDealEvent.seq !== prev?.lastDealEvent?.seq
    ) {
      soundEngine.play('cardDeal');
    }

    // Audio & toast cues on state transitions
    if (prev) {
      if (nextState.lastPlay && nextState.lastPlay.playId !== prev.lastPlay?.playId) {
        soundEngine.play('cardPlay');
      }
      if (nextState.phase === 'challenge_reveal' && prev.phase !== 'challenge_reveal') {
        soundEngine.play('challenge');
        const cr = nextState.challengeResult;
        if (cr) {
          useToastStore.getState().push({
            type: cr.wasBluff ? 'warning' : 'success',
            title: cr.wasBluff ? 'BLUFF CAUGHT!' : 'CLAIM WAS TRUE!',
            message: `${cr.loserName} absorbs +${cr.pileSizeTaken} card${
              cr.pileSizeTaken === 1 ? '' : 's'
            } from the pile.`,
          });
        }
        setTimeout(() => {
          if (nextState.challengeResult?.wasBluff) {
            soundEngine.play('bluffCaught');
          } else {
            soundEngine.play('truthConfirmed');
          }
        }, 700);
      }
      if (
        nextState.phase === 'playing' &&
        nextState.currentTurnPlayerId === myId &&
        (prev.currentTurnPlayerId !== myId || prev.phase !== 'playing')
      ) {
        soundEngine.play('turnAlert');
      }
      if (nextState.phase === 'finished' && prev.phase !== 'finished') {
        if (nextState.winner?.winnerId === myId) {
          soundEngine.play('win');
        } else {
          soundEngine.play('loss');
        }
      }
    }

    set({ gameState: nextState, activeView: 'game', quickPlay: null });
  });

  socket.on('game:cleared', () => {
    set({ gameState: null, activeView: 'lobby' });
  });

  socket.on('room:chat_history', (payload: { roomCode: string; messages: ChatMessage[] }) => {
    set({ chatMessages: payload?.messages ?? [] });
  });

  socket.on('room:chat', (msg: ChatMessage) => {
    soundEngine.play('voicePhrase');
    set((s) => ({ chatMessages: [...s.chatMessages.slice(-59), msg] }));
  });

  socket.on('room:reaction', (event: ReactionEvent) => {
    if (event.phrase) {
      soundEngine.play('voicePhrase');
    }
    set((s) => ({ reactions: [...s.reactions.slice(-18), event] }));
    setTimeout(() => {
      set((s) => ({ reactions: s.reactions.filter((r) => r.id !== event.id) }));
    }, 3600);
  });

  socket.on('room:notification', (payload: { type?: 'info' | 'warning'; message: string }) => {
    useToastStore.getState().push({
      type: payload.type ?? 'info',
      message: payload.message,
    });
  });

  socket.on('room:kicked', (payload: { reason: string }) => {
    useVoiceStore.getState().resetOnLeaveRoom();
    set({ lobby: null, gameState: null, activeView: 'home' });
    useToastStore.getState().push({
      type: 'error',
      title: 'Removed from Room',
      message: payload.reason,
    });
  });

  socket.on('quickplay:status', (status: QuickPlayStatus) => {
    set({ quickPlay: status });
  });

  socket.on('quickplay:matched', () => {
    soundEngine.play('playerJoin');
    set({ quickPlay: null });
    useToastStore.getState().push({
      type: 'success',
      title: 'Match Found!',
      message: 'Entering your Quick Play table...',
    });
  });

  socket.on('profile:updated', (profile: UserProfile) => {
    set({ user: profile });
  });
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  initialized: false,
  connected: false,
  token: null,
  user: null,
  matchHistory: [],
  activeView: 'home',

  lobby: null,
  gameState: null,
  reactions: [],
  chatMessages: [],
  quickPlay: null,

  showCreateRoomModal: false,
  showJoinRoomModal: false,
  joinModalPrefillCode: '',
  showBotsModal: false,
  showSettingsModal: false,
  showAuthModal: false,

  initSession: async () => {
    let token = getStoredToken();
    let user: UserProfile | null = null;
    let history: MatchHistoryItem[] = [];

    if (token) {
      try {
        const me = await api.getMe(token);
        user = me.user;
        history = me.history;
      } catch {
        token = null;
        setStoredToken(null);
      }
    }

    if (!token || !user) {
      const guest = await api.createGuest();
      token = guest.token;
      user = guest.user;
      setStoredToken(token);
    }

    set({ token, user, matchHistory: history, activeView: loadSavedView(), initialized: true });
    attachSocketListeners(token, set, get);

    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('join');
    if (joinCode && /^[A-Za-z0-9]{4,8}$/.test(joinCode.trim())) {
      set({
        showJoinRoomModal: true,
        joinModalPrefillCode: joinCode.trim().toUpperCase(),
      });
      const url = new URL(window.location.href);
      url.searchParams.delete('join');
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  },

  setView: (view) => {
    soundEngine.play('click');
    saveNonGameView(view);
    set({ activeView: view });
  },

  setModal: (modal, open, prefillCode) => {
    switch (modal) {
      case 'createRoom':
        set({ showCreateRoomModal: open });
        break;
      case 'joinRoom':
        set({
          showJoinRoomModal: open,
          joinModalPrefillCode: prefillCode ?? (open ? get().joinModalPrefillCode : ''),
        });
        break;
      case 'bots':
        set({ showBotsModal: open });
        break;
      case 'settings':
        set({ showSettingsModal: open });
        break;
      case 'auth':
        set({ showAuthModal: open });
        break;
    }
  },

  login: async (identifier, password) => {
    useVoiceStore.getState().resetOnLeaveRoom();
    const res = await api.login({ identifier, password });
    setStoredToken(res.token);
    const me = await api.getMe(res.token);
    set({
      token: res.token,
      user: me.user,
      matchHistory: me.history,
      showAuthModal: false,
      lobby: null,
      gameState: null,
    });
    attachSocketListeners(res.token, set, get);
    useToastStore.getState().push({
      type: 'success',
      title: 'Welcome back',
      message: `Signed in as ${me.user.username}.`,
    });
  },

  register: async (payload) => {
    const res = await api.register(payload);
    setStoredToken(res.token);
    const me = await api.getMe(res.token);
    set({
      token: res.token,
      user: me.user,
      matchHistory: me.history,
      showAuthModal: false,
    });
    attachSocketListeners(res.token, set, get);
    useToastStore.getState().push({
      type: 'success',
      title: 'Account Ready',
      message: `Welcome to BLUFFED, ${me.user.username}!`,
    });
  },

  updateProfile: async (payload) => {
    const res = await api.updateProfile(payload);
    set({ user: res.user });
    useToastStore.getState().push({
      type: 'success',
      message: 'Profile updated.',
    });
  },

  logoutAndReGuest: async () => {
    useVoiceStore.getState().resetOnLeaveRoom();
    disconnectSocket();
    setStoredToken(null);
    set({ lobby: null, gameState: null, activeView: 'home', quickPlay: null });
    await get().initSession();
    useToastStore.getState().push({
      type: 'info',
      message: 'Signed out. Playing with a fresh guest session.',
    });
  },

  refreshProfile: async () => {
    const token = get().token;
    if (!token) return;
    try {
      const me = await api.getMe(token);
      set({ user: me.user, matchHistory: me.history });
    } catch {
      // ignore
    }
  },

  createPrivateRoom: async (payload) => {
    useVoiceStore.getState().resetOnLeaveRoom();
    const res = await emitAck<{ ok: boolean; lobby?: LobbyState; error?: string }>(
      'room:create',
      payload
    );
    if (!res.ok) throw new Error(res.error || 'Could not create room.');
    set({
      lobby: res.lobby ?? null,
      gameState: null,
      showCreateRoomModal: false,
      activeView: 'lobby',
    });
    soundEngine.play('playerJoin');
  },

  joinRoom: async (code, password, asSpectator) => {
    useVoiceStore.getState().resetOnLeaveRoom();
    const res = await emitAck<{ ok: boolean; lobby?: LobbyState; error?: string }>('room:join', {
      code,
      password,
      asSpectator,
    });
    if (!res.ok) throw new Error(res.error || 'Could not join room.');
    set({
      lobby: res.lobby ?? null,
      showJoinRoomModal: false,
      joinModalPrefillCode: '',
      activeView: res.lobby?.status === 'lobby' ? 'lobby' : 'game',
    });
    soundEngine.play('playerJoin');
  },

  createBotMatch: async (payload) => {
    useVoiceStore.getState().resetOnLeaveRoom();
    const res = await emitAck<{ ok: boolean; lobby?: LobbyState; error?: string }>(
      'room:create_bots',
      payload
    );
    if (!res.ok) throw new Error(res.error || 'Could not start AI table.');
    set({
      lobby: res.lobby ?? null,
      showBotsModal: false,
      activeView: 'game',
    });
    soundEngine.play('playerJoin');
  },

  leaveRoom: async () => {
    useVoiceStore.getState().resetOnLeaveRoom();
    syncRoomUrl(null);
    saveNonGameView('home');
    try {
      await emitAck('room:leave');
    } catch {
      // ignore
    }
    set({ lobby: null, gameState: null, chatMessages: [], activeView: 'home' });
  },

  toggleReady: async () => {
    const res = await emitAck<{ ok: boolean; error?: string }>('room:toggle_ready');
    if (!res.ok && res.error) {
      useToastStore.getState().push({ type: 'error', message: res.error });
    } else {
      soundEngine.play('click');
    }
  },

  addBotToLobby: async (personality) => {
    const res = await emitAck<{ ok: boolean; error?: string }>('room:add_bot', { personality });
    if (!res.ok && res.error) {
      useToastStore.getState().push({ type: 'error', message: res.error });
    } else {
      soundEngine.play('playerJoin');
    }
  },

  kickPlayer: async (targetId) => {
    const res = await emitAck<{ ok: boolean; error?: string }>('room:kick', { targetId });
    if (!res.ok && res.error) {
      useToastStore.getState().push({ type: 'error', message: res.error });
    }
  },

  updateRoomSettings: async (updates) => {
    const res = await emitAck<{ ok: boolean; error?: string }>('room:update_settings', updates);
    if (!res.ok) throw new Error(res.error || 'Failed to update settings.');
    useToastStore.getState().push({ type: 'success', message: 'Room settings updated.' });
  },

  startGame: async () => {
    const res = await emitAck<{ ok: boolean; error?: string }>('room:start');
    if (!res.ok && res.error) {
      useToastStore.getState().push({ type: 'warning', message: res.error });
    }
  },

  triggerManualDeal: async () => {
    const res = await emitAck<{ ok: boolean; error?: string }>('game:trigger_deal');
    if (!res.ok && res.error) {
      useToastStore.getState().push({ type: 'warning', message: res.error });
    }
  },

  returnToLobby: async () => {
    const res = await emitAck<{ ok: boolean; error?: string }>('room:return_lobby');
    if (!res.ok && res.error) {
      useToastStore.getState().push({ type: 'error', message: res.error });
    }
  },

  startQuickPlay: async () => {
    useVoiceStore.getState().resetOnLeaveRoom();
    const res = await emitAck<{ ok: boolean; status?: QuickPlayStatus; error?: string }>(
      'quickplay:join'
    );
    if (!res.ok) {
      useToastStore.getState().push({ type: 'error', message: res.error || 'Matchmaking error' });
      return;
    }
    set({
      quickPlay: res.status ?? { searching: true, queueSize: 1, minPlayers: 2, estimatedWaitSec: 10 },
    });
  },

  cancelQuickPlay: async () => {
    try {
      await emitAck('quickplay:leave');
    } catch {
      // ignore
    }
    set({ quickPlay: null });
  },

  quickPlayFillBots: async () => {
    const res = await emitAck<{ ok: boolean; error?: string }>('quickplay:fill_bots');
    if (!res.ok && res.error) {
      useToastStore.getState().push({ type: 'error', message: res.error });
    } else {
      set({ quickPlay: null });
    }
  },

  playCards: async (cardIds, declaredRank) => {
    const res = await emitAck<{ ok: boolean; error?: string }>('game:play', {
      cardIds,
      declaredRank,
    });
    if (!res.ok && res.error) {
      useToastStore.getState().push({ type: 'error', message: res.error });
    }
  },

  passTurn: async () => {
    const res = await emitAck<{ ok: boolean; error?: string }>('game:pass');
    if (!res.ok && res.error) {
      useToastStore.getState().push({ type: 'error', message: res.error });
    } else {
      soundEngine.play('click');
    }
  },

  acceptClaim: async () => {
    await get().passTurn();
  },

  challengePlay: async () => {
    const res = await emitAck<{ ok: boolean; error?: string }>('game:challenge');
    if (!res.ok && res.error) {
      useToastStore.getState().push({ type: 'error', message: res.error });
    }
  },

  sendReaction: (emoji) => {
    const s = getSocket();
    if (!s?.connected) return;
    s.emit('room:react', { emoji });
    soundEngine.play('click');
  },

  sendVoicePhrase: (phrase) => {
    const s = getSocket();
    if (!s?.connected) return;
    s.emit('room:voice_phrase', { phrase });
  },

  sendChatMessage: async (payload) => {
    const res = await emitAck<{ ok: boolean; error?: string }>('room:chat', payload);
    if (!res.ok && res.error) {
      useToastStore.getState().push({ type: 'error', message: res.error });
    }
  },
}));
