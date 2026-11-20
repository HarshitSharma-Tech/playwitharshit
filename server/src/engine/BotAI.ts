import crypto from 'node:crypto';
import type {
  BotPersonality,
  Card,
  LastPlayPublicInfo,
  Rank,
  ReactionEmoji,
  VoicePhrase,
} from '../../../shared/types.js';

function randFloat(): number {
  return crypto.randomInt(0, 10000) / 10000;
}

function pickRandom<T>(arr: T[]): T {
  return arr[crypto.randomInt(arr.length)];
}

export interface BotPlayDecision {
  cardIds: string[];
  delayMs: number;
  reaction?: ReactionEmoji;
  phrase?: VoicePhrase;
}

export interface BotResponseDecision {
  action: 'challenge' | 'accept';
  delayMs: number;
  reaction?: ReactionEmoji;
  phrase?: VoicePhrase;
}

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

export function decideBotPlay(params: {
  personality: BotPersonality;
  hand: Card[];
  requiredRank: Rank;
  pileCount: number;
}): BotPlayDecision {
  const { personality, hand, requiredRank } = params;
  const matching = hand.filter((c) => c.rank === requiredRank);
  const nonMatching = hand.filter((c) => c.rank !== requiredRank);

  let chosen: Card[] = [];
  let reaction: ReactionEmoji | undefined;

  if (matching.length > 0) {
    // Bot HAS matching cards — decide whether to play truth, pad with a bluff, or bluff anyway
    switch (personality) {
      case 'aggressive': {
        // Often slips an extra non-matching card to shed hand fast
        chosen = [...matching.slice(0, 3)];
        if (nonMatching.length > 0 && chosen.length < 3 && randFloat() < 0.35) {
          chosen.push(pickRandom(nonMatching));
          if (randFloat() < 0.3) reaction = '😈';
        }
        break;
      }
      case 'strategic': {
        // Plays exact matching cards cleanly (up to 3 unless winning)
        chosen = matching.slice(0, Math.min(4, matching.length));
        break;
      }
      case 'unpredictable': {
        // Sometimes plays only 1 matching, sometimes mixes in a wild card
        if (nonMatching.length > 0 && randFloat() < 0.3) {
          chosen = [matching[0], pickRandom(nonMatching)];
          if (randFloat() < 0.35) reaction = '🔥';
        } else {
          const count = Math.min(matching.length, crypto.randomInt(1, matching.length + 1));
          chosen = matching.slice(0, count);
        }
        break;
      }
      case 'defensive':
      default: {
        // Safe truthful play
        chosen = matching.slice(0, Math.min(2, matching.length));
        break;
      }
    }
  } else {
    // Bot has NO matching cards -> MUST bluff!
    switch (personality) {
      case 'aggressive': {
        const count = Math.min(hand.length, randFloat() < 0.55 ? 2 : randFloat() < 0.85 ? 1 : 3);
        chosen = hand.slice(0, Math.max(1, count));
        if (randFloat() < 0.25) reaction = '😈';
        break;
      }
      case 'strategic': {
        // Single-card bluffs are much harder to call out mathematically
        chosen = [pickRandom(hand)];
        break;
      }
      case 'unpredictable': {
        const count = Math.min(hand.length, crypto.randomInt(1, Math.min(3, hand.length) + 1));
        chosen = hand.slice(0, count);
        if (randFloat() < 0.25) reaction = '👀';
        break;
      }
      case 'defensive':
      default: {
        chosen = [hand[0]];
        break;
      }
    }
  }

  // Guarantee valid 1..4 cards
  if (chosen.length === 0 && hand.length > 0) {
    chosen = [hand[0]];
  }
  chosen = chosen.slice(0, 4);

  const delayMs = 1100 + crypto.randomInt(1400);
  const phrase = randFloat() < 0.24 ? pickRandom(BOT_PLAY_PHRASES) : undefined;
  return {
    cardIds: chosen.map((c) => c.id),
    delayMs,
    reaction: phrase ? undefined : reaction,
    phrase,
  };
}

export function decideBotResponse(params: {
  personality: BotPersonality;
  botHand: Card[];
  lastPlay: LastPlayPublicInfo;
  accusedCardsRemaining: number;
  pileCount: number;
  accusedCaughtBluffs: number;
  deckCount?: 1 | 2;
}): BotResponseDecision {
  const {
    personality,
    botHand,
    lastPlay,
    accusedCardsRemaining,
    pileCount,
    accusedCaughtBluffs,
    deckCount = 1,
  } = params;

  const maxOfRankInDeck = deckCount * 4;
  const myCountOfRank = botHand.filter((c) => c.rank === lastPlay.declaredRank).length;
  const mathematicallyImpossible = myCountOfRank + lastPlay.count > maxOfRankInDeck;

  // If mathematically impossible (there are only 4 of any rank in a 52-card deck!),
  // smart bots almost always catch it!
  if (mathematicallyImpossible) {
    const catchProb =
      personality === 'strategic'
        ? 0.96
        : personality === 'defensive'
          ? 0.9
          : personality === 'aggressive'
            ? 0.88
            : 0.72;
    if (randFloat() < catchProb) {
      return {
        action: 'challenge',
        delayMs: 900 + crypto.randomInt(1200),
        reaction: '👀',
      };
    }
  }

  // If accused is about to WIN (0 cards left), high urgency to challenge!
  if (accusedCardsRemaining === 0) {
    const desperationProb =
      personality === 'aggressive'
        ? 0.72
        : personality === 'strategic'
          ? 0.58 + (myCountOfRank >= 2 ? 0.25 : 0)
          : personality === 'unpredictable'
            ? 0.65
            : 0.45;
    if (randFloat() < desperationProb) {
      return {
        action: 'challenge',
        delayMs: 1100 + crypto.randomInt(1500),
        reaction: '🤔',
      };
    }
  }

  // Compute suspicion probability based on personality + public signals
  let suspicion = 0.08;
  if (lastPlay.count === 2) suspicion += 0.08;
  if (lastPlay.count === 3) suspicion += 0.24;
  if (lastPlay.count >= 4) suspicion += 0.45;
  if (myCountOfRank >= 2) suspicion += 0.14;
  if (accusedCaughtBluffs > 0) suspicion += Math.min(0.18, accusedCaughtBluffs * 0.07);
  // Large pile discourages defensive bots from risking picking it up
  if (pileCount >= 8 && personality === 'defensive') suspicion -= 0.1;

  switch (personality) {
    case 'aggressive':
      suspicion += 0.14;
      break;
    case 'strategic':
      suspicion += myCountOfRank > 0 ? 0.06 : -0.03;
      break;
    case 'unpredictable':
      suspicion += (randFloat() - 0.35) * 0.32;
      break;
    case 'defensive':
      suspicion -= 0.08;
      break;
  }

  const willChallenge = randFloat() < Math.max(0.03, Math.min(0.85, suspicion));
  const phrase = willChallenge && randFloat() < 0.65 ? pickRandom(BOT_CHALLENGE_PHRASES) : undefined;
  return {
    action: willChallenge ? 'challenge' : 'accept',
    delayMs: 1000 + crypto.randomInt(2200),
    reaction: phrase ? undefined : willChallenge && randFloat() < 0.4 ? '🤔' : undefined,
    phrase,
  };
}
