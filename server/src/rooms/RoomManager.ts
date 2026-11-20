import crypto from 'node:crypto';
import type { Server, Socket } from 'socket.io';
import {
  VOICE_PHRASES,
  type BotPersonality,
  type CardsPerPlayerOption,
  type ChatMessage,
  type CreateRoomPayload,
  type DeckCountOption,
  type Difficulty,
  type DistributionMode,
  type FirstPlayerMode,
  type GameMode,
  type LobbyPlayer,
  type LobbyState,
  type PublicRoomSummary,
  type QuickPlayStatus,
  type Rank,
  type ReactionEmoji,
  type ReactionEvent,
  type RoomSettings,
  type SanitizedGameState,
  type ShuffleSpeed,
  type SpectatorInfo,
  type TurnTimerOption,
  type UserProfile,
  type VoicePeerState,
  type VoicePhrase,
  type VoiceTokenPayload,
} from '../../../shared/types.js';
import { BluffEngine } from '../engine/BluffEngine.js';
import { BOT_ROSTER, decideBotTurn } from '../engine/BotAI.js';
import {
  getTotalBluffsCaughtCount,
  getTotalMatchesCount,
  getUserProfileById,
  getUserReputation,
  recordMatchOutcome,
} from '../db.js';

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DISCONNECT_GRACE_MS = 30000;
const VOICE_TOKEN_TTL_MS = 1000 * 60 * 60 * 2; // 2 hours

// Server-only signing secret for room-scoped WebRTC voice tokens (never exposed to clients)
const VOICE_TOKEN_SECRET =
  process.env.VOICE_TOKEN_SECRET || crypto.randomBytes(32).toString('hex');

function getIceServers(): VoiceTokenPayload['iceServers'] {
  const servers: VoiceTokenPayload['iceServers'] = [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun.cloudflare.com:3478',
      ],
    },
  ];
  if (process.env.TURN_URL) {
    const urls = process.env.TURN_URL.split(',')
      .map((u) => u.trim())
      .filter(Boolean);
    servers.push({
      urls: urls.length === 1 ? urls[0] : urls,
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL,
    });
  }
  return servers;
}

interface ManagedRoom {
  code: string;
  mode: GameMode;
  status: 'lobby' | 'playing' | 'finished';
  settings: RoomSettings;
  passwordHash?: string;
  hostId: string;
  players: LobbyPlayer[];
  spectators: SpectatorInfo[];
  voicePeers: Map<string, VoicePeerState>;
  chatHistory: ChatMessage[];
  engine: BluffEngine | null;
  botTimers: Set<ReturnType<typeof setTimeout>>;
  disconnectTimers: Map<string, ReturnType<typeof setTimeout>>;
  createdAt: number;
}

interface QuickPlayEntry {
  user: UserProfile;
  socketId: string;
  joinedAt: number;
}

function hashRoomPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function signVoiceToken(userId: string, roomCode: string, expiresAt: number): string {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, room: roomCode, exp: expiresAt })
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', VOICE_TOKEN_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

function verifyVoiceToken(token: string, expectedUserId: string, expectedRoomCode: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payloadB64, sigB64] = parts;
  const expectedSig = crypto
    .createHmac('sha256', VOICE_TOKEN_SECRET)
    .update(payloadB64)
    .digest('base64url');
  const a = Buffer.from(sigB64);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
      uid: string;
      room: string;
      exp: number;
    };
    return (
      parsed.uid === expectedUserId &&
      parsed.room === expectedRoomCode &&
      parsed.exp > Date.now()
    );
  } catch {
    return false;
  }
}

function sanitizeCardSettings(
  maxPlayers: number,
  deckCountRaw?: DeckCountOption,
  cardsPerPlayerRaw?: CardsPerPlayerOption
): { deckCount: DeckCountOption; cardsPerPlayer: number } {
  const deckCount: DeckCountOption = deckCountRaw === 2 ? 2 : 1;
  const maxPerPlayer = Math.floor((deckCount * 52) / Math.max(2, maxPlayers));
  const raw = Math.floor(Number(cardsPerPlayerRaw ?? 0));
  const cardsPerPlayer = raw <= 0 ? 0 : Math.max(1, Math.min(maxPerPlayer, raw));
  return { deckCount, cardsPerPlayer };
}

export class RoomManager {
  private io: Server;
  private rooms = new Map<string, ManagedRoom>();
  private userToRoom = new Map<string, string>();
  private userSockets = new Map<string, Set<string>>();
  private quickQueue: QuickPlayEntry[] = [];
  private quickPlayTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(io: Server) {
    this.io = io;
  }

  public registerUserSocket(userId: string, socketId: string): void {
    let set = this.userSockets.get(userId);
    if (!set) {
      set = new Set();
      this.userSockets.set(userId, set);
    }
    set.add(socketId);

    const existingCode = this.userToRoom.get(userId);
    if (existingCode) {
      const room = this.rooms.get(existingCode);
      if (room) {
        const pendingTimer = room.disconnectTimers.get(userId);
        if (pendingTimer) {
          clearTimeout(pendingTimer);
          room.disconnectTimers.delete(userId);
        }
        const p = room.players.find((pl) => pl.id === userId);
        if (p) {
          p.connected = true;
          room.engine?.setPlayerConnected(userId, true);
        }
        const s = room.spectators.find((sp) => sp.id === userId);
        if (s) s.connected = true;

        const sock = this.io.sockets.sockets.get(socketId);
        if (sock) {
          sock.join(this.roomChannel(existingCode));
          this.sendStateToUser(room, userId);
        }
        this.broadcastRoomState(room);
      }
    }
  }

  public unregisterUserSocket(userId: string, socketId: string): void {
    const set = this.userSockets.get(userId);
    if (set) {
      set.delete(socketId);
      if (set.size === 0) {
        this.userSockets.delete(userId);
        this.leaveVoiceChannel(userId);
        this.handleUserFullyDisconnected(userId);
      }
    }
    this.leaveQuickPlay(userId);
  }

  public getOnlineUsersCount(): number {
    return this.userSockets.size;
  }

  public getLiveRoomsCount(): number {
    return this.rooms.size;
  }

  public getPlatformStats() {
    const liveMatches = getTotalMatchesCount();
    const liveBluffs = getTotalBluffsCaughtCount();
    const online = this.getOnlineUsersCount();
    return {
      totalGamesPlayed: 12480 + liveMatches,
      activePlayers: Math.max(online, 142 + online),
      liveRooms: this.rooms.size,
      bluffsCaughtToday: 1842 + liveBluffs,
      isLiveWithDemoBaseline: true,
      highlights: [
        {
          id: 'hl-1',
          title: 'Four-Card Final Bluff',
          player: 'SoraNoir',
          detail: 'Cleared a 4-card hand claiming Aces with zero Aces — survived unchallenged.',
          tag: 'UNBELIEVABLE BLUFF',
        },
        {
          id: 'hl-2',
          title: '6/6 Perfect Reads',
          player: 'KaelenPoker',
          detail: 'Called 6 consecutive challenges in a Competitive 6-player table without a miss.',
          tag: 'PERFECT DETECTIVE',
        },
        {
          id: 'hl-3',
          title: '18-Card Pile Trap',
          player: 'NyxVanguard',
          detail: 'Baited an aggressive challenger into absorbing an 18-card discard stack.',
          tag: 'HIGH STAKES',
        },
      ],
    };
  }

  public listPublicRooms(): PublicRoomSummary[] {
    const list: PublicRoomSummary[] = [];
    for (const room of this.rooms.values()) {
      if (room.mode === 'bots') continue;
      list.push({
        code: room.code,
        roomName: room.settings.roomName,
        mode: room.mode,
        playerCount: room.players.length,
        maxPlayers: room.settings.maxPlayers,
        status: room.status,
        hasPassword: room.settings.hasPassword,
        allowSpectators: room.settings.allowSpectators,
        difficulty: room.settings.difficulty,
      });
    }
    return list.sort((a, b) => b.playerCount - a.playerCount);
  }

  public getUserActiveRoom(userId: string): {
    lobby: LobbyState;
    hasGame: boolean;
    gameState: SanitizedGameState | null;
    chatHistory: ChatMessage[];
  } | null {
    const code = this.userToRoom.get(userId);
    if (!code) return null;
    const room = this.rooms.get(code);
    if (!room) {
      this.userToRoom.delete(userId);
      return null;
    }
    this.joinUserSocketsToChannel(userId, code);
    const hasGame = room.engine !== null && room.status !== 'lobby';
    return {
      lobby: this.toLobbyState(room),
      hasGame,
      gameState: hasGame && room.engine ? room.engine.getSanitizedStateForRecipient(userId) : null,
      chatHistory: room.chatHistory,
    };
  }

  private roomChannel(code: string): string {
    return `room:${code}`;
  }

  private generateUniqueCode(): string {
    for (let attempt = 0; attempt < 50; attempt++) {
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += ROOM_ALPHABET[crypto.randomInt(ROOM_ALPHABET.length)];
      }
      if (!this.rooms.has(code)) return code;
    }
    return `B${Date.now().toString(36).slice(-5).toUpperCase()}`;
  }

  private joinUserSocketsToChannel(userId: string, code: string): void {
    const sockets = this.userSockets.get(userId);
    if (!sockets) return;
    for (const sid of sockets) {
      this.io.sockets.sockets.get(sid)?.join(this.roomChannel(code));
    }
  }

  private leaveUserSocketsFromChannel(userId: string, code: string): void {
    const sockets = this.userSockets.get(userId);
    if (!sockets) return;
    for (const sid of sockets) {
      this.io.sockets.sockets.get(sid)?.leave(this.roomChannel(code));
    }
  }

  private emitToUser(userId: string, event: string, payload: unknown): void {
    const sockets = this.userSockets.get(userId);
    if (!sockets) return;
    for (const sid of sockets) {
      this.io.to(sid).emit(event, payload);
    }
  }

  private toLobbyState(room: ManagedRoom): LobbyState {
    return {
      code: room.code,
      mode: room.mode,
      status: room.status,
      settings: { ...room.settings },
      hostId: room.hostId,
      players: room.players.map((p) => ({ ...p, reputation: { ...p.reputation } })),
      spectators: room.spectators.map((s) => ({ ...s })),
      createdAt: room.createdAt,
    };
  }

  private broadcastVoicePeers(room: ManagedRoom): void {
    const peers = Array.from(room.voicePeers.values());
    this.io.to(this.roomChannel(room.code)).emit('voice:peers', {
      roomCode: room.code,
      peers,
    });
  }

  private sendStateToUser(room: ManagedRoom, userId: string): void {
    this.emitToUser(userId, 'room:state', this.toLobbyState(room));
    this.emitToUser(userId, 'room:chat_history', {
      roomCode: room.code,
      messages: room.chatHistory,
    });
    this.emitToUser(userId, 'voice:peers', {
      roomCode: room.code,
      peers: Array.from(room.voicePeers.values()),
    });
    if (room.engine) {
      const sanitized = room.engine.getSanitizedStateForRecipient(userId);
      this.emitToUser(userId, 'game:state', sanitized);
    }
  }

  private broadcastRoomState(room: ManagedRoom): void {
    const lobby = this.toLobbyState(room);
    this.io.to(this.roomChannel(room.code)).emit('room:state', lobby);

    if (room.engine) {
      for (const p of room.players) {
        if (!p.isBot) {
          this.emitToUser(p.id, 'game:state', room.engine.getSanitizedStateForRecipient(p.id));
        }
      }
      for (const s of room.spectators) {
        this.emitToUser(s.id, 'game:state', room.engine.getSanitizedStateForRecipient(s.id));
      }
    }
  }

  private clearBotTimers(room: ManagedRoom): void {
    for (const t of room.botTimers) clearTimeout(t);
    room.botTimers.clear();
  }

  private isMemberOfRoom(room: ManagedRoom, userId: string): boolean {
    return (
      room.players.some((p) => p.id === userId && !p.isBot) ||
      room.spectators.some((s) => s.id === userId)
    );
  }

  // ---- ROOM CREATION & MANAGEMENT ----

  public createPrivateRoom(
    user: UserProfile,
    payload: CreateRoomPayload
  ): { ok: true; lobby: LobbyState } | { ok: false; error: string } {
    this.leaveCurrentRoom(user.id);
    this.leaveQuickPlay(user.id);

    const roomName = (payload.roomName || `${user.username}'s Table`).trim().slice(0, 32);
    const maxPlayers = Math.max(2, Math.min(6, Math.round(payload.maxPlayers || 4)));
    const { deckCount, cardsPerPlayer } = sanitizeCardSettings(
      maxPlayers,
      payload.deckCount,
      payload.cardsPerPlayer
    );
    const distributionMode: DistributionMode =
      payload.distributionMode === 'manual' ? 'manual' : 'automatic';
    const validSpeeds: ShuffleSpeed[] = ['slow', 'normal', 'fast'];
    const shuffleSpeed: ShuffleSpeed = validSpeeds.includes(payload.shuffleSpeed ?? 'normal')
      ? (payload.shuffleSpeed ?? 'normal')
      : 'normal';
    const firstPlayerMode: FirstPlayerMode =
      payload.firstPlayerMode === 'host_selected' ? 'host_selected' : 'random';
    const validTimers: TurnTimerOption[] = [15, 30, 45];
    const turnTimer = validTimers.includes(payload.turnTimer) ? payload.turnTimer : 30;
    const difficulty: Difficulty = payload.difficulty === 'competitive' ? 'competitive' : 'casual';
    const trimmedPass = payload.password?.trim() || '';

    const code = this.generateUniqueCode();
    const hostPlayer: LobbyPlayer = {
      id: user.id,
      username: user.username,
      avatar: user.avatar,
      isHost: true,
      isReady: true,
      isBot: false,
      connected: true,
      reputation: getUserReputation(user.id),
    };

    const room: ManagedRoom = {
      code,
      mode: 'private',
      status: 'lobby',
      settings: {
        roomName,
        maxPlayers,
        cardsPerPlayer,
        deckCount,
        distributionMode,
        shuffleSpeed,
        firstPlayerMode,
        firstPlayerId: firstPlayerMode === 'host_selected' ? (payload.firstPlayerId ?? user.id) : null,
        difficulty,
        turnTimer,
        allowSpectators: Boolean(payload.allowSpectators),
        enableBots: Boolean(payload.enableBots),
        hasPassword: trimmedPass.length > 0,
      },
      passwordHash: trimmedPass.length > 0 ? hashRoomPassword(trimmedPass) : undefined,
      hostId: user.id,
      players: [hostPlayer],
      spectators: [],
      voicePeers: new Map(),
      chatHistory: [],
      engine: null,
      botTimers: new Set(),
      disconnectTimers: new Map(),
      createdAt: Date.now(),
    };

    this.rooms.set(code, room);
    this.userToRoom.set(user.id, code);
    this.joinUserSocketsToChannel(user.id, code);
    this.broadcastRoomState(room);

    return { ok: true, lobby: this.toLobbyState(room) };
  }

  public createBotMatch(
    user: UserProfile,
    options: {
      bots: BotPersonality[];
      cardsPerPlayer: CardsPerPlayerOption;
      deckCount?: DeckCountOption;
      shuffleSpeed?: ShuffleSpeed;
      turnTimer: TurnTimerOption;
      difficulty: Difficulty;
    }
  ): { ok: true; lobby: LobbyState } | { ok: false; error: string } {
    this.leaveCurrentRoom(user.id);
    this.leaveQuickPlay(user.id);

    const botList = options.bots.slice(0, 5);
    if (botList.length < 1) {
      return { ok: false, error: 'Select at least 1 bot opponent.' };
    }

    const code = this.generateUniqueCode();
    const players: LobbyPlayer[] = [
      {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        isHost: true,
        isReady: true,
        isBot: false,
        connected: true,
        reputation: getUserReputation(user.id),
      },
    ];

    botList.forEach((personality, idx) => {
      const template = BOT_ROSTER[idx % BOT_ROSTER.length];
      players.push({
        id: `bot_${code}_${idx}_${crypto.randomInt(1000)}`,
        username: template.name,
        avatar: template.avatar,
        isHost: false,
        isReady: true,
        isBot: true,
        botPersonality: personality,
        connected: true,
        reputation: {
          successfulBluffs: 12 + idx * 5,
          failedBluffs: 4 + idx * 2,
          correctChallenges: 10 + idx * 4,
          wrongChallenges: 3 + idx,
        },
      });
    });

    const { deckCount, cardsPerPlayer } = sanitizeCardSettings(
      players.length,
      options.deckCount,
      options.cardsPerPlayer
    );

    const room: ManagedRoom = {
      code,
      mode: 'bots',
      status: 'lobby',
      settings: {
        roomName: 'AI Practice Table',
        maxPlayers: players.length,
        cardsPerPlayer,
        deckCount,
        distributionMode: 'automatic',
        shuffleSpeed: options.shuffleSpeed ?? 'fast',
        firstPlayerMode: 'random',
        firstPlayerId: null,
        difficulty: options.difficulty,
        turnTimer: options.turnTimer,
        allowSpectators: false,
        enableBots: true,
        hasPassword: false,
      },
      hostId: user.id,
      players,
      spectators: [],
      voicePeers: new Map(),
      chatHistory: [],
      engine: null,
      botTimers: new Set(),
      disconnectTimers: new Map(),
      createdAt: Date.now(),
    };

    this.rooms.set(code, room);
    this.userToRoom.set(user.id, code);
    this.joinUserSocketsToChannel(user.id, code);

    this.startGameInRoom(room);
    return { ok: true, lobby: this.toLobbyState(room) };
  }

  public joinRoom(
    user: UserProfile,
    codeRaw: string,
    password?: string,
    asSpectator?: boolean
  ): { ok: true; lobby: LobbyState } | { ok: false; error: string } {
    const code = codeRaw.trim().toUpperCase();
    const room = this.rooms.get(code);
    if (!room) {
      return { ok: false, error: `Room "${code}" was not found.` };
    }

    if (
      room.players.some((p) => p.id === user.id) ||
      room.spectators.some((s) => s.id === user.id)
    ) {
      this.userToRoom.set(user.id, code);
      this.joinUserSocketsToChannel(user.id, code);
      this.sendStateToUser(room, user.id);
      return { ok: true, lobby: this.toLobbyState(room) };
    }

    if (room.passwordHash) {
      if (!password || hashRoomPassword(password.trim()) !== room.passwordHash) {
        return { ok: false, error: 'Incorrect room password.' };
      }
    }

    this.leaveCurrentRoom(user.id);
    this.leaveQuickPlay(user.id);

    const wantsSpectator =
      Boolean(asSpectator) ||
      room.status !== 'lobby' ||
      room.players.length >= room.settings.maxPlayers;

    if (wantsSpectator) {
      if (!room.settings.allowSpectators) {
        return {
          ok: false,
          error:
            room.status !== 'lobby'
              ? 'Game is already in progress and spectators are disabled.'
              : 'This room is full.',
        };
      }
      room.spectators.push({
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        connected: true,
      });
      room.engine?.setSpectators(room.spectators);
    } else {
      room.players.push({
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        isHost: false,
        isReady: false,
        isBot: false,
        connected: true,
        reputation: getUserReputation(user.id),
      });
    }

    this.userToRoom.set(user.id, code);
    this.joinUserSocketsToChannel(user.id, code);
    this.sendStateToUser(room, user.id);
    this.broadcastRoomState(room);
    this.io.to(this.roomChannel(code)).emit('room:notification', {
      type: 'info',
      message: `${user.username} joined the ${wantsSpectator ? 'spectator rail' : 'table'}.`,
    });

    return { ok: true, lobby: this.toLobbyState(room) };
  }

  public updateRoomSettings(
    userId: string,
    updates: Partial<CreateRoomPayload>
  ): { ok: true } | { ok: false; error: string } {
    const code = this.userToRoom.get(userId);
    if (!code) return { ok: false, error: 'Not in a room.' };
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'Room not found.' };
    if (room.hostId !== userId) return { ok: false, error: 'Only the host can change settings.' };
    if (room.status !== 'lobby') return { ok: false, error: 'Cannot edit settings mid-game.' };

    if (updates.roomName !== undefined) {
      room.settings.roomName = updates.roomName.trim().slice(0, 32) || room.settings.roomName;
    }
    if (updates.maxPlayers !== undefined) {
      const nextMax = Math.max(2, Math.min(6, Math.round(updates.maxPlayers)));
      if (nextMax < room.players.length) {
        return { ok: false, error: 'Max players cannot be lower than current player count.' };
      }
      room.settings.maxPlayers = nextMax;
    }
    if (updates.deckCount !== undefined || updates.cardsPerPlayer !== undefined) {
      const nextDeck = updates.deckCount ?? room.settings.deckCount;
      const nextCards = updates.cardsPerPlayer ?? room.settings.cardsPerPlayer;
      const sanitized = sanitizeCardSettings(
        Math.max(2, room.players.length, room.settings.maxPlayers),
        nextDeck,
        nextCards
      );
      room.settings.deckCount = sanitized.deckCount;
      room.settings.cardsPerPlayer = sanitized.cardsPerPlayer;
    }
    if (updates.distributionMode !== undefined) {
      room.settings.distributionMode =
        updates.distributionMode === 'manual' ? 'manual' : 'automatic';
    }
    if (updates.shuffleSpeed !== undefined) {
      const valid: ShuffleSpeed[] = ['slow', 'normal', 'fast'];
      if (valid.includes(updates.shuffleSpeed)) {
        room.settings.shuffleSpeed = updates.shuffleSpeed;
      }
    }
    if (updates.firstPlayerMode !== undefined) {
      room.settings.firstPlayerMode =
        updates.firstPlayerMode === 'host_selected' ? 'host_selected' : 'random';
      if (room.settings.firstPlayerMode === 'random') {
        room.settings.firstPlayerId = null;
      }
    }
    if (updates.firstPlayerId !== undefined) {
      const validTarget = room.players.some((p) => p.id === updates.firstPlayerId);
      room.settings.firstPlayerId = validTarget ? updates.firstPlayerId : null;
    }
    if (updates.difficulty !== undefined) {
      room.settings.difficulty = updates.difficulty;
    }
    if (updates.turnTimer !== undefined) {
      room.settings.turnTimer = updates.turnTimer;
    }
    if (updates.allowSpectators !== undefined) {
      room.settings.allowSpectators = Boolean(updates.allowSpectators);
    }
    if (updates.enableBots !== undefined) {
      room.settings.enableBots = Boolean(updates.enableBots);
      if (!room.settings.enableBots) {
        room.players = room.players.filter((p) => !p.isBot);
      }
    }
    if (updates.password !== undefined) {
      const trimmed = updates.password.trim();
      room.settings.hasPassword = trimmed.length > 0;
      room.passwordHash = trimmed.length > 0 ? hashRoomPassword(trimmed) : undefined;
    }

    this.broadcastRoomState(room);
    return { ok: true };
  }

  public toggleReady(userId: string): { ok: true } | { ok: false; error: string } {
    const code = this.userToRoom.get(userId);
    if (!code) return { ok: false, error: 'Not in a room.' };
    const room = this.rooms.get(code);
    if (!room || room.status !== 'lobby') return { ok: false, error: 'Room is not in lobby.' };

    const player = room.players.find((p) => p.id === userId);
    if (!player) return { ok: false, error: 'Spectators cannot toggle ready.' };
    if (player.isHost) {
      player.isReady = true;
    } else {
      player.isReady = !player.isReady;
    }
    this.broadcastRoomState(room);
    return { ok: true };
  }

  public addBotToLobby(
    hostId: string,
    personality: BotPersonality = 'strategic'
  ): { ok: true } | { ok: false; error: string } {
    const code = this.userToRoom.get(hostId);
    if (!code) return { ok: false, error: 'Not in a room.' };
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'Room not found.' };
    if (room.hostId !== hostId) return { ok: false, error: 'Only the host can add bots.' };
    if (room.status !== 'lobby') return { ok: false, error: 'Cannot add bots during a match.' };
    if (!room.settings.enableBots) return { ok: false, error: 'Bots are disabled in room settings.' };
    if (room.players.length >= room.settings.maxPlayers) {
      return { ok: false, error: 'Room is already at max capacity.' };
    }

    const usedNames = new Set(room.players.map((p) => p.username));
    const template =
      BOT_ROSTER.find((b) => !usedNames.has(b.name)) ??
      BOT_ROSTER[room.players.length % BOT_ROSTER.length];

    room.players.push({
      id: `bot_${code}_${crypto.randomInt(100000)}`,
      username: usedNames.has(template.name) ? `${template.name}-${room.players.length}` : template.name,
      avatar: template.avatar,
      isHost: false,
      isReady: true,
      isBot: true,
      botPersonality: personality,
      connected: true,
      reputation: {
        successfulBluffs: 10 + crypto.randomInt(20),
        failedBluffs: 3 + crypto.randomInt(8),
        correctChallenges: 8 + crypto.randomInt(16),
        wrongChallenges: 2 + crypto.randomInt(6),
      },
    });

    this.broadcastRoomState(room);
    return { ok: true };
  }

  public kickPlayer(
    hostId: string,
    targetId: string
  ): { ok: true } | { ok: false; error: string } {
    const code = this.userToRoom.get(hostId);
    if (!code) return { ok: false, error: 'Not in a room.' };
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'Room not found.' };
    if (room.hostId !== hostId) return { ok: false, error: 'Only the host can kick players.' };
    if (targetId === hostId) return { ok: false, error: 'You cannot kick yourself.' };

    const target = room.players.find((p) => p.id === targetId);
    if (!target) return { ok: false, error: 'Player not found.' };

    room.players = room.players.filter((p) => p.id !== targetId);
    if (room.settings.firstPlayerId === targetId) {
      room.settings.firstPlayerId = null;
    }
    if (!target.isBot) {
      this.leaveVoiceChannel(targetId);
      this.userToRoom.delete(targetId);
      this.leaveUserSocketsFromChannel(targetId, code);
      this.emitToUser(targetId, 'room:kicked', {
        code,
        reason: 'You were removed from the room by the host.',
      });
    }

    this.broadcastRoomState(room);
    return { ok: true };
  }

  public startGame(hostId: string): { ok: true } | { ok: false; error: string } {
    const code = this.userToRoom.get(hostId);
    if (!code) return { ok: false, error: 'Not in a room.' };
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'Room not found.' };
    if (room.hostId !== hostId) return { ok: false, error: 'Only the host can start the game.' };
    if (room.status === 'playing') return { ok: false, error: 'Game is already running.' };
    if (room.players.length < 2) {
      return { ok: false, error: 'At least 2 players are needed to start.' };
    }
    const unready = room.players.filter((p) => !p.isBot && !p.isHost && !p.isReady);
    if (unready.length > 0) {
      return {
        ok: false,
        error: `Waiting for ${unready.map((p) => p.username).join(', ')} to ready up.`,
      };
    }

    const totalAvailable = room.settings.deckCount * 52;
    if (
      room.settings.cardsPerPlayer > 0 &&
      room.settings.cardsPerPlayer * room.players.length > totalAvailable
    ) {
      return {
        ok: false,
        error: `Requested ${room.settings.cardsPerPlayer * room.players.length} cards exceeds ${totalAvailable} available cards.`,
      };
    }

    this.startGameInRoom(room);
    return { ok: true };
  }

  public triggerManualDeal(userId: string): { ok: true } | { ok: false; error: string } {
    const code = this.userToRoom.get(userId);
    if (!code) return { ok: false, error: 'Not in a room.' };
    const room = this.rooms.get(code);
    if (!room || !room.engine) return { ok: false, error: 'No active match.' };
    if (room.hostId !== userId) return { ok: false, error: 'Only the room host can deal cards.' };
    return room.engine.beginDealing();
  }

  public returnToLobby(userId: string): { ok: true } | { ok: false; error: string } {
    const code = this.userToRoom.get(userId);
    if (!code) return { ok: false, error: 'Not in a room.' };
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'Room not found.' };
    if (room.hostId !== userId) {
      return { ok: false, error: 'Only the host can reset to the lobby.' };
    }

    this.clearBotTimers(room);
    room.engine?.destroy();
    room.engine = null;
    room.status = 'lobby';
    for (const p of room.players) {
      p.isReady = p.isHost || p.isBot;
      if (!p.isBot) {
        p.reputation = getUserReputation(p.id);
      }
    }

    this.io.to(this.roomChannel(room.code)).emit('game:cleared');
    this.broadcastRoomState(room);
    return { ok: true };
  }

  private startGameInRoom(room: ManagedRoom): void {
    this.clearBotTimers(room);
    room.engine?.destroy();
    room.status = 'playing';

    room.engine = new BluffEngine({
      roomCode: room.code,
      players: room.players.map((p) => ({
        id: p.id,
        username: p.username,
        avatar: p.avatar,
        isBot: p.isBot,
        botPersonality: p.botPersonality,
        connected: p.connected,
      })),
      spectators: room.spectators,
      cardsPerPlayer: room.settings.cardsPerPlayer,
      deckCount: room.settings.deckCount,
      distributionMode: room.settings.distributionMode,
      shuffleSpeed: room.settings.shuffleSpeed,
      firstPlayerMode: room.settings.firstPlayerMode,
      firstPlayerId: room.settings.firstPlayerId,
      turnDurationSec: room.settings.turnTimer,
      callbacks: {
        onStateChanged: () => {
          this.broadcastRoomState(room);
          this.scheduleBotActionsIfNeeded(room);
        },
        onChallengeRevealComplete: () => {
          this.scheduleBotActionsIfNeeded(room);
        },
        onMatchFinished: (winner, participantSummary) => {
          room.status = 'finished';
          this.clearBotTimers(room);
          const unlocked = recordMatchOutcome({
            matchId: `match_${crypto.randomUUID()}`,
            roomCode: room.code,
            mode: room.mode,
            winnerId: winner.winnerId,
            playerCount: room.players.length,
            rounds: winner.totalRounds,
            durationSec: winner.durationSec,
            participants: participantSummary,
          });
          room.engine?.setNewlyUnlockedAchievements(unlocked);

          for (const p of room.players) {
            if (!p.isBot) {
              const updatedProfile = getUserProfileById(p.id);
              if (updatedProfile) {
                p.reputation = getUserReputation(p.id);
                this.emitToUser(p.id, 'profile:updated', updatedProfile);
              }
            }
          }
          this.broadcastRoomState(room);
        },
      },
    });

    this.broadcastRoomState(room);
    this.scheduleBotActionsIfNeeded(room);
  }

  private scheduleBotActionsIfNeeded(room: ManagedRoom): void {
    this.clearBotTimers(room);
    const engine = room.engine;
    if (!engine) return;

    if (engine.getPhase() !== 'playing') return;
    const current = engine.getCurrentTurnPlayer();
    if (!current.isBot) return;

    const lastPlay = engine.getLastPlayPublic();
    const stateView = engine.getSanitizedStateForRecipient(current.id);
    const accusedCaughtBluffs = lastPlay
      ? (stateView.players.find((p) => p.id === lastPlay.playerId)?.bluffMetrics.caughtBluffs ?? 0)
      : 0;

    const decision = decideBotTurn({
      personality: current.botPersonality ?? 'strategic',
      hand: engine.getPlayerHandInternal(current.id),
      requiredRank: engine.getRequiredRank(),
      lastPlay,
      pendingWinnerId: stateView.pendingWinnerId,
      pileCount: engine.getPileCount(),
      accusedCaughtBluffs,
      deckCount: engine.deckCount,
    });

    const timer = setTimeout(() => {
      room.botTimers.delete(timer);
      if (!room.engine || room.engine.getPhase() !== 'playing') return;
      if (room.engine.getCurrentTurnPlayer().id !== current.id) return;

      if ('phrase' in decision && decision.phrase) {
        this.io.to(this.roomChannel(room.code)).emit('room:reaction', {
          id: `bvp_${Date.now()}_${crypto.randomInt(10000)}`,
          roomCode: room.code,
          playerId: current.id,
          username: current.username,
          phrase: decision.phrase,
          timestamp: Date.now(),
        });
      } else if (decision.reaction) {
        this.emitReaction(room, current.id, current.username, decision.reaction);
      }

      if (decision.action === 'play') {
        room.engine.playCards(current.id, decision.cardIds, decision.declaredRank);
      } else if (decision.action === 'challenge') {
        room.engine.challengePlay(current.id);
      } else {
        room.engine.passTurn(current.id);
      }
    }, decision.delayMs);
    room.botTimers.add(timer);
  }

  public handlePlayCards(
    userId: string,
    cardIds: string[],
    declaredRank?: Rank
  ): { ok: true } | { ok: false; error: string } {
    const code = this.userToRoom.get(userId);
    if (!code) return { ok: false, error: 'You are not in an active room.' };
    const room = this.rooms.get(code);
    if (!room?.engine) return { ok: false, error: 'Game has not started.' };
    return room.engine.playCards(userId, cardIds, declaredRank);
  }

  public handlePassTurn(userId: string): { ok: true } | { ok: false; error: string } {
    const code = this.userToRoom.get(userId);
    if (!code) return { ok: false, error: 'You are not in an active room.' };
    const room = this.rooms.get(code);
    if (!room?.engine) return { ok: false, error: 'Game has not started.' };
    return room.engine.passTurn(userId);
  }

  public handleAcceptClaim(userId: string): { ok: true } | { ok: false; error: string } {
    return this.handlePassTurn(userId);
  }

  public handleChallenge(userId: string): { ok: true } | { ok: false; error: string } {
    const code = this.userToRoom.get(userId);
    if (!code) return { ok: false, error: 'You are not in an active room.' };
    const room = this.rooms.get(code);
    if (!room?.engine) return { ok: false, error: 'Game has not started.' };
    return room.engine.challengePlay(userId);
  }

  public handleReaction(user: UserProfile, emoji: ReactionEmoji): void {
    const valid: ReactionEmoji[] = ['😂', '😈', '🤔', '🔥', '👀'];
    if (!valid.includes(emoji)) return;
    const code = this.userToRoom.get(user.id);
    if (!code) return;
    const room = this.rooms.get(code);
    if (!room) return;
    this.emitReaction(room, user.id, user.username, emoji);
  }

  public handleVoicePhrase(user: UserProfile, phrase: VoicePhrase): void {
    if (!(VOICE_PHRASES as readonly string[]).includes(phrase)) return;
    const code = this.userToRoom.get(user.id);
    if (!code) return;
    const room = this.rooms.get(code);
    if (!room) return;
    const payload: ReactionEvent = {
      id: `vp_${Date.now()}_${crypto.randomInt(10000)}`,
      roomCode: room.code,
      playerId: user.id,
      username: user.username,
      phrase,
      timestamp: Date.now(),
    };
    this.io.to(this.roomChannel(room.code)).emit('room:reaction', payload);
  }

  public handleChatMessage(
    user: UserProfile,
    payload: {
      text: string;
      memeId?: string;
      memeTitle?: string;
      memeImage?: string;
      memeTag?: string;
    }
  ): { ok: true } | { ok: false; error: string } {
    const code = this.userToRoom.get(user.id);
    if (!code) return { ok: false, error: 'You are not in a room.' };
    const room = this.rooms.get(code);
    if (!room || !this.isMemberOfRoom(room, user.id)) {
      return { ok: false, error: 'Unauthorized room chat.' };
    }
    const text = String(payload?.text ?? '').trim().slice(0, 220);
    if (!text) return { ok: false, error: 'Message cannot be empty.' };

    // Allow safe local /images/ paths or verified Imgflip real meme CDN URLs
    const safeMemeImage =
      typeof payload.memeImage === 'string' &&
      (payload.memeImage.startsWith('/images/') ||
        /^https:\/\/i\.imgflip\.com\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|gif|webp)$/.test(
          payload.memeImage
        ))
        ? payload.memeImage.slice(0, 120)
        : undefined;

    const msg: ChatMessage = {
      id: `msg_${Date.now()}_${crypto.randomInt(100000)}`,
      roomCode: room.code,
      senderId: user.id,
      senderName: user.username,
      senderAvatar: user.avatar,
      text,
      memeId: payload.memeId ? String(payload.memeId).slice(0, 40) : undefined,
      memeTitle: payload.memeTitle ? String(payload.memeTitle).slice(0, 40) : undefined,
      memeImage: safeMemeImage,
      memeTag: payload.memeTag ? String(payload.memeTag).slice(0, 24) : undefined,
      timestamp: Date.now(),
    };

    room.chatHistory.push(msg);
    if (room.chatHistory.length > 60) {
      room.chatHistory = room.chatHistory.slice(-60);
    }

    this.io.to(this.roomChannel(room.code)).emit('room:chat', msg);
    return { ok: true };
  }

  private emitReaction(
    room: ManagedRoom,
    playerId: string,
    username: string,
    emoji: ReactionEmoji
  ): void {
    const payload: ReactionEvent = {
      id: `rx_${Date.now()}_${crypto.randomInt(10000)}`,
      roomCode: room.code,
      playerId,
      username,
      emoji,
      timestamp: Date.now(),
    };
    this.io.to(this.roomChannel(room.code)).emit('room:reaction', payload);
  }

  // ---- ISOLATED WEBRTC VOICE CHANNEL ----

  public issueVoiceToken(
    userId: string
  ): { ok: true; payload: VoiceTokenPayload } | { ok: false; error: string } {
    const code = this.userToRoom.get(userId);
    if (!code) return { ok: false, error: 'You must be in a room to use voice chat.' };
    const room = this.rooms.get(code);
    if (!room || !this.isMemberOfRoom(room, userId)) {
      return { ok: false, error: 'Unauthorized room voice access.' };
    }
    const expiresAt = Date.now() + VOICE_TOKEN_TTL_MS;
    const token = signVoiceToken(userId, code, expiresAt);
    return {
      ok: true,
      payload: {
        token,
        roomCode: code,
        expiresAt,
        iceServers: getIceServers(),
      },
    };
  }

  public joinVoiceChannel(
    user: UserProfile,
    params: { token: string; micEnabled: boolean; muted: boolean }
  ): { ok: true; peers: VoicePeerState[] } | { ok: false; error: string } {
    const code = this.userToRoom.get(user.id);
    if (!code) return { ok: false, error: 'Not in a room.' };
    const room = this.rooms.get(code);
    if (!room || !this.isMemberOfRoom(room, user.id)) {
      return { ok: false, error: 'You are not a member of this room.' };
    }
    if (!verifyVoiceToken(params.token, user.id, code)) {
      return { ok: false, error: 'Invalid or expired voice session token.' };
    }

    const peerState: VoicePeerState = {
      userId: user.id,
      username: user.username,
      micEnabled: Boolean(params.micEnabled),
      muted: Boolean(params.muted),
      speaking: false,
      connected: true,
    };

    const existingPeers = Array.from(room.voicePeers.values()).filter((p) => p.userId !== user.id);
    room.voicePeers.set(user.id, peerState);
    this.broadcastVoicePeers(room);

    // Notify existing peers in the same room so they know a new voice peer joined
    for (const other of existingPeers) {
      this.emitToUser(other.userId, 'voice:peer_joined', {
        roomCode: code,
        peer: peerState,
      });
    }

    return { ok: true, peers: existingPeers };
  }

  public updateVoiceState(
    userId: string,
    updates: { micEnabled?: boolean; muted?: boolean; speaking?: boolean }
  ): void {
    const code = this.userToRoom.get(userId);
    if (!code) return;
    const room = this.rooms.get(code);
    if (!room) return;
    const peer = room.voicePeers.get(userId);
    if (!peer) return;

    if (updates.micEnabled !== undefined) peer.micEnabled = Boolean(updates.micEnabled);
    if (updates.muted !== undefined) peer.muted = Boolean(updates.muted);
    if (updates.speaking !== undefined) {
      peer.speaking = peer.micEnabled && !peer.muted ? Boolean(updates.speaking) : false;
    }

    this.broadcastVoicePeers(room);
  }

  public relayVoiceSignal(
    fromUserId: string,
    payload: {
      token: string;
      targetUserId: string;
      signalType: 'offer' | 'answer' | 'ice-candidate';
      data: unknown;
    }
  ): { ok: true } | { ok: false; error: string } {
    const code = this.userToRoom.get(fromUserId);
    if (!code) return { ok: false, error: 'Not in a room.' };
    const room = this.rooms.get(code);
    if (!room || !this.isMemberOfRoom(room, fromUserId)) {
      return { ok: false, error: 'Unauthorized voice signaling.' };
    }
    if (!verifyVoiceToken(payload.token, fromUserId, code)) {
      return { ok: false, error: 'Invalid voice token.' };
    }
    if (!this.isMemberOfRoom(room, payload.targetUserId)) {
      return { ok: false, error: 'Target peer is not in this room.' };
    }

    this.emitToUser(payload.targetUserId, 'voice:signal', {
      roomCode: code,
      fromUserId,
      signalType: payload.signalType,
      data: payload.data,
    });
    return { ok: true };
  }

  /**
   * Free zero-config fallback audio relay for peers behind strict 4G/5G or NAT firewalls
   * where direct WebRTC P2P cannot connect. Strictly room-isolated, token-authenticated,
   * and NEVER recorded or stored.
   */
  public relayVoiceAudio(
    fromUserId: string,
    payload: {
      token: string;
      sampleRate: number;
      pcm: ArrayBuffer | Uint8Array | Buffer;
      excludeUserIds?: string[];
    }
  ): void {
    const code = this.userToRoom.get(fromUserId);
    if (!code) return;
    const room = this.rooms.get(code);
    if (!room || !this.isMemberOfRoom(room, fromUserId)) return;
    if (!verifyVoiceToken(payload?.token, fromUserId, code)) return;
    if (!payload.pcm) return;

    // Guard max packet size (~16KB max) to prevent abuse
    const byteLength =
      payload.pcm instanceof ArrayBuffer
        ? payload.pcm.byteLength
        : Buffer.isBuffer(payload.pcm)
          ? payload.pcm.byteLength
          : payload.pcm.byteLength;
    if (!byteLength || byteLength > 16384) return;

    const excluded = new Set<string>(payload.excludeUserIds ?? []);
    excluded.add(fromUserId);

    const recipients: string[] = [];
    for (const p of room.players) {
      if (!p.isBot && p.connected && !excluded.has(p.id)) {
        recipients.push(p.id);
      }
    }
    for (const s of room.spectators) {
      if (s.connected && !excluded.has(s.id)) {
        recipients.push(s.id);
      }
    }

    for (const targetId of recipients) {
      this.emitToUser(targetId, 'voice:relay_audio', {
        roomCode: code,
        fromUserId,
        sampleRate: payload.sampleRate === 16000 ? 16000 : 16000,
        pcm: payload.pcm,
      });
    }
  }

  public leaveVoiceChannel(userId: string): void {
    const code = this.userToRoom.get(userId);
    if (!code) return;
    const room = this.rooms.get(code);
    if (!room) return;
    if (!room.voicePeers.has(userId)) return;

    room.voicePeers.delete(userId);
    this.io.to(this.roomChannel(code)).emit('voice:peer_left', {
      roomCode: code,
      userId,
    });
    this.broadcastVoicePeers(room);
  }

  // ---- LEAVE / DISCONNECT / HOST MIGRATION ----

  public leaveCurrentRoom(userId: string): void {
    const code = this.userToRoom.get(userId);
    if (!code) return;
    const room = this.rooms.get(code);

    this.leaveVoiceChannel(userId);
    this.userToRoom.delete(userId);
    this.leaveUserSocketsFromChannel(userId, code);
    if (!room) return;

    const timer = room.disconnectTimers.get(userId);
    if (timer) {
      clearTimeout(timer);
      room.disconnectTimers.delete(userId);
    }

    const wasPlayer = room.players.some((p) => p.id === userId);
    const departingName =
      room.players.find((p) => p.id === userId)?.username ??
      room.spectators.find((s) => s.id === userId)?.username ??
      'A player';

    room.spectators = room.spectators.filter((s) => s.id !== userId);
    room.engine?.setSpectators(room.spectators);

    if (wasPlayer) {
      if (room.status === 'playing' && room.engine) {
        const p = room.players.find((pl) => pl.id === userId);
        if (p) {
          p.connected = false;
          p.isBot = true;
          p.botPersonality = 'defensive';
        }
        room.engine.setPlayerConnected(userId, false);
      } else {
        room.players = room.players.filter((p) => p.id !== userId);
        if (room.settings.firstPlayerId === userId) {
          room.settings.firstPlayerId = null;
        }
      }

      if (room.hostId === userId) {
        this.migrateHost(room);
      }
    }

    const humanPlayersRemaining = room.players.filter((p) => !p.isBot && p.connected);
    if (humanPlayersRemaining.length === 0 && room.spectators.length === 0) {
      this.destroyRoom(room);
      return;
    }

    this.broadcastRoomState(room);
    this.io.to(this.roomChannel(code)).emit('room:notification', {
      type: 'info',
      message: `${departingName} left the room.`,
    });
  }

  private handleUserFullyDisconnected(userId: string): void {
    const code = this.userToRoom.get(userId);
    if (!code) return;
    const room = this.rooms.get(code);
    if (!room) return;

    const p = room.players.find((pl) => pl.id === userId);
    if (p) {
      p.connected = false;
      room.engine?.setPlayerConnected(userId, false);
    }
    const s = room.spectators.find((sp) => sp.id === userId);
    if (s) s.connected = false;

    this.broadcastRoomState(room);

    const timer = setTimeout(() => {
      room.disconnectTimers.delete(userId);
      if (this.userSockets.has(userId)) return;

      if (room.status === 'lobby') {
        this.leaveCurrentRoom(userId);
      } else {
        if (room.hostId === userId) {
          this.migrateHost(room);
        }
        const connectedHumans = room.players.filter((pl) => !pl.isBot && pl.connected);
        if (
          connectedHumans.length === 0 &&
          room.spectators.filter((sp) => sp.connected).length === 0
        ) {
          this.destroyRoom(room);
        } else {
          this.broadcastRoomState(room);
        }
      }
    }, DISCONNECT_GRACE_MS);

    room.disconnectTimers.set(userId, timer);
  }

  private migrateHost(room: ManagedRoom): void {
    for (const p of room.players) p.isHost = false;
    const nextHost =
      room.players.find((p) => !p.isBot && p.connected) ??
      room.players.find((p) => !p.isBot);
    if (nextHost) {
      nextHost.isHost = true;
      nextHost.isReady = true;
      room.hostId = nextHost.id;
      this.io.to(this.roomChannel(room.code)).emit('room:notification', {
        type: 'info',
        message: `${nextHost.username} is now the room host.`,
      });
    }
  }

  private destroyRoom(room: ManagedRoom): void {
    this.clearBotTimers(room);
    for (const t of room.disconnectTimers.values()) clearTimeout(t);
    room.disconnectTimers.clear();
    room.voicePeers.clear();
    room.engine?.destroy();
    for (const p of room.players) {
      if (!p.isBot && this.userToRoom.get(p.id) === room.code) {
        this.userToRoom.delete(p.id);
      }
    }
    for (const s of room.spectators) {
      if (this.userToRoom.get(s.id) === room.code) {
        this.userToRoom.delete(s.id);
      }
    }
    this.rooms.delete(room.code);
  }

  // ---- QUICK PLAY MATCHMAKING ----

  public joinQuickPlay(user: UserProfile, socket: Socket): QuickPlayStatus {
    this.leaveCurrentRoom(user.id);
    if (!this.quickQueue.some((q) => q.user.id === user.id)) {
      this.quickQueue.push({ user, socketId: socket.id, joinedAt: Date.now() });
    }
    this.broadcastQuickPlayStatus();
    this.evaluateQuickPlayQueue();
    return this.buildQuickPlayStatus(true);
  }

  public leaveQuickPlay(userId: string): void {
    const before = this.quickQueue.length;
    this.quickQueue = this.quickQueue.filter((q) => q.user.id !== userId);
    if (this.quickQueue.length !== before) {
      if (this.quickQueue.length < 2 && this.quickPlayTimer) {
        clearTimeout(this.quickPlayTimer);
        this.quickPlayTimer = null;
      }
      this.broadcastQuickPlayStatus();
    }
  }

  public launchQuickPlayWithBots(
    user: UserProfile
  ): { ok: true; lobby: LobbyState } | { ok: false; error: string } {
    this.leaveQuickPlay(user.id);
    return this.createBotMatch(user, {
      bots: ['aggressive', 'strategic', 'unpredictable'],
      cardsPerPlayer: 7,
      deckCount: 1,
      shuffleSpeed: 'fast',
      turnTimer: 30,
      difficulty: 'casual',
    });
  }

  private buildQuickPlayStatus(searching: boolean): QuickPlayStatus {
    return {
      searching,
      queueSize: this.quickQueue.length,
      minPlayers: 2,
      estimatedWaitSec: this.quickQueue.length >= 2 ? 3 : 10,
    };
  }

  private broadcastQuickPlayStatus(): void {
    const status = this.buildQuickPlayStatus(true);
    for (const q of this.quickQueue) {
      this.emitToUser(q.user.id, 'quickplay:status', status);
    }
  }

  private evaluateQuickPlayQueue(): void {
    if (this.quickQueue.length >= 6) {
      if (this.quickPlayTimer) {
        clearTimeout(this.quickPlayTimer);
        this.quickPlayTimer = null;
      }
      this.matchQueuedPlayers();
      return;
    }

    if (this.quickQueue.length >= 2 && !this.quickPlayTimer) {
      this.quickPlayTimer = setTimeout(() => {
        this.quickPlayTimer = null;
        if (this.quickQueue.length >= 2) {
          this.matchQueuedPlayers();
        }
      }, 3500);
    }
  }

  private matchQueuedPlayers(): void {
    const matched = this.quickQueue.splice(0, 6);
    if (matched.length < 2) return;

    const code = this.generateUniqueCode();
    const host = matched[0].user;

    const players: LobbyPlayer[] = matched.map((entry, idx) => ({
      id: entry.user.id,
      username: entry.user.username,
      avatar: entry.user.avatar,
      isHost: idx === 0,
      isReady: true,
      isBot: false,
      connected: true,
      reputation: getUserReputation(entry.user.id),
    }));

    const room: ManagedRoom = {
      code,
      mode: 'quick_play',
      status: 'lobby',
      settings: {
        roomName: 'Quick Play Table',
        maxPlayers: Math.max(2, players.length),
        cardsPerPlayer: 7,
        deckCount: 1,
        distributionMode: 'automatic',
        shuffleSpeed: 'normal',
        firstPlayerMode: 'random',
        firstPlayerId: null,
        difficulty: 'casual',
        turnTimer: 30,
        allowSpectators: true,
        enableBots: false,
        hasPassword: false,
      },
      hostId: host.id,
      players,
      spectators: [],
      voicePeers: new Map(),
      chatHistory: [],
      engine: null,
      botTimers: new Set(),
      disconnectTimers: new Map(),
      createdAt: Date.now(),
    };

    this.rooms.set(code, room);
    for (const entry of matched) {
      this.userToRoom.set(entry.user.id, code);
      this.joinUserSocketsToChannel(entry.user.id, code);
      this.emitToUser(entry.user.id, 'quickplay:matched', { code });
    }

    this.startGameInRoom(room);
    this.broadcastQuickPlayStatus();
  }
}
