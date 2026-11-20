import type {
  LeaderboardCategory,
  LeaderboardEntry,
  MatchHistoryItem,
  PlatformStats,
  PublicRoomSummary,
  UserProfile,
} from '@shared/types';

const TOKEN_STORAGE_KEY = 'bluffed_session_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota errors
  }
}

async function request<T>(
  url: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  const activeToken = token ?? getStoredToken();
  if (activeToken) {
    headers.Authorization = `Bearer ${activeToken}`;
  }

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  createGuest: (username?: string) =>
    request<{ token: string; user: UserProfile }>('/api/auth/guest', {
      method: 'POST',
      body: JSON.stringify({ username }),
    }),

  register: (payload: { username: string; email: string; password: string; avatar?: string }) =>
    request<{ token: string; user: UserProfile }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: { identifier: string; password: string }) =>
    request<{ token: string; user: UserProfile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getMe: (token?: string) =>
    request<{ user: UserProfile; history: MatchHistoryItem[] }>('/api/auth/me', {}, token),

  updateProfile: (payload: { username?: string; avatar?: string }) =>
    request<{ user: UserProfile }>('/api/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  getLeaderboard: (category: LeaderboardCategory) =>
    request<{ category: LeaderboardCategory; entries: LeaderboardEntry[] }>(
      `/api/leaderboard?category=${encodeURIComponent(category)}`
    ),

  getStats: () => request<PlatformStats>('/api/stats'),

  getPublicRooms: () => request<{ rooms: PublicRoomSummary[] }>('/api/rooms/public'),
};
