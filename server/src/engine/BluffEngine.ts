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
  hasPassedRound: boolean;
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

/**
 * Authoritative Turn-by-Turn ("Line-by-Line") Classic Bluff Engine:
 * - Strict clockwise turns: players can NEVER interrupt out of turn.
 * - Fresh round (pileCount === 0): active player chooses ANY rank (A-K) to declare and plays 1+ cards.
 * - Active round (pileCount > 0): on your turn, you may PLAY cards claiming the current rank,
 *   PASS your turn, or CALL BLUFF (CHALLENGE) on the previous play.
 * - If all other players PASS around to the last player who placed cards, the pile is cleared
 *   and that player starts a NEW round with any rank (or WINS if they have 0 cards!).
 */
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
  /** Null at the start of any fresh round — active player chooses ANY rank (A-K). */
  private activeRank: Rank | null = null;
  private currentTurnIndex = 0;
  private players: InternalPlayer[] = [];
  private spectators: SpectatorInfo[] = [];

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
    this.undealtDeck = createShuffledDeck(this.deckCount);

    this.players = params.players.map((p, idx) => ({
      ...p,
      hand: [],
      hasPassedRound: false,
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
    for (const t of this.timers) clearTimeout(t);
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
      p.hasPassedRound = false;
    }
    this.activeRank = null; // Fresh round: first player picks ANY rank!
    this.phase = 'playing';
    this.startedAt = Date.now();
    const starter = this.getCurrentTurnPlayer();
    const remaining = this.undealtDeck.length;
    this.pushLog(
      'system',
      `Dealing complete! ${starter.username} starts Round 1 and can choose ANY rank.${
        remaining > 0 ? ` ${remaining} undealt cards remain in shoe.` : ''
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

  public getRequiredRank(): Rank | null {
    return this.activeRank;
  }

  public isFreshRound(): boolean {
    return this.activeRank === null || this.discardPile.length === 0;
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
    hasPassedRound: boolean;
  }> {
    return this.players.map((p) => ({
      id: p.id,
      username: p.username,
      isBot: p.isBot,
      botPersonality: p.botPersonality,
      cardCount: p.hand.length,
      hasPassedRound: p.hasPassedRound,
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

  private startTurnTimer(): void {
    this.clearAllTimers();
    this.turnDeadline = Date.now() + this.turnDurationSec * 1000;
    if (!this.enableTimers) return;

    this.schedule(() => {
      if (this.phase !== 'playing') return;
      this.autoActForCurrentPlayer();
    }, this.turnDurationSec * 1000);
  }

  public autoActForCurrentPlayer(): void {
    if (this.phase !== 'playing') return;
    const player = this.getCurrentTurnPlayer();
    if (this.isFreshRound()) {
      if (player.hand.length === 0) return;
      const card = player.hand[0];
      this.pushLog('system', `${player.username} timed out and auto-started with 1× ${card.rank}.`);
      this.playCards(player.id, [card.id], card.rank);
    } else {
      this.pushLog('system', `${player.username} timed out and auto-passed.`);
      this.passTurn(player.id);
    }
  }

  /**
   * Credits the previous unchallenged bluff (if any) once play moves on without challenge.
   */
  private creditPreviousUnchallengedBluff(): void {
    if (!this.lastHiddenPlay || !this.lastHiddenPlay.wasBluff) return;
    const actor = this.players.find((p) => p.id === this.lastHiddenPlay!.playerId);
    if (!actor) return;
    actor.matchStats.successfulBluffs += 1;
    if (this.lastHiddenPlay.cards.length >= 3) {
      actor.riskTakerEarned = true;
    }
    if (this.pendingWinnerId === actor.id) {
      actor.wonWithFinalBluff = true;
    }
  }

  /**
   * Line-by-line turn play:
   * - Strictly validates it is `playerId`'s turn.
   * - On a fresh round, player may choose ANY rank (`declaredRank`) to start the round!
   * - On an active round, cards are declared as `this.activeRank`.
   */
  public playCards(
    playerId: string,
    cardIds: string[],
    declaredRankInput?: Rank
  ): { ok: true } | { ok: false; error: string } {
    if (this.phase !== 'playing') {
      return { ok: false, error: 'Cannot play cards right now.' };
    }
    const current = this.getCurrentTurnPlayer();
    if (current.id !== playerId) {
      return { ok: false, error: 'Wait for your turn — you cannot interrupt another player!' };
    }
    if (this.pendingWinnerId) {
      return {
        ok: false,
        error: 'A player emptied their hand! On your turn, either PASS or CALL BLUFF.',
      };
    }

    const maxPlayable = this.deckCount === 2 ? 6 : 4;
    if (!Array.isArray(cardIds) || cardIds.length < 1 || cardIds.length > maxPlayable) {
      return { ok: false, error: `You must select between 1 and ${maxPlayable} cards.` };
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

    let declaredRank: Rank;
    if (this.isFreshRound()) {
      const candidate = declaredRankInput ?? playedCards[0].rank;
      if (!RANKS.includes(candidate)) {
        return { ok: false, error: 'Choose a valid card rank (A–K) to start the round.' };
      }
      declaredRank = candidate;
      this.activeRank = declaredRank;
      for (const p of this.players) p.hasPassedRound = false;
    } else {
      // Previous play went unchallenged because current player chose to play on top of it
      this.creditPreviousUnchallengedBluff();
      declaredRank = this.activeRank!;
    }

    // Remove played cards from player's hand & add to center pile
    current.hand = current.hand.filter((c) => !uniqueIds.has(c.id));
    this.discardPile.push(...playedCards);

    const wasBluff = playedCards.some((c) => c.rank !== declaredRank);
    current.observed.totalPlays += 1;
    if (playedCards.length >= 2) {
      current.observed.boldPlays += 1;
    }
    // Reset passes whenever fresh cards are thrown so everyone gets their next chance in line
    for (const p of this.players) {
      p.hasPassedRound = false;
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

    // Track if this player emptied their hand — must survive clockwise passes/challenges to win!
    this.pendingWinnerId = current.hand.length === 0 ? current.id : null;
    this.challengeResult = null;

    const plural = playedCards.length === 1 ? '' : 's';
    this.pushLog(
      'play',
      `${current.username} placed ${playedCards.length} card${plural} claiming ${playedCards.length}× ${declaredRank}${
        this.pendingWinnerId ? ' (FINAL HAND!)' : ''
      }.`
    );

    // Move strictly clockwise line-by-line to the next player!
    this.advanceToNextActiveSeat();
    this.startTurnTimer();
    this.callbacks.onStateChanged();
    return { ok: true };
  }

  /**
   * Line-by-line PASS on your own turn:
   * - Strictly validates it is `playerId`'s turn.
   * - If everyone else passes all the way back to the last player who placed cards,
   *   the pile is cleared and that player starts a NEW round choosing ANY rank (or WINS if 0 cards left!).
   */
  public passTurn(playerId: string): { ok: true } | { ok: false; error: string } {
    if (this.phase !== 'playing') {
      return { ok: false, error: 'Cannot pass right now.' };
    }
    const current = this.getCurrentTurnPlayer();
    if (current.id !== playerId) {
      return { ok: false, error: 'Wait for your turn — you cannot act out of turn!' };
    }
    if (this.isFreshRound() || !this.lastHiddenPlay) {
      return {
        ok: false,
        error: 'You are starting a new round — select at least 1 card and pick any rank!',
      };
    }

    current.hasPassedRound = true;
    this.pushLog('accept', `${current.username} passed.`);

    // Check if every player OTHER than the last actor has now passed
    const lastActorId = this.lastHiddenPlay.playerId;
    const allOthersPassed = this.players.every(
      (p) => p.id === lastActorId || p.hasPassedRound
    );

    if (allOthersPassed) {
      this.creditPreviousUnchallengedBluff();

      // Did the pending winner survive unchallenged all the way around?
      if (this.pendingWinnerId) {
        this.completeMatch(this.pendingWinnerId);
        return { ok: true };
      }

      // Burn/clear the center pile and give the last actor a fresh round with ANY rank!
      const lastActorIdx = this.players.findIndex((p) => p.id === lastActorId);
      const actorName = this.players[lastActorIdx]?.username ?? 'Player';
      const clearedCount = this.discardPile.length;

      this.discardPile = [];
      this.lastHiddenPlay = null;
      this.activeRank = null;
      this.roundNumber += 1;
      for (const p of this.players) p.hasPassedRound = false;
      this.currentTurnIndex = lastActorIdx >= 0 ? lastActorIdx : (this.currentTurnIndex + 1) % this.players.length;

      this.pushLog(
        'system',
        `Everyone passed! ${clearedCount} cards cleared. ${actorName} starts Round ${this.roundNumber} with ANY rank!`
      );
      this.startTurnTimer();
      this.callbacks.onStateChanged();
      return { ok: true };
    }

    this.advanceToNextActiveSeat();
    this.startTurnTimer();
    this.callbacks.onStateChanged();
    return { ok: true };
  }

  /**
   * Line-by-line CHALLENGE (CALL BLUFF):
   * - Strictly allowed ONLY on `challengerId`'s own turn (cannot interrupt another player's chance!).
   */
  public challengePlay(challengerId: string): { ok: true } | { ok: false; error: string } {
    if (this.phase !== 'playing') {
      return { ok: false, error: 'Cannot challenge right now.' };
    }
    const current = this.getCurrentTurnPlayer();
    if (current.id !== challengerId) {
      return {
        ok: false,
        error: 'Wait for your turn — you can only Call Bluff on your own chance!',
      };
    }
    if (!this.lastHiddenPlay || this.discardPile.length === 0) {
      return { ok: false, error: 'There is no play to challenge yet.' };
    }
    if (this.lastHiddenPlay.playerId === challengerId) {
      return { ok: false, error: 'You cannot challenge your own play.' };
    }

    const challenger = current;
    const accused = this.players.find((p) => p.id === this.lastHiddenPlay!.playerId);
    if (!accused) {
      return { ok: false, error: 'Accused player not found.' };
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
    this.callbacks.onStateChanged();

    const nextStarterId = wasBluff ? challenger.id : accused.id;
    const resolveReveal = () => {
      if (this.phase !== 'challenge_reveal') return;
      this.resolveAfterChallengeReveal(nextStarterId);
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
    this.activeRank = null; // Fresh round — winner of challenge picks ANY rank!
    this.roundNumber += 1;
    for (const p of this.players) p.hasPassedRound = false;

    if (nextStarterId) {
      const idx = this.players.findIndex((p) => p.id === nextStarterId);
      this.currentTurnIndex = idx >= 0 ? idx : (this.currentTurnIndex + 1) % this.players.length;
    } else {
      this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
    }

    const starter = this.getCurrentTurnPlayer();
    this.pushLog(
      'system',
      `New Round ${this.roundNumber}! ${starter.username} can throw cards and choose ANY rank.`
    );

    this.phase = 'playing';
    this.startTurnTimer();
    this.callbacks.onStateChanged();
    this.callbacks.onChallengeRevealComplete(null);
  }

  private advanceToNextActiveSeat(): void {
    const total = this.players.length;
    for (let step = 1; step <= total; step++) {
      const idx = (this.currentTurnIndex + step) % total;
      const candidate = this.players[idx];
      if (!candidate.hasPassedRound && candidate.id !== this.pendingWinnerId) {
        this.currentTurnIndex = idx;
        return;
      }
    }
    this.currentTurnIndex = (this.currentTurnIndex + 1) % total;
  }

  private completeMatch(winnerId: string): void {
    this.clearAllTimers();
    this.phase = 'finished';
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
      if (won && p.survivedFinalChallenge) unlocked.push('last_card_standing');
      if (won && p.wonWithFinalBluff) unlocked.push('unbelievable_bluff');
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
      hasPassedRound: p.hasPassedRound,
      matchStats: { ...p.matchStats },
      bluffMetrics: computeObservedBluffMetrics(p.observed),
      seatIndex: p.seatIndex,
    }));

    return {
      roomCode: this.roomCode,
      phase: this.phase,
      roundNumber: this.roundNumber,
      requiredRank: this.activeRank,
      isFreshRound: this.isFreshRound(),
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
