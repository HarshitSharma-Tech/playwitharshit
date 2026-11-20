import crypto from 'node:crypto';
import { db, getUserById, mapUserToProfile, type DbUserRow } from './db.js';
import type { UserProfile } from '../../shared/types.js';

export const AVATAR_IDS = [
  'ace',
  'crown',
  'phantom',
  'viper',
  'cyber',
  'diamond',
  'oracle',
  'flame',
] as const;

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, expectedHex] = stored.split(':');
  if (!salt || !expectedHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

function createSessionToken(userId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(
    token,
    userId,
    expiresAt
  );
  return token;
}

export function validateUsername(raw: string): { ok: boolean; value: string; error?: string } {
  const trimmed = raw.trim();
  if (trimmed.length < 3 || trimmed.length > 20) {
    return { ok: false, value: trimmed, error: 'Username must be 3–20 characters.' };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return {
      ok: false,
      value: trimmed,
      error: 'Username can only contain letters, numbers, underscores, and hyphens.',
    };
  }
  return { ok: true, value: trimmed };
}

export function createGuestAccount(desiredName?: string): {
  token: string;
  user: UserProfile;
} {
  const adjectives = ['Shadow', 'Velvet', 'Neon', 'Crimson', 'Silver', 'Apex', 'Cipher', 'Royal'];
  const nouns = ['Ace', 'Fox', 'Spade', 'Shark', 'Rogue', 'King', 'Viper', 'Ghost'];

  let username = desiredName?.trim() || '';
  if (!username || !validateUsername(username).ok) {
    const adj = adjectives[crypto.randomInt(adjectives.length)];
    const noun = nouns[crypto.randomInt(nouns.length)];
    const suffix = crypto.randomInt(100, 999);
    username = `${adj}${noun}${suffix}`;
  }

  // Ensure uniqueness
  let candidate = username;
  let attempts = 0;
  while (
    db.prepare('SELECT id FROM users WHERE username = ?').get(candidate) &&
    attempts < 20
  ) {
    candidate = `${username.slice(0, 15)}${crypto.randomInt(100, 9999)}`;
    attempts++;
  }

  const userId = `usr_${crypto.randomUUID()}`;
  const avatar = AVATAR_IDS[crypto.randomInt(AVATAR_IDS.length)];

  db.prepare(
    'INSERT INTO users (id, username, avatar, is_guest, is_demo) VALUES (?, ?, ?, 1, 0)'
  ).run(userId, candidate, avatar);

  const token = createSessionToken(userId);
  const row = getUserById(userId)!;
  return { token, user: mapUserToProfile(row) };
}

export function registerAccount(params: {
  username: string;
  email: string;
  password: string;
  avatar?: string;
  upgradeGuestUserId?: string;
}): { token: string; user: UserProfile } {
  const nameCheck = validateUsername(params.username);
  if (!nameCheck.ok) throw new Error(nameCheck.error);

  const email = params.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Please enter a valid email address.');
  }
  if (params.password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  const existingEmail = db
    .prepare('SELECT id FROM users WHERE email = ?')
    .get(email) as { id: string } | undefined;
  if (existingEmail) {
    throw new Error('An account with this email already exists.');
  }

  const existingName = db
    .prepare('SELECT id FROM users WHERE username = ?')
    .get(nameCheck.value) as { id: string } | undefined;

  const avatar = AVATAR_IDS.includes((params.avatar ?? 'ace') as (typeof AVATAR_IDS)[number])
    ? params.avatar!
    : 'ace';
  const passwordHash = hashPassword(params.password);

  if (params.upgradeGuestUserId) {
    const guest = getUserById(params.upgradeGuestUserId);
    if (guest && guest.is_guest === 1) {
      if (existingName && existingName.id !== guest.id) {
        throw new Error('Username is already taken.');
      }
      db.prepare(
        `UPDATE users SET username = ?, email = ?, password_hash = ?, avatar = ?, is_guest = 0 WHERE id = ?`
      ).run(nameCheck.value, email, passwordHash, avatar, guest.id);
      const token = createSessionToken(guest.id);
      return { token, user: mapUserToProfile(getUserById(guest.id)!) };
    }
  }

  if (existingName) {
    throw new Error('Username is already taken.');
  }

  const userId = `usr_${crypto.randomUUID()}`;
  db.prepare(
    `INSERT INTO users (id, username, email, password_hash, avatar, is_guest, is_demo)
     VALUES (?, ?, ?, ?, ?, 0, 0)`
  ).run(userId, nameCheck.value, email, passwordHash, avatar);

  const token = createSessionToken(userId);
  return { token, user: mapUserToProfile(getUserById(userId)!) };
}

export function loginAccount(params: {
  identifier: string;
  password: string;
}): { token: string; user: UserProfile } {
  const id = params.identifier.trim();
  const row = db
    .prepare('SELECT * FROM users WHERE (email = ? OR username = ?) AND is_demo = 0')
    .get(id.toLowerCase(), id) as DbUserRow | undefined;

  if (!row || !row.password_hash || !verifyPassword(params.password, row.password_hash)) {
    throw new Error('Invalid email/username or password.');
  }

  const token = createSessionToken(row.id);
  return { token, user: mapUserToProfile(row) };
}

export function getUserBySessionToken(token: string | undefined | null): UserProfile | null {
  if (!token) return null;
  const row = db
    .prepare(
      `
      SELECT u.*
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = ? AND s.expires_at > datetime('now')
      `
    )
    .get(token) as DbUserRow | undefined;
  return row ? mapUserToProfile(row) : null;
}

export function updateUserProfile(
  userId: string,
  updates: { username?: string; avatar?: string }
): UserProfile {
  const current = getUserById(userId);
  if (!current) throw new Error('User not found.');

  let nextUsername = current.username;
  if (updates.username !== undefined && updates.username.trim() !== current.username) {
    const check = validateUsername(updates.username);
    if (!check.ok) throw new Error(check.error);
    const conflict = db
      .prepare('SELECT id FROM users WHERE username = ? AND id != ?')
      .get(check.value, userId);
    if (conflict) throw new Error('That username is already taken.');
    nextUsername = check.value;
  }

  let nextAvatar = current.avatar;
  if (
    updates.avatar &&
    AVATAR_IDS.includes(updates.avatar as (typeof AVATAR_IDS)[number])
  ) {
    nextAvatar = updates.avatar;
  }

  db.prepare('UPDATE users SET username = ?, avatar = ? WHERE id = ?').run(
    nextUsername,
    nextAvatar,
    userId
  );

  return mapUserToProfile(getUserById(userId)!);
}
