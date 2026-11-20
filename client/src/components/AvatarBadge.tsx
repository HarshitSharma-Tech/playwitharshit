import React from 'react';
import {
  Crown,
  Diamond,
  Eye,
  Flame,
  Ghost,
  Shield,
  Spade,
  Zap,
} from 'lucide-react';

export const AVATAR_OPTIONS = [
  { id: 'ace', label: 'Don Shark', photo: '/images/avatar-shark.jpg', bg: 'from-[#2D1E12] to-[#15192B]', ring: 'border-[#E6B84C]/60', color: '#E6B84C', Icon: Spade },
  { id: 'diamond', label: 'Velvet Queen', photo: '/images/avatar-queen.jpg', bg: 'from-[#3A1C33] to-[#151824]', ring: 'border-pink-400/60', color: '#F472B6', Icon: Diamond },
  { id: 'flame', label: 'Joker King', photo: '/images/avatar-joker.jpg', bg: 'from-[#3D1D24] to-[#161824]', ring: 'border-[#E1384B]/60', color: '#E1384B', Icon: Flame },
  { id: 'oracle', label: 'Noir Detective', photo: '/images/avatar-detective.jpg', bg: 'from-[#261B12] to-[#141724]', ring: 'border-[#1CD696]/60', color: '#1CD696', Icon: Eye },
  { id: 'crown', label: 'Royal Boss', photo: '/images/meme-boss.jpg', bg: 'from-[#3B2A14] to-[#171926]', ring: 'border-amber-400/60', color: '#FBBF24', Icon: Crown },
  { id: 'phantom', label: 'Phantom', photo: '/images/avatar-detective.jpg', bg: 'from-[#182B3A] to-[#121622]', ring: 'border-[#1CD696]/50', color: '#1CD696', Icon: Ghost },
  { id: 'viper', label: 'Viper', photo: '/images/avatar-shark.jpg', bg: 'from-[#12332B] to-[#131823]', ring: 'border-emerald-400/50', color: '#10B981', Icon: Zap },
  { id: 'cyber', label: 'Bastion', photo: '/images/avatar-joker.jpg', bg: 'from-[#1E2542] to-[#121521]', ring: 'border-sky-400/50', color: '#38BDF8', Icon: Shield },
] as const;

interface AvatarBadgeProps {
  avatar: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  active?: boolean;
  isBot?: boolean;
}

const SIZE_MAP = {
  xs: { box: 'h-7 w-7 rounded-lg', icon: 'h-3.5 w-3.5' },
  sm: { box: 'h-9 w-9 rounded-xl', icon: 'h-4 w-4' },
  md: { box: 'h-11 w-11 rounded-xl', icon: 'h-5 w-5' },
  lg: { box: 'h-14 w-14 rounded-2xl', icon: 'h-6 w-6' },
  xl: { box: 'h-20 w-20 rounded-2xl', icon: 'h-9 w-9' },
};

export const AvatarBadge: React.FC<AvatarBadgeProps> = ({
  avatar,
  size = 'md',
  active = false,
  isBot = false,
}) => {
  const cfg = AVATAR_OPTIONS.find((o) => o.id === avatar) ?? AVATAR_OPTIONS[0];
  const dims = SIZE_MAP[size];

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br ${cfg.bg} border-2 ${
        active ? 'border-[#E6B84C] ring-2 ring-[#E6B84C]/40' : cfg.ring
      } ${dims.box} shadow-md`}
    >
      <img
        src={cfg.photo}
        alt={cfg.label}
        className="h-full w-full object-cover"
        loading="lazy"
      />
      {isBot && (
        <span className="absolute bottom-0 right-0 rounded-tl-md bg-[#0B0907]/90 px-1 py-0.2 font-[var(--font-mono)] text-[8px] font-bold tracking-wider text-[#1CD696] border-t border-l border-[#1CD696]/40">
          AI
        </span>
      )}
    </div>
  );
};
