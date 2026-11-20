import React from 'react';

interface BrandLogoProps {
  compact?: boolean;
  onClick?: () => void;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ compact = false, onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-3 text-left focus:outline-none cursor-pointer"
    >
      <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#2B1D12] to-[#120D09] border border-[#E6B84C]/55 shadow-[0_6px_20px_rgba(0,0,0,0.65)] transition-transform duration-200 group-hover:scale-105">
        <svg viewBox="0 0 36 36" className="h-6 w-6" fill="none">
          <rect
            x="5"
            y="4"
            width="16"
            height="22"
            rx="2.5"
            transform="rotate(-11 5 4)"
            fill="#0D4430"
            stroke="#E6B84C"
            strokeWidth="1.4"
          />
          <rect
            x="14"
            y="6"
            width="16"
            height="22"
            rx="2.5"
            transform="rotate(8 14 6)"
            fill="#1D140E"
            stroke="#F6D889"
            strokeWidth="1.6"
          />
          <path
            d="M21 12.2C21 12.2 17.4 15.8 17.4 18.2C17.4 19.7 18.6 20.6 19.9 20.1C19.8 21.1 19.3 21.8 18.7 22.3H23.3C22.7 21.8 22.2 21.1 22.1 20.1C23.4 20.6 24.6 19.7 24.6 18.2C24.6 15.8 21 12.2 21 12.2Z"
            fill="#E6B84C"
          />
        </svg>
      </div>
      {!compact && (
        <div className="flex flex-col leading-none">
          <span className="font-[var(--font-display)] text-lg font-extrabold tracking-[0.2em] text-[#FAF3E3]">
            BLUFFED
          </span>
          <span className="mt-0.5 font-[var(--font-mono)] text-[9px] uppercase tracking-[0.26em] text-[#E6B84C]">
            ROYAL CARD CLUB
          </span>
        </div>
      )}
    </button>
  );
};
