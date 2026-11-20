import React from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Crown,
  Gauge,
  Layers,
  Play,
  ShieldAlert,
} from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { PlayingCard } from '../components/PlayingCard';

export const HowToPlayPage: React.FC = () => {
  const { setModal, startQuickPlay } = useGameStore();

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-8 sm:px-6 lg:px-8">
      <div className="rounded-3xl surface-card p-6 sm:p-10">
        <span className="font-[var(--font-mono)] text-[11px] font-semibold uppercase tracking-[0.22em] text-[#1CD696]">
          OFFICIAL RULEBOOK
        </span>
        <h1 className="mt-2 font-[var(--font-display)] text-3xl sm:text-4xl font-extrabold text-[#FAF3E3]">
          How to Master BLUFFED
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#B9A992]">
          BLUFFED is the classic high-tension card game of Bluff (Cheat / I Doubt It) rebuilt
          with server-authoritative hidden hands, real-time challenge windows, and psychological
          telemetry.
        </p>

        {/* Visual Showcase Strip */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4 rounded-2xl bg-[#120E0B] border border-white/[0.06] p-6">
          <PlayingCard card={{ id: 'K_s', rank: 'K', suit: 'spades' }} size="sm" highlight="match" />
          <PlayingCard card={{ id: 'K_h', rank: 'K', suit: 'hearts' }} size="sm" highlight="match" />
          <div className="px-2 font-[var(--font-mono)] text-xs font-bold text-[#B9A992]">OR BLUFF WITH</div>
          <PlayingCard card={{ id: '4_c', rank: '4', suit: 'clubs' }} size="sm" highlight="bluff" />
          <PlayingCard faceDown size="sm" />
        </div>

        {/* 4 Core Steps */}
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          {[
            {
              step: '01',
              title: 'Start Fresh With ANY Rank',
              Icon: Layers,
              color: 'text-[#E6B84C]',
              text: 'Whenever a new round starts (clean table, after a challenge, or after everyone passes), the starting player picks ANY rank (A–K) and throws 1 or more cards face down declaring that rank.',
            },
            {
              step: '02',
              title: 'Line-by-Line Turns (No Interrupting)',
              Icon: AlertTriangle,
              color: 'text-amber-400',
              text: 'Chances move strictly clockwise seat by seat (#1 → #2 → #3…). Nobody can interrupt during another player’s turn — you act cleanly when your turn arrives.',
            },
            {
              step: '03',
              title: 'Play, Pass, or Call Bluff',
              Icon: ShieldAlert,
              color: 'text-[#E1384B]',
              text: 'On your turn during an active round, add cards claiming the active rank (truth or bluff!), PASS your turn, or CALL BLUFF on the previous player. If everyone passes, the pile clears and the last player starts a brand-new round!',
            },
            {
              step: '04',
              title: 'Survive Your Final Hand to Win',
              Icon: Crown,
              color: 'text-emerald-400',
              text: 'Emptying your hand does not win instantly — each remaining player gets their turn in line to either PASS or CALL BLUFF on your final throw. Survive unchallenged (or prove truth) to claim victory!',
            },
          ].map((item) => {
            const Icon = item.Icon;
            return (
              <div
                key={item.step}
                className="rounded-2xl bg-[#120E0B] border border-white/[0.06] p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#18130F] border border-white/10">
                    <Icon className={`h-5 w-5 ${item.color}`} />
                  </div>
                  <span className="font-[var(--font-mono)] text-xs font-bold text-[#49516B]">
                    STEP {item.step}
                  </span>
                </div>
                <h2 className="mt-4 font-[var(--font-heading)] text-base font-bold text-[#FAF3E3]">
                  {item.title}
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-[#B9A992]">{item.text}</p>
              </div>
            );
          })}
        </div>

        {/* Observed Bluff Meter & AI Personalities */}
        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl bg-[#120E0B] border border-white/[0.06] p-5">
            <div className="flex items-center gap-2 text-[#1CD696]">
              <Gauge className="h-4 w-4" />
              <h3 className="font-[var(--font-heading)] text-sm font-bold uppercase tracking-wider">
                Observed Bluff Meter
              </h3>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[#B9A992]">
              The Bluff Meter never peeks at hidden cards. Instead, it reflects strictly observed
              table behavior — bold multi-card plays, caught bluffs, and verified truths — helping
              you read who plays hot and who plays ice-cold.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>100% server-authoritative: hidden cards never reach other players&apos; browsers.</span>
            </div>
          </div>

          <div className="rounded-2xl bg-[#120E0B] border border-white/[0.06] p-5">
            <div className="flex items-center gap-2 text-[#E6B84C]">
              <Bot className="h-4 w-4" />
              <h3 className="font-[var(--font-heading)] text-sm font-bold uppercase tracking-wider">
                AI Bot Personalities
              </h3>
            </div>
            <ul className="mt-2.5 space-y-1.5 text-xs text-[#B9A992]">
              <li>
                <strong className="text-[#E1384B]">Aggressive:</strong> Pushes multi-card bluffs and
                challenges boldly.
              </li>
              <li>
                <strong className="text-[#1CD696]">Strategic:</strong> Counts cards in hand and
                instantly catches mathematically impossible claims.
              </li>
              <li>
                <strong className="text-[#E6B84C]">Unpredictable:</strong> Mixes chaotic bet sizes
                and unexpected calls.
              </li>
              <li>
                <strong className="text-emerald-400">Defensive:</strong> Plays conservatively and
                protects small hands.
              </li>
            </ul>
          </div>
        </div>

        {/* CTAs */}
        <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-6">
          <button
            type="button"
            onClick={startQuickPlay}
            className="inline-flex items-center gap-2 rounded-xl bg-[#E6B84C] px-6 py-3 text-xs font-bold uppercase tracking-wider text-[#0B0907] hover:bg-[#F3CF7A] cursor-pointer"
          >
            <Play className="h-4 w-4 fill-current" />
            Jump into Quick Play
          </button>
          <button
            type="button"
            onClick={() => setModal('bots', true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#191F30] border border-white/10 px-6 py-3 text-xs font-bold uppercase tracking-wider text-[#FAF3E3] hover:border-[#1CD696]/50 cursor-pointer"
          >
            <Bot className="h-4 w-4 text-[#1CD696]" />
            Practice Against Bots
          </button>
        </div>
      </div>
    </div>
  );
};
