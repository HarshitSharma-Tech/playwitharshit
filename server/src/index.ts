import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import { Server } from 'socket.io';
import {
  createGuestAccount,
  getUserBySessionToken,
  loginAccount,
  registerAccount,
  updateUserProfile,
} from './auth.js';
import { getLeaderboard, getUserMatchHistory } from './db.js';
import { RoomManager } from './rooms/RoomManager.js';
import type {
  BotPersonality,
  CardsPerPlayerOption,
  CreateRoomPayload,
  DeckCountOption,
  Difficulty,
  LeaderboardCategory,
  ReactionEmoji,
  ShuffleSpeed,
  TurnTimerOption,
  UserProfile,
  VoicePhrase,
} from '../../shared/types.js';

const PORT = Number(process.env.PORT || 4000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json());

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ['GET', 'POST'],
  },
});

const roomManager = new RoomManager(io);

function extractBearerToken(req: express.Request): string | null {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  return null;
}

// ---- REST API ROUTES ----

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'bluffed-server', timestamp: Date.now() });
});

app.post('/api/auth/guest', (req, res) => {
  try {
    const result = createGuestAccount(req.body?.username);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create guest session.' });
  }
});

app.post('/api/auth/register', (req, res) => {
  try {
    const existingToken = extractBearerToken(req);
    const existingUser = getUserBySessionToken(existingToken);
    const result = registerAccount({
      username: String(req.body?.username || ''),
      email: String(req.body?.email || ''),
      password: String(req.body?.password || ''),
      avatar: req.body?.avatar,
      upgradeGuestUserId: existingUser?.isGuest ? existingUser.id : undefined,
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Registration failed.' });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const result = loginAccount({
      identifier: String(req.body?.identifier || ''),
      password: String(req.body?.password || ''),
    });
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err instanceof Error ? err.message : 'Login failed.' });
  }
});

app.get('/api/auth/me', (req, res) => {
  const token = extractBearerToken(req);
  const user = getUserBySessionToken(token);
  if (!user) {
    res.status(401).json({ error: 'Not authenticated.' });
    return;
  }
  res.json({ user, history: getUserMatchHistory(user.id) });
});

app.patch('/api/profile', (req, res) => {
  const token = extractBearerToken(req);
  const user = getUserBySessionToken(token);
  if (!user) {
    res.status(401).json({ error: 'Not authenticated.' });
    return;
  }
  try {
    const updated = updateUserProfile(user.id, {
      username: req.body?.username,
      avatar: req.body?.avatar,
    });
    res.json({ user: updated });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Update failed.' });
  }
});

app.get('/api/leaderboard', (req, res) => {
  const rawCat = String(req.query.category || 'global');
  const valid: LeaderboardCategory[] = ['global', 'weekly', 'wins', 'bluffers', 'detectives'];
  const category: LeaderboardCategory = valid.includes(rawCat as LeaderboardCategory)
    ? (rawCat as LeaderboardCategory)
    : 'global';
  res.json({ category, entries: getLeaderboard(category, 25) });
});

app.get('/api/stats', (_req, res) => {
  res.json(roomManager.getPlatformStats());
});

app.get('/api/rooms/public', (_req, res) => {
  res.json({ rooms: roomManager.listPublicRooms() });
});

// ---- SOCKET.IO AUTHENTICATION & REALTIME EVENTS ----

io.use((socket, next) => {
  const token =
    typeof socket.handshake.auth?.token === 'string'
      ? socket.handshake.auth.token
      : undefined;
  const user = getUserBySessionToken(token);
  if (!user) {
    next(new Error('UNAUTHORIZED'));
    return;
  }
  socket.data.user = user;
  next();
});

io.on('connection', (socket) => {
  const getFreshUser = (): UserProfile => {
    const token =
      typeof socket.handshake.auth?.token === 'string'
        ? socket.handshake.auth.token
        : undefined;
    return getUserBySessionToken(token) ?? (socket.data.user as UserProfile);
  };

  const user = getFreshUser();
  roomManager.registerUserSocket(user.id, socket.id);

  socket.on('room:create', (payload: CreateRoomPayload, cb?: (res: unknown) => void) => {
    const res = roomManager.createPrivateRoom(getFreshUser(), payload);
    cb?.(res);
  });

  socket.on(
    'room:create_bots',
    (
      payload: {
        bots: BotPersonality[];
        cardsPerPlayer: CardsPerPlayerOption;
        deckCount?: DeckCountOption;
        shuffleSpeed?: ShuffleSpeed;
        turnTimer: TurnTimerOption;
        difficulty: Difficulty;
      },
      cb?: (res: unknown) => void
    ) => {
      const res = roomManager.createBotMatch(getFreshUser(), payload);
      cb?.(res);
    }
  );

  socket.on(
    'room:join',
    (
      payload: { code: string; password?: string; asSpectator?: boolean },
      cb?: (res: unknown) => void
    ) => {
      const res = roomManager.joinRoom(
        getFreshUser(),
        payload?.code || '',
        payload?.password,
        payload?.asSpectator
      );
      cb?.(res);
    }
  );

  socket.on('room:leave', (_payload: unknown, cb?: (res: unknown) => void) => {
    roomManager.leaveCurrentRoom(user.id);
    cb?.({ ok: true });
  });

  socket.on(
    'room:update_settings',
    (payload: Partial<CreateRoomPayload>, cb?: (res: unknown) => void) => {
      cb?.(roomManager.updateRoomSettings(user.id, payload));
    }
  );

  socket.on('room:toggle_ready', (_payload: unknown, cb?: (res: unknown) => void) => {
    cb?.(roomManager.toggleReady(user.id));
  });

  socket.on(
    'room:add_bot',
    (payload: { personality?: BotPersonality }, cb?: (res: unknown) => void) => {
      cb?.(roomManager.addBotToLobby(user.id, payload?.personality ?? 'strategic'));
    }
  );

  socket.on('room:kick', (payload: { targetId: string }, cb?: (res: unknown) => void) => {
    cb?.(roomManager.kickPlayer(user.id, payload?.targetId));
  });

  socket.on('room:start', (_payload: unknown, cb?: (res: unknown) => void) => {
    cb?.(roomManager.startGame(user.id));
  });

  socket.on('room:return_lobby', (_payload: unknown, cb?: (res: unknown) => void) => {
    cb?.(roomManager.returnToLobby(user.id));
  });

  socket.on('room:sync', (_payload: unknown, cb?: (res: unknown) => void) => {
    const active = roomManager.getUserActiveRoom(user.id);
    cb?.({ ok: true, active });
  });

  socket.on('game:play', (payload: { cardIds: string[] }, cb?: (res: unknown) => void) => {
    cb?.(roomManager.handlePlayCards(user.id, payload?.cardIds ?? []));
  });

  socket.on('game:trigger_deal', (_payload: unknown, cb?: (res: unknown) => void) => {
    cb?.(roomManager.triggerManualDeal(user.id));
  });

  socket.on('game:accept', (_payload: unknown, cb?: (res: unknown) => void) => {
    cb?.(roomManager.handleAcceptClaim(user.id));
  });

  socket.on('game:challenge', (_payload: unknown, cb?: (res: unknown) => void) => {
    cb?.(roomManager.handleChallenge(user.id));
  });

  socket.on('room:react', (payload: { emoji: ReactionEmoji }) => {
    roomManager.handleReaction(getFreshUser(), payload?.emoji);
  });

  socket.on('room:voice_phrase', (payload: { phrase: VoicePhrase }) => {
    roomManager.handleVoicePhrase(getFreshUser(), payload?.phrase);
  });

  socket.on(
    'room:chat',
    (
      payload: {
        text: string;
        memeId?: string;
        memeTitle?: string;
        memeImage?: string;
        memeTag?: string;
      },
      cb?: (res: unknown) => void
    ) => {
      cb?.(roomManager.handleChatMessage(getFreshUser(), payload));
    }
  );

  // ---- ISOLATED ROOM VOICE CHANNEL EVENTS ----

  socket.on('voice:get_token', (_payload: unknown, cb?: (res: unknown) => void) => {
    cb?.(roomManager.issueVoiceToken(user.id));
  });

  socket.on(
    'voice:join',
    (
      payload: { token: string; micEnabled: boolean; muted: boolean },
      cb?: (res: unknown) => void
    ) => {
      cb?.(roomManager.joinVoiceChannel(getFreshUser(), payload));
    }
  );

  socket.on(
    'voice:state',
    (payload: { micEnabled?: boolean; muted?: boolean; speaking?: boolean }) => {
      roomManager.updateVoiceState(user.id, payload ?? {});
    }
  );

  socket.on(
    'voice:signal',
    (
      payload: {
        token: string;
        targetUserId: string;
        signalType: 'offer' | 'answer' | 'ice-candidate';
        data: unknown;
      },
      cb?: (res: unknown) => void
    ) => {
      cb?.(roomManager.relayVoiceSignal(user.id, payload));
    }
  );

  socket.on('voice:leave', (_payload: unknown, cb?: (res: unknown) => void) => {
    roomManager.leaveVoiceChannel(user.id);
    cb?.({ ok: true });
  });

  socket.on('quickplay:join', (_payload: unknown, cb?: (res: unknown) => void) => {
    const status = roomManager.joinQuickPlay(getFreshUser(), socket);
    cb?.({ ok: true, status });
  });

  socket.on('quickplay:leave', (_payload: unknown, cb?: (res: unknown) => void) => {
    roomManager.leaveQuickPlay(user.id);
    cb?.({ ok: true });
  });

  socket.on('quickplay:fill_bots', (_payload: unknown, cb?: (res: unknown) => void) => {
    cb?.(roomManager.launchQuickPlayWithBots(getFreshUser()));
  });

  socket.on('disconnect', () => {
    roomManager.unregisterUserSocket(user.id, socket.id);
  });
});

// Serve production frontend bundle if built
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const candidateDistPaths = [
  path.resolve(__dirname, '../../client/dist'),
  path.resolve(__dirname, '../../../../client/dist'),
];
const clientDist = candidateDistPaths.find((p) => fs.existsSync(p));
if (clientDist) {
  app.use(express.static(clientDist));
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

httpServer.listen(PORT, () => {
  console.log(`[BLUFFED] Authoritative multiplayer server running on http://localhost:${PORT}`);
});
