import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type {
  AchievementId,
  GameMode,
  LeaderboardCategory,
  LeaderboardEntry,
  MatchHistoryItem,
  PlayerReputation,
  UserProfile,
} from '../../shared/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(
  __dirname.includes(`${path.sep}dist${path.sep}`)
    ? path.resolve(__dirname, '../../../data')
    : path.resolve(__dirname, '../data')
);
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'bluffed.sqlite');

export const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    email TEXT UNIQUE COLLATE NOCASE,
    password_hash TEXT,
    avatar TEXT NOT NULL DEFAULT 'ace',
    is_guest INTEGER NOT NULL DEFAULT 1,
    is_demo INTEGER NOT NULL DEFAULT 0,
    games_played INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    successful_bluffs INTEGER NOT NULL DEFAULT 0,
    failed_bluffs INTEGER NOT NULL DEFAULT 0,
    correct_challenges INTEGER NOT NULL DEFAULT 0,
    wrong_challenges INTEGER NOT NULL DEFAULT 0,
    weekly_score INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_achievements (
    user_id TEXT NOT NULL,
    achievement_id TEXT NOT NULL,
    unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, achievement_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    room_code TEXT NOT NULL,
    mode TEXT NOT NULL,
    winner_id TEXT,
    player_count INTEGER NOT NULL,
    rounds INTEGER NOT NULL,
    duration_sec INTEGER NOT NULL,
    played_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS match_participants (
    match_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    won INTEGER NOT NULL DEFAULT 0,
    successful_bluffs INTEGER NOT NULL DEFAULT 0,
    failed_bluffs INTEGER NOT NULL DEFAULT 0,
    correct_challenges INTEGER NOT NULL DEFAULT 0,
    wrong_challenges INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (match_id, user_id),
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
  );
`);

// Seed demo community players once so leaderboards have rich competitive benchmarks
// clearly marked with is_demo = 1.
const demoCount = db.prepare('SELECT COUNT(*) as cnt FROM users WHERE is_demo = 1').get() as { cnt: number };
if (demoCount.cnt === 0) {
  const demoPlayers = [
    {
      id: 'demo-nyx',
      username: 'NyxVanguard',
      avatar: 'phantom',
      games: 148,
      wins: 92,
      sBluff: 214,
      fBluff: 48,
      cChall: 165,
      wChall: 41,
      weekly: 2840,
      achs: ['first_victory', 'master_deceiver', 'perfect_detective', 'unbelievable_bluff', 'table_shark'],
    },
    {
      id: 'demo-kael',
      username: 'KaelenPoker',
      avatar: 'crown',
      games: 132,
      wins: 78,
      sBluff: 186,
      fBluff: 55,
      cChall: 192,
      wChall: 38,
      weekly: 2510,
      achs: ['first_victory', 'perfect_detective', 'last_card_standing', 'table_shark'],
    },
    {
      id: 'demo-sora',
      username: 'SoraNoir',
      avatar: 'viper',
      games: 115,
      wins: 69,
      sBluff: 241,
      fBluff: 61,
      cChall: 121,
      wChall: 49,
      weekly: 2390,
      achs: ['first_victory', 'master_deceiver', 'risk_taker', 'unbelievable_bluff', 'table_shark'],
    },
    {
      id: 'demo-vesper',
      username: 'VesperZero',
      avatar: 'cyber',
      games: 96,
      wins: 54,
      sBluff: 134,
      fBluff: 44,
      cChall: 174,
      wChall: 29,
      weekly: 1980,
      achs: ['first_victory', 'perfect_detective', 'ice_cold', 'table_shark'],
    },
    {
      id: 'demo-mira',
      username: 'MiraVelvet',
      avatar: 'diamond',
      games: 84,
      wins: 47,
      sBluff: 162,
      fBluff: 51,
      cChall: 109,
      wChall: 42,
      weekly: 1720,
      achs: ['first_victory', 'master_deceiver', 'risk_taker', 'table_shark'],
    },
    {
      id: 'demo-dante',
      username: 'DanteSpade',
      avatar: 'ace',
      games: 73,
      wins: 39,
      sBluff: 118,
      fBluff: 49,
      cChall: 132,
      wChall: 45,
      weekly: 1510,
      achs: ['first_victory', 'last_card_standing', 'table_shark'],
    },
    {
      id: 'demo-lyra',
      username: 'LyraCipher',
      avatar: 'oracle',
      games: 64,
      wins: 36,
      sBluff: 104,
      fBluff: 32,
      cChall: 141,
      wChall: 28,
      weekly: 1420,
      achs: ['first_victory', 'perfect_detective', 'ice_cold'],
    },
    {
      id: 'demo-orion',
      username: 'OrionBlaze',
      avatar: 'flame',
      games: 58,
      wins: 29,
      sBluff: 149,
      fBluff: 58,
      cChall: 88,
      wChall: 47,
      weekly: 1190,
      achs: ['first_victory', 'risk_taker', 'master_deceiver'],
    },
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (
      id, username, avatar, is_guest, is_demo,
      games_played, wins, successful_bluffs, failed_bluffs,
      correct_challenges, wrong_challenges, weekly_score
    ) VALUES (?, ?, ?, 0, 1, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertAch = db.prepare(
    'INSERT OR IGNORE INTO user_achievements (user_id, achievement_id) VALUES (?, ?)'
  );

  for (const p of demoPlayers) {
    insertUser.run(
      p.id,
      p.username,
      p.avatar,
      p.games,
      p.wins,
      p.sBluff,
      p.fBluff,
      p.cChall,
      p.wChall,
      p.weekly
    );
    for (const ach of p.achs) {
      insertAch.run(p.id, ach);
    }
  }
}

export interface DbUserRow {
  id: string;
  username: string;
  email: string | null;
  password_hash: string | null;
  avatar: string;
  is_guest: number;
  is_demo: number;
  games_played: number;
  wins: number;
  successful_bluffs: number;
  failed_bluffs: number;
  correct_challenges: number;
  wrong_challenges: number;
  weekly_score: number;
  created_at: string;
}

export function getUserAchievements(userId: string): AchievementId[] {
  const rows = db
    .prepare('SELECT achievement_id FROM user_achievements WHERE user_id = ?')
    .all(userId) as Array<{ achievement_id: string }>;
  return rows.map((r) => r.achievement_id as AchievementId);
}

export function mapUserToProfile(row: DbUserRow): UserProfile {
  const winRate =
    row.games_played > 0 ? Math.round((row.wins / row.games_played) * 1000) / 10 : 0;
  return {
    id: row.id,
    username: row.username,
    email: row.email ?? undefined,
    avatar: row.avatar,
    isGuest: row.is_guest === 1,
    gamesPlayed: row.games_played,
    wins: row.wins,
    winRate,
    successfulBluffs: row.successful_bluffs,
    failedBluffs: row.failed_bluffs,
    correctChallenges: row.correct_challenges,
    wrongChallenges: row.wrong_challenges,
    achievements: getUserAchievements(row.id),
    createdAt: row.created_at,
  };
}

export function getUserById(userId: string): DbUserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as DbUserRow | undefined;
}

export function getUserProfileById(userId: string): UserProfile | undefined {
  const row = getUserById(userId);
  return row ? mapUserToProfile(row) : undefined;
}

export function getUserReputation(userId: string): PlayerReputation {
  const row = getUserById(userId);
  if (!row) {
    return {
      successfulBluffs: 0,
      failedBluffs: 0,
      correctChallenges: 0,
      wrongChallenges: 0,
    };
  }
  return {
    successfulBluffs: row.successful_bluffs,
    failedBluffs: row.failed_bluffs,
    correctChallenges: row.correct_challenges,
    wrongChallenges: row.wrong_challenges,
  };
}

export function recordMatchOutcome(params: {
  matchId: string;
  roomCode: string;
  mode: GameMode;
  winnerId: string;
  playerCount: number;
  rounds: number;
  durationSec: number;
  participants: Array<{
    userId: string;
    isBot: boolean;
    won: boolean;
    stats: PlayerReputation;
    unlockedAchievements: AchievementId[];
  }>;
}): Record<string, AchievementId[]> {
  db.prepare(`
    INSERT INTO matches (id, room_code, mode, winner_id, player_count, rounds, duration_sec)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    params.matchId,
    params.roomCode,
    params.mode,
    params.winnerId,
    params.playerCount,
    params.rounds,
    params.durationSec
  );

  const newlyUnlockedByPlayer: Record<string, AchievementId[]> = {};

  for (const p of params.participants) {
    if (p.isBot) continue;
    const existingUser = getUserById(p.userId);
    if (!existingUser) continue;

    const scoreDelta =
      (p.won ? 100 : 20) +
      p.stats.successfulBluffs * 15 +
      p.stats.correctChallenges * 20 -
      p.stats.failedBluffs * 5;

    db.prepare(`
      UPDATE users
      SET
        games_played = games_played + 1,
        wins = wins + ?,
        successful_bluffs = successful_bluffs + ?,
        failed_bluffs = failed_bluffs + ?,
        correct_challenges = correct_challenges + ?,
        wrong_challenges = wrong_challenges + ?,
        weekly_score = MAX(0, weekly_score + ?)
      WHERE id = ?
    `).run(
      p.won ? 1 : 0,
      p.stats.successfulBluffs,
      p.stats.failedBluffs,
      p.stats.correctChallenges,
      p.stats.wrongChallenges,
      scoreDelta,
      p.userId
    );

    db.prepare(`
      INSERT INTO match_participants (
        match_id, user_id, won, successful_bluffs, failed_bluffs,
        correct_challenges, wrong_challenges
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.matchId,
      p.userId,
      p.won ? 1 : 0,
      p.stats.successfulBluffs,
      p.stats.failedBluffs,
      p.stats.correctChallenges,
      p.stats.wrongChallenges
    );

    // Check career achievements too
    const updatedUser = getUserById(p.userId)!;
    const candidates = new Set<AchievementId>(p.unlockedAchievements);
    if (updatedUser.wins >= 1) candidates.add('first_victory');
    if (updatedUser.wins >= 10) candidates.add('table_shark');
    if (updatedUser.successful_bluffs >= 5) candidates.add('master_deceiver');

    const alreadyHave = new Set(getUserAchievements(p.userId));
    const newlyUnlocked: AchievementId[] = [];
    const insertAch = db.prepare(
      'INSERT OR IGNORE INTO user_achievements (user_id, achievement_id) VALUES (?, ?)'
    );
    for (const ach of candidates) {
      if (!alreadyHave.has(ach)) {
        insertAch.run(p.userId, ach);
        newlyUnlocked.push(ach);
      }
    }
    if (newlyUnlocked.length > 0) {
      newlyUnlockedByPlayer[p.userId] = newlyUnlocked;
    }
  }

  return newlyUnlockedByPlayer;
}

export function getUserMatchHistory(userId: string, limit = 12): MatchHistoryItem[] {
  const rows = db
    .prepare(
      `
      SELECT
        m.id,
        m.room_code,
        m.mode,
        m.played_at,
        m.player_count,
        m.rounds,
        mp.won,
        mp.successful_bluffs,
        mp.correct_challenges
      FROM match_participants mp
      JOIN matches m ON m.id = mp.match_id
      WHERE mp.user_id = ?
      ORDER BY m.played_at DESC
      LIMIT ?
      `
    )
    .all(userId, limit) as Array<{
    id: string;
    room_code: string;
    mode: string;
    played_at: string;
    player_count: number;
    rounds: number;
    won: number;
    successful_bluffs: number;
    correct_challenges: number;
  }>;

  return rows.map((r) => ({
    id: r.id,
    roomCode: r.room_code,
    mode: r.mode as GameMode,
    playedAt: r.played_at,
    won: r.won === 1,
    playerCount: r.player_count,
    rounds: r.rounds,
    successfulBluffs: r.successful_bluffs,
    correctChallenges: r.correct_challenges,
  }));
}

export function getLeaderboard(category: LeaderboardCategory, limit = 25): LeaderboardEntry[] {
  let orderClause = `(wins * 100 + successful_bluffs * 12 + correct_challenges * 18) DESC, wins DESC`;
  switch (category) {
    case 'weekly':
      orderClause = `weekly_score DESC, wins DESC`;
      break;
    case 'wins':
      orderClause = `wins DESC, games_played ASC`;
      break;
    case 'bluffers':
      orderClause = `successful_bluffs DESC, (successful_bluffs - failed_bluffs) DESC`;
      break;
    case 'detectives':
      orderClause = `correct_challenges DESC, (correct_challenges - wrong_challenges) DESC`;
      break;
    case 'global':
    default:
      orderClause = `(wins * 100 + successful_bluffs * 12 + correct_challenges * 18) DESC, wins DESC`;
      break;
  }

  const rows = db
    .prepare(
      `
      SELECT *,
        (wins * 100 + successful_bluffs * 12 + correct_challenges * 18) AS computed_score
      FROM users
      WHERE games_played > 0 OR is_demo = 1
      ORDER BY ${orderClause}
      LIMIT ?
      `
    )
    .all(limit) as unknown as Array<DbUserRow & { computed_score: number }>;

  return rows.map((r, idx) => ({
    rank: idx + 1,
    userId: r.id,
    username: r.username,
    avatar: r.avatar,
    gamesPlayed: r.games_played,
    wins: r.wins,
    winRate: r.games_played > 0 ? Math.round((r.wins / r.games_played) * 1000) / 10 : 0,
    successfulBluffs: r.successful_bluffs,
    correctChallenges: r.correct_challenges,
    score: category === 'weekly' ? r.weekly_score : r.computed_score,
    isDemo: r.is_demo === 1,
  }));
}

export function getTotalMatchesCount(): number {
  const row = db.prepare('SELECT COUNT(*) as cnt FROM matches').get() as { cnt: number };
  return row.cnt;
}

export function getTotalBluffsCaughtCount(): number {
  const row = db
    .prepare('SELECT COALESCE(SUM(correct_challenges), 0) as total FROM users WHERE is_demo = 0')
    .get() as { total: number };
  return row.total;
}
