import React, { useEffect, useState } from 'react';
import {
  Award,
  Check,
  Crown,
  Edit3,
  Flame,
  History,
  Search,
  Shield,
  Snowflake,
  Sparkles,
  Trophy,
  UserCheck,
} from 'lucide-react';
import { ACHIEVEMENTS, type AchievementId } from '@shared/types';
import { useGameStore } from '../store/useGameStore';
import { AVATAR_OPTIONS, AvatarBadge } from '../components/AvatarBadge';

const ACH_ICONS: Record<string, React.FC<{ className?: string }>> = {
  trophy: Trophy,
  mask: Sparkles,
  search: Search,
  flame: Flame,
  shield: Shield,
  sparkles: Award,
  snowflake: Snowflake,
  crown: Crown,
};

const RARITY_STYLES = {
  common: 'border-white/15 text-[#DFD2BE]',
  rare: 'border-[#1CD696]/40 text-[#1CD696]',
  epic: 'border-[#E6B84C]/50 text-[#F6D889]',
  legendary: 'border-amber-400/50 text-amber-300',
};

export const ProfilePage: React.FC = () => {
  const { user, matchHistory, refreshProfile, updateProfile, setModal } = useGameStore();
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(user?.username ?? '');
  const [avatar, setAvatar] = useState(user?.avatar ?? 'ace');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setAvatar(user.avatar);
    }
  }, [user]);

  if (!user) return null;

  const unlockedSet = new Set<AchievementId>(user.achievements);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await updateProfile({ username, avatar });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setSaving(false);
    }
  };

  const totalCalls = user.correctChallenges + user.wrongChallenges;
  const detectiveAcc =
    totalCalls > 0 ? Math.round((user.correctChallenges / totalCalls) * 100) : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6 lg:px-8 space-y-6">
      {/* Profile Header Card */}
      <div className="rounded-3xl surface-card p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="flex items-center gap-5">
            <AvatarBadge avatar={user.avatar} size="xl" active />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-[var(--font-display)] text-2xl sm:text-3xl font-extrabold text-[#FAF3E3]">
                  {user.username}
                </h1>
                <span
                  className={`rounded-md px-2 py-0.5 font-[var(--font-mono)] text-[10px] font-bold uppercase ${
                    user.isGuest
                      ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30'
                      : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {user.isGuest ? 'Guest Pass' : 'Verified Player'}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#B9A992]">
                {user.email ? user.email : 'Upgrade your guest pass to save stats across devices.'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(!editing)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#120E0B] border border-white/10 px-3.5 py-2 text-xs font-semibold text-[#DFD2BE] hover:border-[#E6B84C]/50 hover:text-white cursor-pointer"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  {editing ? 'Cancel Edit' : 'Customize Profile'}
                </button>
                {user.isGuest && (
                  <button
                    type="button"
                    onClick={() => setModal('auth', true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#E6B84C] px-4 py-2 text-xs font-bold text-[#0B0907] hover:bg-[#F3CF7A] cursor-pointer"
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    Claim Account / Sign In
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-[#120E0B] border border-white/[0.06] px-6 py-4 text-center">
            <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-widest text-[#B9A992]">
              WIN RATE
            </p>
            <p className="mt-1 font-[var(--font-mono)] text-3xl font-bold text-[#1CD696]">
              {user.winRate}%
            </p>
            <p className="mt-0.5 text-[11px] text-[#6E7690]">
              {user.wins} Wins / {user.gamesPlayed} Matches
            </p>
          </div>
        </div>

        {/* Inline Profile Editor */}
        {editing && (
          <form
            onSubmit={handleSave}
            className="mt-6 rounded-2xl bg-[#120E0B] border border-[#E6B84C]/35 p-5 space-y-4"
          >
            {error && (
              <p className="rounded-lg bg-[#E1384B]/15 px-3 py-2 text-xs text-[#FF9BA6]">{error}</p>
            )}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#B9A992]">
                  Display Username
                </label>
                <input
                  type="text"
                  minLength={3}
                  maxLength={20}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-xl bg-[#18130F] border border-white/10 px-4 py-2.5 text-sm text-[#FAF3E3] focus:border-[#E6B84C] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#B9A992]">
                  Player Emblem
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setAvatar(opt.id)}
                      className="cursor-pointer rounded-xl p-0.5 transition hover:scale-105"
                    >
                      <AvatarBadge avatar={opt.id} size="sm" active={avatar === opt.id} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#1CD696] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-[#0B0907] hover:bg-[#3EE4AB] disabled:opacity-50 cursor-pointer"
              >
                <Check className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Reputation KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Games Played', value: user.gamesPlayed, color: 'text-[#FAF3E3]' },
          { label: 'Total Wins', value: user.wins, color: 'text-emerald-400' },
          { label: 'Successful Bluffs', value: user.successfulBluffs, color: 'text-[#E6B84C]' },
          { label: 'Failed Bluffs', value: user.failedBluffs, color: 'text-[#E1384B]' },
          { label: 'Correct Calls', value: user.correctChallenges, color: 'text-[#1CD696]' },
          { label: 'Call Accuracy', value: `${detectiveAcc}%`, color: 'text-amber-300' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl surface-card p-4">
            <p className="text-[11px] font-medium text-[#B9A992]">{stat.label}</p>
            <p className={`mt-2 font-[var(--font-mono)] text-2xl font-bold ${stat.color}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Achievements Showcase */}
      <div className="rounded-3xl surface-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-[var(--font-heading)] text-lg font-bold text-[#FAF3E3]">
              Achievements
            </h2>
            <p className="text-xs text-[#B9A992]">
              {unlockedSet.size} of {ACHIEVEMENTS.length} unlocked
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {ACHIEVEMENTS.map((ach) => {
            const unlocked = unlockedSet.has(ach.id);
            const Icon = ACH_ICONS[ach.icon] ?? Trophy;
            return (
              <div
                key={ach.id}
                className={`rounded-2xl border p-4 transition ${
                  unlocked
                    ? `bg-[#231A13] ${RARITY_STYLES[ach.rarity]}`
                    : 'bg-[#120E0B]/70 border-white/[0.05] opacity-55'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0B0907] border border-white/10">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="font-[var(--font-mono)] text-[9px] uppercase tracking-wider">
                    {unlocked ? ach.rarity : 'LOCKED'}
                  </span>
                </div>
                <h3 className="mt-3 text-sm font-bold text-[#FAF3E3]">{ach.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-[#B9A992]">{ach.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Match History */}
      <div className="rounded-3xl surface-card p-6">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-[#1CD696]" />
          <h2 className="font-[var(--font-heading)] text-lg font-bold text-[#FAF3E3]">
            Recent Match History
          </h2>
        </div>

        {matchHistory.length === 0 ? (
          <div className="mt-5 rounded-2xl bg-[#120E0B] border border-white/[0.05] p-8 text-center">
            <p className="text-sm font-semibold text-[#DFD2BE]">No matches completed yet</p>
            <p className="mt-1 text-xs text-[#6E7690]">
              Finish a Quick Play, Private Room, or AI Bot match to start logging your career stats.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            {matchHistory.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#120E0B] border border-white/[0.06] px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-lg px-2.5 py-1 font-[var(--font-mono)] text-[10px] font-bold uppercase ${
                      m.won
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-[#E1384B]/15 text-[#FF9BA6] border border-[#E1384B]/30'
                    }`}
                  >
                    {m.won ? 'VICTORY' : 'DEFEAT'}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-[#FAF3E3]">
                      Room {m.roomCode} · {m.playerCount} Players
                    </p>
                    <p className="font-[var(--font-mono)] text-[10px] text-[#6E7690]">
                      {m.mode.replace('_', ' ').toUpperCase()} · {m.rounds} Rounds
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 font-[var(--font-mono)] text-xs text-[#B9A992]">
                  <span>
                    Bluffs: <strong className="text-[#E6B84C]">{m.successfulBluffs}</strong>
                  </span>
                  <span>
                    Reads: <strong className="text-[#1CD696]">{m.correctChallenges}</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
