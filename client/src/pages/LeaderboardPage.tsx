import React, { useEffect, useState } from 'react';
import { Crown, Flame, Medal, Search, Trophy, Zap } from 'lucide-react';
import type { LeaderboardCategory, LeaderboardEntry } from '@shared/types';
import { api } from '../lib/api';
import { useGameStore } from '../store/useGameStore';
import { AvatarBadge } from '../components/AvatarBadge';

const TABS: Array<{ id: LeaderboardCategory; label: string; Icon: React.FC<{ className?: string }> }> = [
  { id: 'global', label: 'Global', Icon: Trophy },
  { id: 'weekly', label: 'Weekly', Icon: Zap },
  { id: 'wins', label: 'Most Wins', Icon: Crown },
  { id: 'bluffers', label: 'Best Bluffers', Icon: Flame },
  { id: 'detectives', label: 'Best Detectives', Icon: Search },
];

export const LeaderboardPage: React.FC = () => {
  const { user } = useGameStore();
  const [category, setCategory] = useState<LeaderboardCategory>('global');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .getLeaderboard(category)
      .then((res) => {
        if (active) setEntries(res.entries);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [category]);

  const top3 = entries.slice(0, 3);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <span className="font-[var(--font-mono)] text-[11px] font-semibold uppercase tracking-[0.22em] text-[#E6B84C]">
            HALL OF DECEPTION
          </span>
          <h1 className="mt-1 font-[var(--font-display)] text-3xl sm:text-4xl font-extrabold text-[#FAF3E3]">
            Leaderboards
          </h1>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-1.5 rounded-2xl bg-[#18130F] p-1.5 border border-white/[0.07]">
          {TABS.map(({ id, label, Icon }) => {
            const active = category === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setCategory(id)}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition cursor-pointer ${
                  active
                    ? 'bg-[#E6B84C] text-[#0B0907]'
                    : 'text-[#B9A992] hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Top 3 Podium */}
      {!loading && top3.length > 0 && (
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {top3.map((entry, idx) => {
            const rankStyle =
              idx === 0
                ? 'border-amber-400/45 bg-gradient-to-b from-[#231D14] to-[#18130F]'
                : idx === 1
                  ? 'border-slate-300/30 bg-[#18130F]'
                  : 'border-amber-700/35 bg-[#18130F]';
            const badgeColor =
              idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-slate-300' : 'text-amber-600';

            return (
              <div key={entry.userId} className={`rounded-2xl border p-5 ${rankStyle}`}>
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1 font-[var(--font-mono)] text-xs font-bold ${badgeColor}`}>
                    <Medal className="h-4 w-4" /> #{entry.rank}
                  </span>
                  {entry.isDemo && (
                    <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-[var(--font-mono)] text-[9px] text-[#B9A992]">
                      DEMO PRO
                    </span>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-3.5">
                  <AvatarBadge avatar={entry.avatar} size="lg" active={idx === 0} />
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold text-[#FAF3E3]">{entry.username}</p>
                    <p className="font-[var(--font-mono)] text-xs text-[#1CD696]">
                      {entry.score.toLocaleString()} PTS
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/[0.07] pt-3 text-center font-[var(--font-mono)]">
                  <div>
                    <p className="text-[10px] text-[#7F87A1]">WINS</p>
                    <p className="text-sm font-bold text-[#FAF3E3]">{entry.wins}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#7F87A1]">BLUFFS</p>
                    <p className="text-sm font-bold text-[#E6B84C]">{entry.successfulBluffs}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#7F87A1]">READS</p>
                    <p className="text-sm font-bold text-[#1CD696]">{entry.correctChallenges}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full Rankings Table */}
      <div className="mt-6 overflow-hidden rounded-2xl surface-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.07] bg-[#15100C] font-[var(--font-mono)] text-[10px] uppercase tracking-wider text-[#B9A992]">
                <th className="px-5 py-3.5">Rank</th>
                <th className="px-5 py-3.5">Player</th>
                <th className="px-5 py-3.5 text-right">Games</th>
                <th className="px-5 py-3.5 text-right">Wins</th>
                <th className="px-5 py-3.5 text-right">Win %</th>
                <th className="px-5 py-3.5 text-right">Bluffs</th>
                <th className="px-5 py-3.5 text-right">Reads</th>
                <th className="px-5 py-3.5 text-right">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={8} className="px-5 py-4">
                        <div className="h-7 animate-pulse rounded-lg bg-white/[0.04]" />
                      </td>
                    </tr>
                  ))
                : entries.map((e) => {
                    const isMe = user?.id === e.userId;
                    return (
                      <tr
                        key={e.userId}
                        className={`transition hover:bg-white/[0.025] ${
                          isMe ? 'bg-[#E6B84C]/10' : ''
                        }`}
                      >
                        <td className="px-5 py-3.5 font-[var(--font-mono)] text-xs font-bold text-[#B9A992]">
                          #{e.rank}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <AvatarBadge avatar={e.avatar} size="xs" />
                            <span className="font-semibold text-[#FAF3E3]">{e.username}</span>
                            {isMe && (
                              <span className="rounded bg-[#E6B84C]/20 px-1.5 py-0.5 font-[var(--font-mono)] text-[9px] font-bold text-[#F6D889]">
                                YOU
                              </span>
                            )}
                            {e.isDemo && (
                              <span className="rounded bg-white/[0.05] px-1.5 py-0.5 font-[var(--font-mono)] text-[9px] text-[#6E7690]">
                                DEMO
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right font-[var(--font-mono)] text-xs text-[#B9A992]">
                          {e.gamesPlayed}
                        </td>
                        <td className="px-5 py-3.5 text-right font-[var(--font-mono)] text-xs font-semibold text-emerald-400">
                          {e.wins}
                        </td>
                        <td className="px-5 py-3.5 text-right font-[var(--font-mono)] text-xs text-[#DFD2BE]">
                          {e.winRate}%
                        </td>
                        <td className="px-5 py-3.5 text-right font-[var(--font-mono)] text-xs text-[#E6B84C]">
                          {e.successfulBluffs}
                        </td>
                        <td className="px-5 py-3.5 text-right font-[var(--font-mono)] text-xs text-[#1CD696]">
                          {e.correctChallenges}
                        </td>
                        <td className="px-5 py-3.5 text-right font-[var(--font-mono)] text-xs font-bold text-[#FAF3E3]">
                          {e.score.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
