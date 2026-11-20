import React from 'react';
import { Disc3, Pause, Play, SkipForward } from 'lucide-react';
import { useMusicStore } from '../store/useMusicStore';

interface MusicPlayerPillProps {
  compact?: boolean;
}

export const MusicPlayerPill: React.FC<MusicPlayerPillProps> = ({ compact = false }) => {
  const { playing, track, toggle, nextTrack } = useMusicStore();

  return (
    <div
      className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 transition ${
        playing
          ? 'bg-[#241A10] border-[#E6B84C]/65 shadow-[0_0_20px_rgba(230,184,76,0.22)]'
          : 'bg-[#17120E] border-[#E6B84C]/20'
      }`}
    >
      <button
        type="button"
        onClick={toggle}
        className={`flex h-6 w-6 items-center justify-center rounded-lg transition cursor-pointer ${
          playing
            ? 'bg-[#E6B84C] text-[#140E08]'
            : 'bg-[#E6B84C]/15 text-[#F6D889] hover:bg-[#E6B84C] hover:text-[#140E08]'
        }`}
        title={playing ? 'Pause lounge music' : 'Play lounge music'}
      >
        {playing ? (
          <Pause className="h-3 w-3 fill-current" />
        ) : (
          <Play className="h-3 w-3 fill-current" />
        )}
      </button>

      {!compact && (
        <div className="hidden lg:flex flex-col leading-none pr-1 max-w-[130px]">
          <span className="flex items-center gap-1 truncate text-[10px] font-bold text-[#FAF3E3]">
            <Disc3 className={`h-3 w-3 shrink-0 text-[#E6B84C] ${playing ? 'animate-spin' : ''}`} />
            {track.title}
          </span>
          <span className="mt-0.5 font-[var(--font-mono)] text-[8px] uppercase tracking-wider text-[#B9A992]">
            {playing ? 'SPINNING LIVE' : 'LOUNGE RADIO'}
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={nextTrack}
        className="flex h-6 w-6 items-center justify-center rounded-lg text-[#B9A992] hover:bg-[#E6B84C]/15 hover:text-[#FAF3E3] cursor-pointer"
        title={`Next track (${track.title})`}
      >
        <SkipForward className="h-3 w-3" />
      </button>
    </div>
  );
};
