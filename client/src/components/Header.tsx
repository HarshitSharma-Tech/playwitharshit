import React from 'react';
import {
  BookOpen,
  Home,
  Settings,
  Swords,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useGameStore, type AppView } from '../store/useGameStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { BrandLogo } from './BrandLogo';
import { AvatarBadge } from './AvatarBadge';
import { MusicPlayerPill } from './MusicPlayerPill';

export const Header: React.FC = () => {
  const { activeView, setView, setModal, user, connected, lobby, gameState } = useGameStore();
  const { soundEnabled, toggleSound } = useSettingsStore();

  const navItems: Array<{ id: AppView; label: string; Icon: React.FC<{ className?: string }> }> = [
    { id: 'home', label: 'Club Lounge', Icon: Home },
    { id: 'how-to-play', label: 'Rulebook', Icon: BookOpen },
    { id: 'leaderboard', label: 'Hall of Fame', Icon: Trophy },
  ];

  const hasActiveTable = Boolean(lobby || gameState);

  return (
    <header className="sticky top-0 z-40 border-b border-[#E6B84C]/15 bg-[#0D0A07]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <BrandLogo onClick={() => setView('home')} />

        {/* Center Navigation */}
        <nav className="hidden md:flex items-center gap-1 rounded-xl bg-[#17120E] p-1 border border-[#E6B84C]/15">
          {navItems.map(({ id, label, Icon }) => {
            const active = activeView === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  active
                    ? 'bg-[#E6B84C]/18 text-[#F6D889] border border-[#E6B84C]/45'
                    : 'text-[#B9A992] hover:text-[#FAF3E3] hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            );
          })}
        </nav>

        {/* Right Controls */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {hasActiveTable && activeView !== 'game' && activeView !== 'lobby' && (
            <button
              type="button"
              onClick={() => setView(gameState ? 'game' : 'lobby')}
              className="gold-btn flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wider transition cursor-pointer"
            >
              <Swords className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Back to Table</span>
            </button>
          )}

          {/* Lounge Radio Song Player */}
          <MusicPlayerPill />

          {/* Live connection dot */}
          <div
            className="hidden sm:flex items-center gap-1.5 rounded-full bg-[#17120E] px-2.5 py-1 border border-[#E6B84C]/18"
            title={connected ? 'Connected to live multiplayer server' : 'Reconnecting...'}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                connected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
              }`}
            />
            <span className="font-[var(--font-mono)] text-[10px] uppercase tracking-wider text-[#B9A992]">
              {connected ? 'LIVE' : 'SYNC'}
            </span>
          </div>

          <button
            type="button"
            onClick={toggleSound}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#17120E] border border-[#E6B84C]/18 text-[#D6C7B2] transition hover:border-[#E6B84C]/55 hover:text-[#F6D889] cursor-pointer"
            aria-label={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4 text-[#E1384B]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setModal('settings', true)}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#17120E] border border-[#E6B84C]/18 text-[#D6C7B2] transition hover:border-[#E6B84C]/55 hover:text-[#F6D889] cursor-pointer"
            aria-label="Open settings"
          >
            <Settings className="h-4 w-4" />
          </button>

          {user && (
            <button
              type="button"
              onClick={() => setView('profile')}
              className={`flex items-center gap-2.5 rounded-xl bg-[#17120E] py-1 pl-1 pr-3 border transition cursor-pointer ${
                activeView === 'profile'
                  ? 'border-[#E6B84C] bg-[#E6B84C]/12'
                  : 'border-[#E6B84C]/20 hover:border-[#E6B84C]/55'
              }`}
            >
              <AvatarBadge avatar={user.avatar} size="xs" />
              <div className="hidden sm:flex flex-col text-left leading-tight">
                <span className="max-w-[110px] truncate text-xs font-bold text-[#FAF3E3]">
                  {user.username}
                </span>
                <span className="font-[var(--font-mono)] text-[10px] text-[#E6B84C]">
                  {user.wins}W · {user.gamesPlayed}G
                </span>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Mobile nav strip */}
      <div className="flex md:hidden items-center justify-around border-t border-[#E6B84C]/10 px-2 py-1.5">
        {navItems.map(({ id, label, Icon }) => {
          const active = activeView === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold cursor-pointer ${
                active ? 'text-[#F6D889] bg-[#E6B84C]/15' : 'text-[#B9A992]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
      </div>
    </header>
  );
};
