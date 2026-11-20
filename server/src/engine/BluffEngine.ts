import crypto from 'node:crypto';
import {
  RANKS,
  SUITS,
  type AchievementId,
  type BotPersonality,
  type Card,
  type CardsPerPlayerOption,
  type ChallengeResult,
  type DealEventPublic,
  type DeckCountOption,
  type DistributionMode,
  type FirstPlayerMode,
  type GameLogEntry,
  type GamePhase,
  type LastPlayPublicInfo,
  type MatchWinnerInfo,
  type ObservedBluffMetrics,
  type PlayerReputation,
  type PublicPlayerGameState,
  type Rank,
  type SanitizedGameState,
  type ShuffleSpeed,
  type SpectatorInfo,
} from '../../../shared/types.js';

export interface EnginePlayerInit {
  id: string;
  username: string;
  avatar: string;
  isBot: boolean;
  botPersonality?: BotPersonality;
  connected: boolean;
}

interface InternalPlayer extends EnginePlayerInit {
  hand: Card[];
  hasAcceptedCurrentPlay: boolean;
  matchStats: PlayerReputation;
  observed: {
    totalPlays: number;
    caughtBluffs: number;
    verifiedTruths: number;
    boldPlays: number;
  };
  seatIndex: number;
  riskTakerEarned: boolean;
  survivedFinalChallenge: boolean;
  wonWithFinalBluff: boolean;
}

interface HiddenPlayRecord {
  playId: string;
  playerId: string;
  playerName: string;
  declaredRank: Rank;
  cards: Card[];
  wasBluff: boolean;
  timestamp: number;
}

export interface EngineCallbacks {
  onStateChanged: () => void;
  onChallengeRevealComplete: (winner: MatchWinnerInfo | null) => void;
  onMatchFinished: (
    winner: MatchWinnerInfo,
    participantSummary: Array<{
      userId: string;
      isBot: boolean;
      won: boolean;
      stats: PlayerReputation;
      unlockedAchievements: AchievementId[];
    }>
  ) => void;
}

export const CHALLENGE_WINDOW_MS = 9000;
export const CHALLENGE_REVEAL_MS = 4000;

const SHUFFLE_DURATION_MS: Record<ShuffleSpeed, number> = {
  slow: 2800,
  normal: 1800,
  fast: 1000,
};

const DEAL_CARD_INTERVAL_MS: Record<ShuffleSpeed, number> = {
  slow: 220,
  normal: 130,
  fast: 70,
};

/**
 * Creates 1 or 2 standard 52-card decks with globally unique physical card IDs
 * and performs a cryptographically secure Fisher-Yates shuffle on the backend.
 */
export function createShuffledDeck(deckCount: DeckCountOption = 1): Card[] {
  const deck: Card[] = [];
  const totalDecks: Array<1 | 2> = deckCount === 2 ? [1, 2] : [1];

  for (const deckIndex of totalDecks) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({
          id: `d${deckIndex}_${rank}_${suit}`,
          suit,
          rank,
          deckIndex,
        });
      }
    }
  }

  for (let i = deck.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function sortHand(hand: Card[]): Card[] {
  const rankOrder = new Map<Rank, number>(RANKS.map((r, i) => [r, i]));
  const suitOrder = new Map(SUITS.map((s, i) => [s, i]));
  return [...hand].sort((a, b) => {
    const rDiff = (rankOrder.get(a.rank) ?? 0) - (rankOrder.get(b.rank) ?? 0);
    if (rDiff !== 0) return rDiff;
    const sDiff = (suitOrder.get(a.suit) ?? 0) - (suitOrder.get(b.suit) ?? 0);
    if (sDiff !== 0) return sDiff;
    return (a.deckIndex ?? 1) - (b.deckIndex ?? 1);
  });
}

function computeObservedBluffMetrics(obs: InternalPlayer['observed']): ObservedBluffMetrics {
  const totalChallenges = obs.caughtBluffs + obs.verifiedTruths;
  let score = 20;
  if (obs.totalPlays > 0) {
    const boldRatio = obs.boldPlays / obs.totalPlays;
    score += Math.round(boldRatio * 35);
  }
  if (totalChallenges > 0) {
    const caughtRate = obs.caughtBluffs / totalChallenges;
    score += Math.round(caughtRate * 45) - Math.round((1 - caughtRate) * 15);
  }
  score = Math.max(5, Math.min(100, score));

  let label: ObservedBluffMetrics['label'] = 'Calm';
  if (score >= 80) label = 'Chaos Agent';
  else if (score >= 62) label = 'High Heat';
  else if (score >= 42) label = 'Bold';
  else if (score >= 25) label = 'Cautious';

  return {
    totalPlays: obs.totalPlays,
    caughtBluffs: obs.caughtBluffs,
    verifiedTruths: obs.verifiedTruths,
    boldPlays: obs.boldPlays,
    observedMeter: score,
    label,
  };
}

export class BluffEngine {
  public readonly roomCode: string;
  public readonly turnDurationSec: number;
  public readonly deckCount: DeckCountOption;
  public readonly totalDeckCards: number;
  public readonly cardsPerPlayerTarget: number;
  public readonly distributionMode: DistributionMode;
  public readonly shuffleSpeed: ShuffleSpeed;

  private phase: GamePhase = 'shuffling';
  private roundNumber = 1;
  private requiredRankIndex = 0; // Starts at 'A'
  private currentTurnIndex = 0;
  private players: InternalPlayer[] = [];
  private spectators: SpectatorInfo[] = [];

  // Server-only undealt shuffled deck (NEVER exposed to clients)
  private undealtDeck: Card[] = [];
  private totalCardsToDeal = 0;
  private dealtCardsSoFar = 0;
  private dealSeatCursor = 0;
  private lastDealEvent: DealEventPublic | null = null;
  private dealInProgress = false;

  private discardPile: Card[] = [];
  private lastHiddenPlay: HiddenPlayRecord | null = null;
  private pendingWinnerId: string | null = null;
  private challengeResult: ChallengeResult | null = null;
  private winner: MatchWinnerInfo | null = null;
  private logs: GameLogEntry[] = [];
  private turnDeadline = 0;
  private challengeDeadline: number | null = null;
  private startedAt = Date.now();
  private timers: Set<ReturnType<typeof setTimeout>> = new Set();
  private callbacks: EngineCallbacks;
  private enableTimers: boolean;
  private firstPlayerMode: FirstPlayerMode;
  private firstPlayerId: string | null;

  constructor(params: {
    roomCode: string;
    players: EnginePlayerInit[];
    spectators?: SpectatorInfo[];
    cardsPerPlayer: CardsPerPlayerOption;
    deckCount?: DeckCountOption;
    distributionMode?: DistributionMode;
    shuffleSpeed?: ShuffleSpeed;
    firstPlayerMode?: FirstPlayerMode;
    firstPlayerId?: string | null;
    turnDurationSec: number;
    callbacks: EngineCallbacks;
    enableTimers?: boolean;
    /** Skip shuffle/deal delays in synchronous unit tests when true */
    instantDeal?: boolean;
  }) {
    if (params.players.length < 2 || params.players.length > 6) {
      throw new Error('BLUFFED requires between 2 and 6 players.');
    }

    this.roomCode = params.roomCode;
    this.turnDurationSec = params.turnDurationSec;
    this.deckCount = params.deckCount === 2 ? 2 : 1;
    this.totalDeckCards = this.deckCount * 52;
    this.distributionMode = params.distributionMode ?? 'automatic';
    this.shuffleSpeed = params.shuffleSpeed ?? 'normal';
    this.firstPlayerMode = params.firstPlayerMode ?? 'random';
    this.firstPlayerId = params.firstPlayerId ?? null;
    this.callbacks = params.callbacks;
    this.enableTimers = params.enableTimers ?? true;
    this.spectators = params.spectators ? [...params.spectators] : [];

    const playerCount = params.players.length;
    const maxPerPlayer = Math.floor(this.totalDeckCards / playerCount);
    const requested = Math.floor(params.cardsPerPlayer || 0);

    if (requested > maxPerPlayer) {
      throw new Error(
        `Cannot deal ${requested} cards to ${playerCount} players from ${this.totalDeckCards} cards (max ${maxPerPlayer} each).`
      );
    }

    this.cardsPerPlayerTarget = requested <= 0 ? maxPerPlayer : requested;
    this.totalCardsToDeal = this.cardsPerPlayerTarget * playerCount;

    // Server-side cryptographic shuffle of 1 or 2 complete decks
    this.undealtDeck = createShuffledDeck(this.deckCount);

    this.players = params.players.map((p, idx) => ({
      ...p,
      hand: [],
      hasAcceptedCurrentPlay: false,
      matchStats: {
        successfulBluffs: 0,
        failedBluffs: 0,
        correctChallenges: 0,
        wrongChallenges: 0,
      },
      observed: {
        totalPlays: 0,
        caughtBluffs: 0,
        verifiedTruths: 0,
        boldPlays: 0,
      },
      seatIndex: idx,
      riskTakerEarned: false,
      survivedFinalChallenge: false,
      wonWithFinalBluff: false,
    }));

    // Determine starting seat before play begins
    if (this.firstPlayerMode === 'host_selected' && this.firstPlayerId) {
      const chosenIdx = this.players.findIndex((p) => p.id === this.firstPlayerId);
      this.currentTurnIndex = chosenIdx >= 0 ? chosenIdx : crypto.randomInt(this.players.length);
    } else {
      this.currentTurnIndex = crypto.randomInt(this.players.length);
    }
    this.dealSeatCursor = this.currentTurnIndex;

    this.pushLog(
      'system',
      `Shuffling ${this.totalDeckCards} cards (${this.deckCount} ${
        this.deckCount === 2 ? 'decks' : 'deck'
      }) for ${playerCount} players (${this.cardsPerPlayerTarget} cards each).`
    );

    if (params.instantDeal) {
      this.dealAllImmediately();
    } else {
      this.phase = 'shuffling';
      if (this.enableTimers) {
        this.schedule(() => {
          this.onShuffleComplete();
        }, SHUFFLE_DURATION_MS[this.shuffleSpeed]);
      }
    }
  }

  public destroy(): void {
    this.dealInProgress = false;
    for (const t of this.timers) {
      clearTimeout(t);
    }
    this.timers.clear();
  }

  private schedule(fn: () => void, ms: number): ReturnType<typeof setTimeout> {
    const id = setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, ms);
    this.timers.add(id);
    return id;
  }

  private clearAllTimers(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }

  private pushLog(type: GameLogEntry['type'], message: string): void {
    this.logs.push({
      id: `log_${Date.now()}_${crypto.randomInt(10000)}`,
      timestamp: Date.now(),
      type,
      message,
    });
    if (this.logs.length > 50) {
      this.logs = this.logs.slice(-50);
    }
  }

  /**
   * Transitions from `shuffling` into either `dealing` (automatic) or `ready_to_deal` (manual).
   */
  public onShuffleComplete(): void {
    if (this.phase !== 'shuffling') return;
    if (this.distributionMode === 'manual') {
      this.phase = 'ready_to_deal';
      this.pushLog('system', 'Deck shuffled. Waiting for host to deal cards.');
      this.callbacks.onStateChanged();
    } else {
      this.beginDealing();
    }
  }

  /**
   * Starts clockwise one-by-one distribution. Guards against duplicate starts.
   */
  public beginDealing(): { ok: true } | { ok: false; error: string } {
    if (this.dealInProgress) {
      return { ok: false, error: 'Card distribution is already in progress.' };
    }
    if (this.phase !== 'shuffling' && this.phase !== 'ready_to_deal') {
      return { ok: false, error: 'Cannot start card distribution right now.' };
    }

    this.dealInProgress = true;
    this.phase = 'dealing';
    this.pushLog(
      'system',
      `Dealing ${this.cardsPerPlayerTarget} cards to each player clockwise...`
    );
    this.callbacks.onStateChanged();

    if (this.enableTimers) {
      this.scheduleNextDealTick();
    }
    return { ok: true };
  }

  private scheduleNextDealTick(): void {
    const stepMs = DEAL_CARD_INTERVAL_MS[this.shuffleSpeed];
    this.schedule(() => {
      if (this.phase !== 'dealing') return;
      const done = this.dealOneCardStep();
      if (!done && this.enableTimers) {
        this.scheduleNextDealTick();
      }
    }, stepMs);
  }

  /**
   * Deals a single physical card from the server's undealt deck to the next clockwise seat.
   * Returns true once all target cards have been dealt.
   */
  public dealOneCardStep(): boolean {
    if (this.phase !== 'dealing') return true;
    if (this.dealtCardsSoFar >= this.totalCardsToDeal || this.undealtDeck.length === 0) {
      this.finishDealing();
      return true;
    }

    const target = this.players[this.dealSeatCursor];
    const nextCard = this.undealtDeck.pop()!;
    target.hand.push(nextCard);
    this.dealtCardsSoFar += 1;

    this.lastDealEvent = {
      seq: this.dealtCardsSoFar,
      targetPlayerId: target.id,
      targetSeatIndex: target.seatIndex,
      dealtCountTotal: this.dealtCardsSoFar,
      totalToDeal: this.totalCardsToDeal,
      timestamp: Date.now(),
    };

    this.dealSeatCursor = (this.dealSeatCursor + 1) % this.players.length;

    if (this.dealtCardsSoFar >= this.totalCardsToDeal || this.undealtDeck.length === 0) {
      this.callbacks.onStateChanged();
      if (this.enableTimers) {
        this.schedule(() => this.finishDealing(), 380);
      } else {
        this.finishDealing();
      }
      return true;
    }

    this.callbacks.onStateChanged();
    return false;
  }

  private finishDealing(): void {
    this.dealInProgress = false;
    for (const p of this.players) {
      p.hand = sortHand(p.hand);
    }
    this.phase = 'playing';
    this.startedAt = Date.now();
    const starter = this.getCurrentTurnPlayer();
    const remaining = this.undealtDeck.length;
    this.pushLog(
      'system',
      `Dealing complete! ${starter.username} starts Round 1 (Required rank: A).${
        remaining > 0 ? ` ${remaining} undealt cards remain in reserve.` : ''
      }`
    );
    this.startTurnTimer();
    this.callbacks.onStateChanged();
  }

  private dealAllImmediately(): void {
    this.phase = 'dealing';
    this.dealInProgress = true;
    while (this.dealtCardsSoFar < this.totalCardsToDeal && this.undealtDeck.length > 0) {
      const target = this.players[this.dealSeatCursor];
      target.hand.push(this.undealtDeck.pop()!);
      this.dealtCardsSoFar += 1;
      this.dealSeatCursor = (this.dealSeatCursor + 1) % this.players.length;
    }
    this.finishDealing();
  }

  public getPhase(): GamePhase {
    return this.phase;
  }

  public getRequiredRank(): Rank {
    return RANKS[this.requiredRankIndex];
  }

  public getCurrentTurnPlayer(): InternalPlayer {
    return this.players[this.currentTurnIndex];
  }

  public getPileCount(): number {
    return this.discardPile.length;
  }

  public getRemainingDeckCount(): number {
    return this.undealtDeck.length;
  }

  public getLastPlayPublic(): LastPlayPublicInfo | null {
    if (!this.lastHiddenPlay) return null;
    return {
      playId: this.lastHiddenPlay.playId,
      playerId: this.lastHiddenPlay.playerId,
      playerName: this.lastHiddenPlay.playerName,
      declaredRank: this.lastHiddenPlay.declaredRank,
      count: this.lastHiddenPlay.cards.length,
      timestamp: this.lastHiddenPlay.timestamp,
    };
  }

  public getPlayerHandInternal(playerId: string): Card[] {
    const p = this.players.find((pl) => pl.id === playerId);
    return p ? [...p.hand] : [];
  }

  public getPlayersMeta(): Array<{
    id: string;
    username: string;
    isBot: boolean;
    botPersonality?: BotPersonality;
    cardCount: number;
    hasAcceptedCurrentPlay: boolean;
  }> {
    return this.players.map((p) => ({
      id: p.id,
      username: p.username,
      isBot: p.isBot,
      botPersonality: p.botPersonality,
      cardCount: p.hand.length,
      hasAcceptedCurrentPlay: p.hasAcceptedCurrentPlay,
    }));
  }

  public setPlayerConnected(playerId: string, connected: boolean): void {
    const p = this.players.find((pl) => pl.id === playerId);
    if (p) {
      p.connected = connected;
      this.callbacks.onStateChanged();
    }
  }

  public setSpectators(spectators: SpectatorInfo[]): void {
    this.spectators = [...spectators];
  }

  public isPlayerInMatch(playerId: string): boolean {
    return this.players.some((p) => p.id === playerId);
  }

  private startTurnTimer(): void {
    this.clearAllTimers();
    this.challengeDeadline = null;
    this.turnDeadline = Date.now() + this.turnDurationSec * 1000;
    if (!this.enableTimers) return;

    this.schedule(() => {
      if (this.phase !== 'playing') return;
      this.autoPlayForCurrentPlayer();
    }, this.turnDurationSec * 1000);
  }

  private startChallengeTimer(): void {
    this.clearAllTimers();
    this.challengeDeadline = Date.now() + CHALLENGE_WINDOW_MS;
    if (!this.enableTimers) return;

    this.schedule(() => {
      if (this.phase !== 'awaiting_response') return;
      this.finalizeUnchallengedPlay();
    }, CHALLENGE_WINDOW_MS);
  }

  public autoPlayForCurrentPlayer(): void {
    if (this.phase !== 'playing') return;
    const player = this.getCurrentTurnPlayer();
    if (player.hand.length === 0) return;

    const reqRank = this.getRequiredRank();
    const matching = player.hand.find((c) => c.rank === reqRank);
    const cardToPlay = matching ?? player.hand[0];
    this.pushLog('system', `${player.username} ran out of time and auto-played 1 card.`);
    this.playCards(player.id, [cardToPlay.id]);
  }

  public playCards(
    playerId: string,
    cardIds: string[]
  ): { ok: true } | { ok: false; error: string } {
    if (this.phase !== 'playing') {
      return { ok: false, error: 'Cannot play cards right now.' };
    }
    const current = this.getCurrentTurnPlayer();
    if (current.id !== playerId) {
      return { ok: false, error: 'It is not your turn.' };
    }
    const maxPlayable = this.deckCount === 2 ? 6 : 4;
    if (!Array.isArray(cardIds) || cardIds.length < 1 || cardIds.length > maxPlayable) {
      return { ok: false, error: `You must play between 1 and ${maxPlayable} cards.` };
    }
    const uniqueIds = new Set(cardIds);
    if (uniqueIds.size !== cardIds.length) {
      return { ok: false, error: 'Duplicate card selection is not allowed.' };
    }

    const playedCards: Card[] = [];
    for (const id of cardIds) {
      const card = current.hand.find((c) => c.id === id);
      if (!card) {
        return { ok: false, error: 'One or more selected cards are not in your hand.' };
      }
      playedCards.push(card);
    }

    current.hand = current.hand.filter((c) => !uniqueIds.has(c.id));
    this.discardPile.push(...playedCards);

    const declaredRank = this.getRequiredRank();
    const wasBluff = playedCards.some((c) => c.rank !== declaredRank);

    current.observed.totalPlays += 1;
    if (playedCards.length >= 2) {
      current.observed.boldPlays += 1;
    }

    this.lastHiddenPlay = {
      playId: `play_${Date.now()}_${crypto.randomInt(10000)}`,
      playerId: current.id,
      playerName: current.username,
      declaredRank,
      cards: playedCards,
      wasBluff,
      timestamp: Date.now(),
    };

    for (const p of this.players) {
      p.hasAcceptedCurrentPlay = p.id === current.id;
    }

    this.pendingWinnerId = current.hand.length === 0 ? current.id : null;
    this.challengeResult = null;
    this.phase = 'awaiting_response';

    const plural = playedCards.length === 1 ? '' : 's';
    this.pushLog(
      'play',
      `${current.username} placed ${playedCards.length} card${plural} claiming ${playedCards.length}× ${declaredRank}${
        this.pendingWinnerId ? ' (FINAL HAND!)' : ''
      }.`
    );

    this.startChallengeTimer();
    this.callbacks.onStateChanged();
    return { ok: true };
  }

  public acceptClaim(playerId: string): { ok: true } | { ok: false; error: string } {
    if (this.phase !== 'awaiting_response' || !this.lastHiddenPlay) {
      return { ok: false, error: 'There is no active claim to accept.' };
    }
    if (this.lastHiddenPlay.playerId === playerId) {
      return { ok: false, error: 'You cannot accept your own play.' };
    }
    const player = this.players.find((p) => p.id === playerId);
    if (!player) {
      return { ok: false, error: 'Player not found in this match.' };
    }
    if (player.hasAcceptedCurrentPlay) {
      return { ok: true };
    }

    player.hasAcceptedCurrentPlay = true;

    const allAccepted = this.players.every((p) => p.hasAcceptedCurrentPlay);
    if (allAccepted) {
      this.finalizeUnchallengedPlay();
    } else {
      this.callbacks.onStateChanged();
    }
    return { ok: true };
  }

  public finalizeUnchallengedPlay(): void {
    if (this.phase !== 'awaiting_response' || !this.lastHiddenPlay) return;
    this.clearAllTimers();

    const actor = this.players.find((p) => p.id === this.lastHiddenPlay!.playerId);
    if (actor && this.lastHiddenPlay.wasBluff) {
      actor.matchStats.successfulBluffs += 1;
      if (this.lastHiddenPlay.cards.length >= 3) {
        actor.riskTakerEarned = true;
      }
      if (this.pendingWinnerId === actor.id) {
        actor.wonWithFinalBluff = true;
      }
    }

    if (this.pendingWinnerId) {
      this.completeMatch(this.pendingWinnerId);
      return;
    }

    this.advanceTurnAndRank();
    this.phase = 'playing';
    this.startTurnTimer();
    this.callbacks.onStateChanged();
  }

  public challengePlay(challengerId: string): { ok: true } | { ok: false; error: string } {
    if (this.phase !== 'awaiting_response' || !this.lastHiddenPlay) {
      return { ok: false, error: 'No active play to challenge.' };
    }
    if (this.lastHiddenPlay.playerId === challengerId) {
      return { ok: false, error: 'You cannot challenge your own play.' };
    }
    const challenger = this.players.find((p) => p.id === challengerId);
    const accused = this.players.find((p) => p.id === this.lastHiddenPlay!.playerId);
    if (!challenger || !accused) {
      return { ok: false, error: 'Invalid challenger.' };
    }

    this.clearAllTimers();

    const wasBluff = this.lastHiddenPlay.wasBluff;
    const revealedCards = [...this.lastHiddenPlay.cards];
    const pileSize = this.discardPile.length;

    let loser: InternalPlayer;
    if (wasBluff) {
      loser = accused;
      accused.matchStats.failedBluffs += 1;
      accused.observed.caughtBluffs += 1;
      challenger.matchStats.correctChallenges += 1;
      this.pendingWinnerId = null;

      this.pushLog(
        'challenge_bluff',
        `${challenger.username} called BLUFF on ${accused.username} — CAUGHT! ${accused.username} takes ${pileSize} cards.`
      );
    } else {
      loser = challenger;
      accused.observed.verifiedTruths += 1;
      challenger.matchStats.wrongChallenges += 1;
      if (this.pendingWinnerId === accused.id) {
        accused.survivedFinalChallenge = true;
      }

      this.pushLog(
        'challenge_truth',
        `${challenger.username} called BLUFF on ${accused.username} — TRUE CLAIM! ${challenger.username} takes ${pileSize} cards.`
      );
    }

    loser.hand = sortHand([...loser.hand, ...this.discardPile]);
    this.discardPile = [];

    this.challengeResult = {
      challengerId: challenger.id,
      challengerName: challenger.username,
      accusedId: accused.id,
      accusedName: accused.username,
      declaredRank: this.lastHiddenPlay.declaredRank,
      revealedCards,
      wasBluff,
      loserId: loser.id,
      loserName: loser.username,
      pileSizeTaken: pileSize,
      timestamp: Date.now(),
    };

    this.phase = 'challenge_reveal';
    this.challengeDeadline = null;
    this.callbacks.onStateChanged();

    const resolveReveal = () => {
      if (this.phase !== 'challenge_reveal') return;
      this.resolveAfterChallengeReveal(wasBluff ? challenger.id : accused.id);
    };

    if (this.enableTimers) {
      this.schedule(resolveReveal, CHALLENGE_REVEAL_MS);
    }

    return { ok: true };
  }

  public resolveAfterChallengeReveal(nextStarterId?: string): void {
    if (this.phase !== 'challenge_reveal') return;

    if (this.pendingWinnerId) {
      this.completeMatch(this.pendingWinnerId);
      this.callbacks.onChallengeRevealComplete(this.winner);
      return;
    }

    this.lastHiddenPlay = null;
    this.challengeResult = null;
    this.roundNumber += 1;
    this.requiredRankIndex = (this.requiredRankIndex + 1) % RANKS.length;

    if (nextStarterId) {
      const idx = this.players.findIndex((p) => p.id === nextStarterId);
      if (idx >= 0) {
        this.currentTurnIndex = idx;
      } else {
        this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
      }
    } else {
      this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
    }

    this.phase = 'playing';
    this.startTurnTimer();
    this.callbacks.onStateChanged();
    this.callbacks.onChallengeRevealComplete(null);
  }

  private advanceTurnAndRank(): void {
    this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
    this.requiredRankIndex = (this.requiredRankIndex + 1) % RANKS.length;
    if (this.currentTurnIndex === 0) {
      this.roundNumber += 1;
    }
  }

  private completeMatch(winnerId: string): void {
    this.clearAllTimers();
    this.phase = 'finished';
    this.challengeDeadline = null;
    const winnerPlayer = this.players.find((p) => p.id === winnerId) ?? this.players[0];
    const durationSec = Math.max(1, Math.round((Date.now() - this.startedAt) / 1000));

    this.pushLog('win', `${winnerPlayer.username} legally emptied their hand and WON the match!`);

    const participantSummary = this.players.map((p) => {
      const won = p.id === winnerPlayer.id;
      const unlocked: AchievementId[] = [];
      if (won) unlocked.push('first_victory');
      if (p.riskTakerEarned) unlocked.push('risk_taker');
      if (p.matchStats.correctChallenges >= 3 && p.matchStats.wrongChallenges === 0) {
        unlocked.push('perfect_detective');
      }
      if (won && p.survivedFinalChallenge) {
        unlocked.push('last_card_standing');
      }
      if (won && p.wonWithFinalBluff) {
        unlocked.push('unbelievable_bluff');
      }
      if (won && p.matchStats.failedBluffs === 0 && p.matchStats.wrongChallenges === 0) {
        unlocked.push('ice_cold');
      }
      return {
        userId: p.id,
        isBot: p.isBot,
        won,
        stats: { ...p.matchStats },
        unlockedAchievements: unlocked,
      };
    });

    const standings = [...this.players]
      .sort((a, b) => a.hand.length - b.hand.length)
      .map((p) => ({
        playerId: p.id,
        username: p.username,
        avatar: p.avatar,
        cardsRemaining: p.hand.length,
        isBot: p.isBot,
        matchStats: { ...p.matchStats },
      }));

    this.winner = {
      winnerId: winnerPlayer.id,
      winnerName: winnerPlayer.username,
      winnerAvatar: winnerPlayer.avatar,
      totalRounds: this.roundNumber,
      durationSec,
      newlyUnlockedAchievements: {},
      standings,
    };

    this.callbacks.onMatchFinished(this.winner, participantSummary);
    this.callbacks.onStateChanged();
  }

  public setNewlyUnlockedAchievements(map: Record<string, AchievementId[]>): void {
    if (this.winner) {
      this.winner.newlyUnlockedAchievements = map;
    }
  }

  public getSanitizedStateForRecipient(recipientId: string): SanitizedGameState {
    const me = this.players.find((p) => p.id === recipientId);
    const isSpectator = !me;

    const publicPlayers: PublicPlayerGameState[] = this.players.map((p) => ({
      id: p.id,
      username: p.username,
      avatar: p.avatar,
      isBot: p.isBot,
      botPersonality: p.botPersonality,
      connected: p.connected,
      cardCount: p.hand.length,
      hasAcceptedCurrentPlay: p.hasAcceptedCurrentPlay,
      matchStats: { ...p.matchStats },
      bluffMetrics: computeObservedBluffMetrics(p.observed),
      seatIndex: p.seatIndex,
    }));

    return {
      roomCode: this.roomCode,
      phase: this.phase,
      roundNumber: this.roundNumber,
      requiredRank: this.getRequiredRank(),
      currentTurnPlayerId: this.getCurrentTurnPlayer().id,
      pileCount: this.discardPile.length,
      deckCount: this.deckCount,
      totalDeckCards: this.totalDeckCards,
      remainingDeckCount: this.undealtDeck.length,
      cardsPerPlayerTarget: this.cardsPerPlayerTarget,
      distributionMode: this.distributionMode,
      shuffleSpeed: this.shuffleSpeed,
      lastDealEvent: this.lastDealEvent ? { ...this.lastDealEvent } : null,
      turnDeadline: this.turnDeadline,
      challengeDeadline: this.challengeDeadline,
      turnDurationSec: this.turnDurationSec,
      lastPlay: this.getLastPlayPublic(),
      pendingWinnerId: this.pendingWinnerId,
      challengeResult: this.challengeResult ? { ...this.challengeResult } : null,
      winner: this.winner ? { ...this.winner } : null,
      players: publicPlayers,
      spectators: [...this.spectators],
      myPlayerId: recipientId,
      isSpectator,
      myHand: me ? [...me.hand] : [],
      logs: [...this.logs],
    };
  }
}
