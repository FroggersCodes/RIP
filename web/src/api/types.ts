import type { ParallelName, Position, LineupRoleName } from '@rip/shared';

export interface User {
  id: string;
  username: string;
  email: string | null;
  tokens: number;
  cases: number;
  gems: number;
  rating: number;
  dailyStreak: number;
  lastDailyClaimAt: string | null;
  loginStreak: number;
  lastLoginRewardAt: string | null;
  lastHourlyClaimAt: string | null;
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
  setKey: string;
}

export interface OddsRow {
  parallel: ParallelName;
  displayName: string;
  printRun: number | null;
  refractor: boolean;
  color: string;
  /** Expected copies of this parallel per pack (slot-exact for slotted sets). */
  perPack: number;
  oneInPacks: number | null;
}

export interface Product {
  id: string;
  name: string;
  year: number;
  entryCost: number;
  caseCost: number;
  gemCost: number;
  tier: string;
  setKey: string;
  cardsPerPack: number;
  packsPerBox: number;
  guaranteeNumbered: boolean;
  description: string;
  topPlayerBias: number;
  totalBoxes: number | null;
  boxesOpened: number;
  boxesRemaining: number | null;
  soldOut: boolean;
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
  setKey: string;
  equippedRole: LineupRoleName | null;
  listed: boolean;
  listPrice: number | null;
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
  };
}

export interface SetChecklistPlayer {
  id: string;
  name: string;
  position: Position;
  owned: boolean;
}
export interface SetChecklistTeam {
  name: string;
  abbreviation: string;
  total: number;
  owned: number;
  gems: number;
  complete: boolean;
  claimed: boolean;
  claimable: boolean;
  players: SetChecklistPlayer[];
}
export interface SetProgress {
  setKey: string;
  label: string;
  wordmark: string;
  tierLevel: number;
  gemsPerTeam: number;
  total: number;
  owned: number;
  teamsTotal: number;
  teamsComplete: number;
  teamsClaimed: number;
  teams: SetChecklistTeam[];
}
export interface SetsResponse {
  sets: SetProgress[];
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

export interface LoginRewardView {
  coins: number;
  gems: number;
  /** Set key of the free pack this day awards, or null on non-pack days. */
  packSetKey: string | null;
  /** Display label for the pack (e.g. "Artistry"), or null. */
  packLabel: string | null;
}

export interface RewardsStatus {
  hourly: {
    canClaim: boolean;
    coins: number;
    ratePerHour: number;
    capHours: number;
    maxCoins: number;
    bankedHours: number;
    maxedOut: boolean;
    nextClaimAt: string | null;
  };
  daily: {
    canClaim: boolean;
    streak: number;
    nextClaimAt: string | null;
    reward: LoginRewardView;
    nextReward: LoginRewardView;
  };
}

export interface HourlyClaimResult {
  claimed: boolean;
  coins: number;
  user: User;
}

export interface DailyRewardResult {
  claimed: boolean;
  streak: number;
  reward: LoginRewardView;
  cards: PulledCard[];
  packValue: number;
  user: User;
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
  totals: { season: PlayerTotals; career: PlayerTotals };
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

export interface StatLeader {
  id: string;
  name: string;
  position: Position | null;
  team: string;
  value: number;
  fantasy?: number;
  games?: number;
}
export interface StatCategory {
  label: string;
  unit: string;
  leaders: StatLeader[];
}
export interface WeeklyLeaders {
  week: { season: number; weekNumber: number } | null;
  categories: StatCategory[];
}
export interface SeasonLeaders {
  season: number;
  categories: StatCategory[];
}

export interface StandingRow {
  teamId: string;
  name: string;
  abbreviation: string;
  conference: string;
  division: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  diff: number;
  rank: number;
  playoffSeed: number | null;
}
export interface Standings {
  season: number;
  standings: StandingRow[];
}

export interface BracketGame {
  home: string;
  away: string;
  homeSeed: number | null;
  awaySeed: number | null;
  homeScore: number;
  awayScore: number;
  played: boolean;
}
export interface Bracket {
  season: number;
  rounds: { QF: BracketGame[]; SF: BracketGame[]; FINAL: BracketGame[] };
}

export interface ChampionRow {
  season: number;
  champion: string;
  championAbbr: string;
  runnerUp: string;
  runnerUpAbbr: string;
  topUser: string | null;
  topUserPoints: number | null;
}

export interface FeedEvent {
  id: string;
  type: 'PULL' | 'SALE' | 'WEEK' | 'CHAMPION';
  text: string;
  parallel: string | null;
  marketValue: number | null;
  createdAt: string;
}

export interface Mission {
  key: string;
  label: string;
  period: 'DAILY' | 'ONCE';
  target: number;
  progress: number;
  claimed: boolean;
  claimable: boolean;
  rewardTokens: number;
  rewardCases: number;
}

export interface ClockInfo {
  autoAdvance: boolean;
  cadenceHours: number;
  lockMinutes: number;
  lastAdvanceAt: string;
  nextAdvanceAt: string;
  locked: boolean;
  msToKickoff: number;
  msToLock: number;
  luckBoost: number;
  forceParallel: string | null;
}

export interface PlayerTotals {
  games: number;
  passYds: number;
  passTd: number;
  interceptions: number;
  rushYds: number;
  rushTd: number;
  receptions: number;
  recYds: number;
  recTd: number;
  fantasyPoints: number;
  avgFantasy: number;
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
