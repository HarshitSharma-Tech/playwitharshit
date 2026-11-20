export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

export type Rank =
  | 'A'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K';

export const RANKS: Rank[] = [
  'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K',
];

export const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

export interface Card {
  /** Guaranteed unique physical card ID (e.g. d1_A_spades, d2_A_spades) */
  id: string;
  suit: Suit;
  rank: Rank;
  deckIndex?: 1 | 2;
}

export type GameMode = 'quick_play' | 'private' | 'bots';
export type Difficulty = 'casual' | 'competitive';
export type TurnTimerOption = 15 | 30 | 45;
/** 0 = deal entire deck evenly, or any custom integer 1..52 validated against deckCount * 52 / players */
export type CardsPerPlayerOption = number;
export type DeckCountOption = 1 | 2;
export type DistributionMode = 'automatic' | 'manual';
export type ShuffleSpeed = 'slow' | 'normal' | 'fast';
export type FirstPlayerMode = 'random' | 'host_selected';

export type BotPersonality = 'aggressive' | 'strategic' | 'unpredictable' | 'defensive';
export type ReactionEmoji = '😂' | '😈' | '🤔' | '🔥' | '👀';

export const VOICE_PHRASES = [
  "You're bluffing!",
  "I don't believe you!",
  'Nice try!',
  'No way!',
  "Abbe jhoot bol raha hai saala!",
  "Kya fek raha hai bhai?!",
  "Pakda gaya chomu!",
  "Gajab beizzati hai yaar!",
  "Chal hat, ullu mat bana!",
  "Khatam, tata, bye-bye!",
  "Asli khiladi hoon main!",
  "Aukat mein reh bawa!",
] as const;

export type VoicePhrase = (typeof VOICE_PHRASES)[number];

export interface RoomSettings {
  roomName: string;
  maxPlayers: number; // 2-6
  cardsPerPlayer: CardsPerPlayerOption;
  deckCount: DeckCountOption;
  distributionMode: DistributionMode;
  shuffleSpeed: ShuffleSpeed;
  firstPlayerMode: FirstPlayerMode;
  firstPlayerId: string | null;
  difficulty: Difficulty;
  turnTimer: TurnTimerOption;
  allowSpectators: boolean;
  enableBots: boolean;
  hasPassword: boolean;
}

export interface CreateRoomPayload {
  roomName: string;
  maxPlayers: number;
  cardsPerPlayer: CardsPerPlayerOption;
  deckCount?: DeckCountOption;
  distributionMode?: DistributionMode;
  shuffleSpeed?: ShuffleSpeed;
  firstPlayerMode?: FirstPlayerMode;
  firstPlayerId?: string | null;
  difficulty: Difficulty;
  turnTimer: TurnTimerOption;
  allowSpectators: boolean;
  enableBots: boolean;
  password?: string;
}

export interface PlayerReputation {
  successfulBluffs: number;
  failedBluffs: number;
  correctChallenges: number;
  wrongChallenges: number;
}

export interface ObservedBluffMetrics {
  /** Total plays made in this match */
  totalPlays: number;
  /** Number of times caught bluffing in this match */
  caughtBluffs: number;
  /** Number of times challenged and proved truthful */
  verifiedTruths: number;
  /** Multi-card plays (2+) made */
  boldPlays: number;
  /** 0-100 observed suspicion / boldness meter based solely on public events */
  observedMeter: number;
  label: 'Calm' | 'Cautious' | 'Bold' | 'High Heat' | 'Chaos Agent';
}

export interface LobbyPlayer {
  id: string;
  username: string;
  avatar: string;
  isHost: boolean;
  isReady: boolean;
  isBot: boolean;
  botPersonality?: BotPersonality;
  connected: boolean;
  reputation: PlayerReputation;
}

export interface SpectatorInfo {
  id: string;
  username: string;
  avatar: string;
  connected: boolean;
}

export interface PublicRoomSummary {
  code: string;
  roomName: string;
  mode: GameMode;
  playerCount: number;
  maxPlayers: number;
  status: 'lobby' | 'playing' | 'finished';
  hasPassword: boolean;
  allowSpectators: boolean;
  difficulty: Difficulty;
}

export interface LobbyState {
  code: string;
  mode: GameMode;
  status: 'lobby' | 'playing' | 'finished';
  settings: RoomSettings;
  hostId: string;
  players: LobbyPlayer[];
  spectators: SpectatorInfo[];
  createdAt: number;
}

export type GamePhase =
  | 'shuffling'
  | 'ready_to_deal'
  | 'dealing'
  | 'playing'
  | 'awaiting_response'
  | 'challenge_reveal'
  | 'finished';

export interface DealEventPublic {
  seq: number;
  targetPlayerId: string;
  targetSeatIndex: number;
  dealtCountTotal: number;
  totalToDeal: number;
  timestamp: number;
}

export interface PublicPlayerGameState {
  id: string;
  username: string;
  avatar: string;
  isBot: boolean;
  botPersonality?: BotPersonality;
  connected: boolean;
  cardCount: number;
  hasAcceptedCurrentPlay: boolean;
  matchStats: PlayerReputation;
  bluffMetrics: ObservedBluffMetrics;
  seatIndex: number;
}

export interface LastPlayPublicInfo {
  playId: string;
  playerId: string;
  playerName: string;
  declaredRank: Rank;
  count: number;
  timestamp: number;
}

export interface ChallengeResult {
  challengerId: string;
  challengerName: string;
  accusedId: string;
  accusedName: string;
  declaredRank: Rank;
  revealedCards: Card[];
  wasBluff: boolean;
  loserId: string;
  loserName: string;
  pileSizeTaken: number;
  timestamp: number;
}

export interface MatchWinnerInfo {
  winnerId: string;
  winnerName: string;
  winnerAvatar: string;
  totalRounds: number;
  durationSec: number;
  newlyUnlockedAchievements: Record<string, AchievementId[]>;
  standings: Array<{
    playerId: string;
    username: string;
    avatar: string;
    cardsRemaining: number;
    isBot: boolean;
    matchStats: PlayerReputation;
  }>;
}

export interface GameLogEntry {
  id: string;
  timestamp: number;
  type: 'play' | 'accept' | 'challenge_bluff' | 'challenge_truth' | 'system' | 'win';
  message: string;
}

/**
 * Strictly sanitized per-recipient game state.
 * `myHand` ONLY contains the receiving player's cards (empty array for spectators).
 * Opponents' cards and undealt deck identities are NEVER included anywhere in this payload.
 */
export interface SanitizedGameState {
  roomCode: string;
  phase: GamePhase;
  roundNumber: number;
  requiredRank: Rank;
  currentTurnPlayerId: string;
  pileCount: number;
  deckCount: DeckCountOption;
  totalDeckCards: number;
  remainingDeckCount: number;
  cardsPerPlayerTarget: number;
  distributionMode: DistributionMode;
  shuffleSpeed: ShuffleSpeed;
  lastDealEvent: DealEventPublic | null;
  turnDeadline: number;
  challengeDeadline: number | null;
  turnDurationSec: number;
  lastPlay: LastPlayPublicInfo | null;
  pendingWinnerId: string | null;
  challengeResult: ChallengeResult | null;
  winner: MatchWinnerInfo | null;
  players: PublicPlayerGameState[];
  spectators: SpectatorInfo[];
  myPlayerId: string;
  isSpectator: boolean;
  myHand: Card[];
  logs: GameLogEntry[];
}

export interface ReactionEvent {
  id: string;
  roomCode: string;
  playerId: string;
  username: string;
  emoji?: ReactionEmoji;
  phrase?: VoicePhrase;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  roomCode: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  memeId?: string;
  memeTitle?: string;
  memeImage?: string;
  memeTag?: string;
  timestamp: number;
}

// ---- VOICE CHAT TYPES ----

export interface VoicePeerState {
  userId: string;
  username: string;
  micEnabled: boolean;
  muted: boolean;
  speaking: boolean;
  connected: boolean;
}

export interface VoiceTokenPayload {
  token: string;
  roomCode: string;
  expiresAt: number;
  iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }>;
}

export type AchievementId =
  | 'master_deceiver'
  | 'perfect_detective'
  | 'risk_taker'
  | 'last_card_standing'
  | 'unbelievable_bluff'
  | 'first_victory'
  | 'ice_cold'
  | 'table_shark';

export interface AchievementDefinition {
  id: AchievementId;
  title: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'first_victory',
    title: 'First Blood',
    description: 'Win your first match of BLUFFED.',
    icon: 'trophy',
    rarity: 'common',
  },
  {
    id: 'master_deceiver',
    title: 'Master Deceiver',
    description: 'Pull off 5 successful bluffs across your career.',
    icon: 'mask',
    rarity: 'rare',
  },
  {
    id: 'perfect_detective',
    title: 'Perfect Detective',
    description: 'Make 3 correct challenges in a single match without a wrong call.',
    icon: 'search',
    rarity: 'epic',
  },
  {
    id: 'risk_taker',
    title: 'Risk Taker',
    description: 'Successfully bluff with 3 or more cards in a single turn.',
    icon: 'flame',
    rarity: 'rare',
  },
  {
    id: 'last_card_standing',
    title: 'Last Card Standing',
    description: 'Win a match after surviving a challenge on your final play.',
    icon: 'shield',
    rarity: 'epic',
  },
  {
    id: 'unbelievable_bluff',
    title: 'Unbelievable Bluff',
    description: 'Win a match by bluffing on your very last play without getting caught.',
    icon: 'sparkles',
    rarity: 'legendary',
  },
  {
    id: 'ice_cold',
    title: 'Ice Cold',
    description: 'Win a match with zero failed bluffs and zero wrong challenges.',
    icon: 'snowflake',
    rarity: 'epic',
  },
  {
    id: 'table_shark',
    title: 'Table Shark',
    description: 'Reach 10 career victories.',
    icon: 'crown',
    rarity: 'legendary',
  },
];

export interface UserProfile {
  id: string;
  username: string;
  email?: string;
  avatar: string;
  isGuest: boolean;
  gamesPlayed: number;
  wins: number;
  winRate: number;
  successfulBluffs: number;
  failedBluffs: number;
  correctChallenges: number;
  wrongChallenges: number;
  achievements: AchievementId[];
  createdAt: string;
}

export interface MatchHistoryItem {
  id: string;
  roomCode: string;
  mode: GameMode;
  playedAt: string;
  won: boolean;
  playerCount: number;
  rounds: number;
  successfulBluffs: number;
  correctChallenges: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatar: string;
  gamesPlayed: number;
  wins: number;
  winRate: number;
  successfulBluffs: number;
  correctChallenges: number;
  score: number;
  isDemo?: boolean;
}

export type LeaderboardCategory =
  | 'global'
  | 'weekly'
  | 'wins'
  | 'bluffers'
  | 'detectives';

export interface PlatformStats {
  totalGamesPlayed: number;
  activePlayers: number;
  liveRooms: number;
  bluffsCaughtToday: number;
  isLiveWithDemoBaseline: boolean;
  highlights: Array<{
    id: string;
    title: string;
    player: string;
    detail: string;
    tag: string;
  }>;
}

export interface QuickPlayStatus {
  searching: boolean;
  queueSize: number;
  minPlayers: number;
  estimatedWaitSec: number;
}
