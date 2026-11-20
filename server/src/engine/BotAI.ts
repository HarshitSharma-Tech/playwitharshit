import crypto from 'node:crypto';
import {
  RANKS,
  type BotPersonality,
  type Card,
  type LastPlayPublicInfo,
  type Rank,
  type ReactionEmoji,
  type VoicePhrase,
} from '../../../shared/types.js';

function randFloat(): number {
  return crypto.randomInt(0, 10000) / 10000;
}

function pickRandom<T>(arr: T[]): T {
  return arr[crypto.randomInt(arr.length)];
}

export type BotTurnDecision =
  | {
      action: 'play';
      cardIds: string[];
      declaredRank: Rank;
      delayMs: number;
      reaction?: ReactionEmoji;
      phrase?: VoicePhrase;
    }
  | {
      action: 'pass';
      delayMs: number;
      reaction?: ReactionEmoji;
    }
  | {
      action: 'challenge';
      delayMs: number;
      reaction?: ReactionEmoji;
      phrase?: VoicePhrase;
    };

const BOT_PLAY_PHRASES: VoicePhrase[] = [
  'Asli khiladi hoon main!',
  'Aukat mein reh bawa!',
  'Khatam, tata, bye-bye!',
];

const BOT_CHALLENGE_PHRASES: VoicePhrase[] = [
  'Abbe jhoot bol raha hai saala!',
  'Kya fek raha hai bhai?!',
  'Chal hat, ullu mat bana!',
  'Pakda gaya chomu!',
];

export const BOT_ROSTER: Array<{
  name: string;
  avatar: string;
  personality: BotPersonality;
}> = [
  { name: 'Vex-AI', avatar: 'viper', personality: 'aggressive' },
  { name: 'Athena-AI', avatar: 'oracle', personality: 'strategic' },
  { name: 'Jester-AI', avatar: 'flame', personality: 'unpredictable' },
  { name: 'Bastion-AI', avatar: 'cyber', personality: 'defensive' },
  { name: 'Mantis-AI', avatar: 'phantom', personality: 'strategic' },
  { name: 'Riot-AI', avatar: 'crown', personality: 'aggressive' },
];

/**
 * Line-by-line turn-based Bot AI:
 * - On a fresh round (requiredRank === null): picks ANY rank (usually its most frequent rank, or bluffs!).
 * - On an active round: evaluates whether to CHALLENGE the previous play, PLAY matching/bluff cards, or PASS.
 */
export function decideBotTurn(params: {
  personality: BotPersonality;
  hand: Card[];
  requiredRank: Rank | null;
  lastPlay: LastPlayPublicInfo | null;
  pendingWinnerId: string | null;
  pileCount: number;
  accusedCaughtBluffs: number;
  deckCount?: 1 | 2;
}): BotTurnDecision {
  const {
    personality,
    hand,
    requiredRank,
    lastPlay,
    pendingWinnerId,
    pileCount,
    accusedCaughtBluffs,
    deckCount = 1,
  } = params;

  const delayMs = 1100 + crypto.randomInt(1300);

  // 1. FRESH ROUND: Bot chooses ANY rank to declare!
  if (!requiredRank || !lastPlay) {
    // Group hand by rank to find strong truthful sets
    const byRank = new Map<Rank, Card[]>();
    for (const c of hand) {
      const list = byRank.get(c.rank) ?? [];
      list.push(c);
      byRank.set(c.rank, list);
    }
    const groups = Array.from(byRank.entries()).sort((a, b) => b[1].length - a[1].length);
    const best = groups[0];

    let chosenCards: Card[] = best ? best[1].slice(0, 3) : [hand[0]];
    let declaredRank: Rank = best ? best[0] : hand[0].rank;

    if (personality === 'aggressive' && hand.length >= 2 && randFloat() < 0.35) {
      const extra = hand.find((c) => !chosenCards.some((ch) => ch.id === c.id));
      if (extra) chosenCards = [...chosenCards.slice(0, 2), extra];
    } else if (personality === 'unpredictable' && randFloat() < 0.3) {
      declaredRank = pickRandom(RANKS);
      chosenCards = hand.slice(0, Math.min(2, hand.length));
    }

    const phrase = randFloat() < 0.22 ? pickRandom(BOT_PLAY_PHRASES) : undefined;
    return {
      action: 'play',
      cardIds: chosenCards.slice(0, deckCount === 2 ? 6 : 4).map((c) => c.id),
      declaredRank,
      delayMs,
      phrase,
      reaction: phrase ? undefined : randFloat() < 0.15 ? '😈' : undefined,
    };
  }

  // 2. ACTIVE ROUND: First evaluate whether to CHALLENGE the previous play!
  const maxOfRankInDeck = deckCount * 4;
  const matching = hand.filter((c) => c.rank === requiredRank);
  const nonMatching = hand.filter((c) => c.rank !== requiredRank);
  const mathematicallyImpossible = matching.length + lastPlay.count > maxOfRankInDeck;

  if (mathematicallyImpossible) {
    const catchProb =
      personality === 'strategic' ? 0.96 : personality === 'defensive' ? 0.9 : 0.85;
    if (randFloat() < catchProb) {
      return {
        action: 'challenge',
        delayMs,
        phrase: pickRandom(BOT_CHALLENGE_PHRASES),
      };
    }
  }

  // If someone just emptied their hand (pendingWinnerId), we MUST either challenge or pass!
  if (pendingWinnerId) {
    const callProb =
      personality === 'aggressive'
        ? 0.72
        : personality === 'strategic'
          ? 0.55 + (matching.length >= 2 ? 0.25 : 0)
          : personality === 'unpredictable'
            ? 0.65
            : 0.45;
    if (randFloat() < callProb) {
      return {
        action: 'challenge',
        delayMs,
        phrase: pickRandom(BOT_CHALLENGE_PHRASES),
      };
    }
    return { action: 'pass', delayMs };
  }

  // Suspicion check to call bluff
  let suspicion = 0.08;
  if (lastPlay.count === 2) suspicion += 0.09;
  if (lastPlay.count === 3) suspicion += 0.25;
  if (lastPlay.count >= 4) suspicion += 0.48;
  if (matching.length >= 2) suspicion += 0.15;
  if (accusedCaughtBluffs > 0) suspicion += Math.min(0.18, accusedCaughtBluffs * 0.07);
  if (pileCount >= 8 && personality === 'defensive') suspicion -= 0.12;

  if (personality === 'aggressive') suspicion += 0.14;
  else if (personality === 'unpredictable') suspicion += (randFloat() - 0.35) * 0.3;
  else if (personality === 'defensive') suspicion -= 0.08;

  if (randFloat() < Math.max(0.03, Math.min(0.82, suspicion))) {
    return {
      action: 'challenge',
      delayMs,
      phrase: randFloat() < 0.65 ? pickRandom(BOT_CHALLENGE_PHRASES) : undefined,
      reaction: '👀',
    };
  }

  // 3. Otherwise, decide between PLAYING cards (truth or bluff) vs PASSING
  if (matching.length > 0) {
    let chosen = matching.slice(0, Math.min(3, matching.length));
    if (personality === 'aggressive' && nonMatching.length > 0 && randFloat() < 0.3) {
      chosen = [...chosen.slice(0, 2), pickRandom(nonMatching)];
    }
    return {
      action: 'play',
      cardIds: chosen.map((c) => c.id),
      declaredRank: requiredRank,
      delayMs,
      phrase: randFloat() < 0.18 ? pickRandom(BOT_PLAY_PHRASES) : undefined,
    };
  }

  // No matching cards -> decide whether to BLUFF or PASS
  const bluffProb =
    personality === 'aggressive'
      ? 0.68
      : personality === 'unpredictable'
        ? 0.6
        : personality === 'strategic'
          ? 0.42
          : 0.22;

  if (randFloat() < bluffProb && hand.length > 0) {
    const count =
      personality === 'aggressive' && hand.length >= 2 && randFloat() < 0.5 ? 2 : 1;
    const chosen = hand.slice(0, count);
    return {
      action: 'play',
      cardIds: chosen.map((c) => c.id),
      declaredRank: requiredRank,
      delayMs,
      reaction: randFloat() < 0.25 ? '😈' : undefined,
    };
  }

  return {
    action: 'pass',
    delayMs,
  };
}
