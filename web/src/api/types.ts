import type { ParallelName, Position, LineupRoleName } from '@rip/shared';

export interface User {
  id: string;
  username: string;
  email: string | null;
  tokens: number;
  cases: number;
  dust: number;
  rating: number;
  dailyStreak: number;
  lastDailyClaimAt: string | null;
  createdAt: string;
}

export interface PulledCard {
  instanceId: string;
  player: {
    id: string;
    name: string;
    position: Position;
    currentValue: number;
    teamName: string;
    teamAbbr: string;
  };
  parallel: ParallelName;
  serial: number | null;
  printRun: number | null;
  valueMultiplier: number;
  marketValue: number;
  isHit: boolean;
  refractor: boolean;
}

export interface OddsRow {
  parallel: ParallelName;
  displayName: string;
  printRun: number | null;
  refractor: boolean;
  color: string;
  percent: number;
  oneIn: number | null;
}

export interface Product {
  id: string;
  name: string;
  year: number;
  entryCost: number;
  caseCost: number;
  tier: string;
  cardsPerPack: number;
  description: string;
  topPlayerBias: number;
  odds: OddsRow[];
}

export interface CollectionCard {
  id: string;
  parallel: ParallelName;
  serial: number | null;
  printRun: number | null;
  valueMultiplier: number;
  marketValue: number;
  refractor: boolean;
  pulledAt: string;
  equippedRole: LineupRoleName | null;
  player: {
    id: string;
    name: string;
    position: Position;
    overallRating: number;
    currentValue: number;
    teamName: string;
    teamAbbr: string;
  };
}

export interface Collection {
  cards: CollectionCard[];
  summary: {
    total: number;
    numbered: number;
    base: number;
    totalValue: number;
    recyclableBase: number;
    dustPerBase: number;
  };
}

export interface LineupSlotView {
  role: LineupRoleName;
  eligiblePositions: Position[];
  card: CollectionCard | null;
}

export interface Lineup {
  slots: LineupSlotView[];
  totalValue: number;
}

export interface DailyStatus {
  canClaim: boolean;
  nextClaimAt: string | null;
  streak: number;
  currentTier: { name: string; cards: number; tokenReward: number; caseReward: number };
  nextTier: { name: string; atStreak: number } | null;
}

export interface TeamSummary {
  id: string;
  name: string;
  abbreviation: string;
  conference: string;
  division: string;
  primaryColor: string;
  secondaryColor: string;
  playerCount: number;
}

export interface TopPlayer {
  id: string;
  name: string;
  position: Position;
  overallRating: number;
  currentValue: number;
  isTopPlayer: boolean;
  lastWeek: { weekNumber: number; fantasyPoints: number; passYds: number; rushYds: number; recYds: number; tds: number } | null;
  valueTrend: { weekNumber: number; value: number; delta: number }[];
}

export interface TeamDetail {
  team: TeamSummary;
  topPlayers: TopPlayer[];
}

export interface PlayerDetail {
  player: {
    id: string;
    name: string;
    position: Position;
    overallRating: number;
    currentValue: number;
    isTopPlayer: boolean;
    team: { id: string; name: string; abbreviation: string };
  };
  recentStats: {
    weekNumber: number;
    passYds: number;
    passTd: number;
    interceptions: number;
    rushYds: number;
    rushTd: number;
    receptions: number;
    recYds: number;
    recTd: number;
    fantasyPoints: number;
  }[];
  valueHistory: { weekNumber: number; value: number; delta: number }[];
  parallels: { parallel: ParallelName; printRun: number; allocated: number; remaining: number }[];
}

export interface BattleResult {
  battleId: string;
  result: 'win' | 'loss' | 'tie';
  challengerCards: PulledCard[];
  opponentCards: PulledCard[];
  challengerTotal: number;
  opponentTotal: number;
  rewardTokens: number;
  rewardCases: number;
  ratingDelta: number;
  user: User;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  points: number;
}

export interface RipResult {
  product: { id: string; name: string };
  cards: PulledCard[];
  packValue: number;
  paidWith: string;
  user: User;
}

export interface DailyClaimResult {
  claimed: boolean;
  streak: number;
  tier: { name: string; tokenReward: number; caseReward: number };
  cards: PulledCard[];
  packValue: number;
  user: User;
}
