// --- Play types (string unions, no enums per tsconfig) ---

export type HalfInning = 'top' | 'bottom'
export type GameStatus = 'draft' | 'in_progress' | 'completed' | 'deleted'
export type Side = 'home' | 'away'
export type PitchResult = 'B' | 'S' | 'F'

// Play types that count as an at-bat (advance the batter)
export type AtBatPlayType =
  | 'K'           // strikeout swinging
  | 'KL'          // strikeout looking
  | 'BB'          // walk
  | 'HBP'         // hit by pitch
  | '1B'          // single
  | '2B'          // double
  | '3B'          // triple
  | 'HR'          // home run
  | 'GO'          // ground out (with fielders)
  | 'FO'          // fly out (with fielders)
  | 'LO'          // line out (with fielders)
  | 'PO'          // pop out (with fielders)
  | 'FC'          // fielder's choice
  | 'E'           // error
  | 'DP'          // double play
  | 'SAC'         // sacrifice

// Play types that do NOT advance the batter (happen during an at-bat)
export type NonAtBatPlayType =
  | 'SB'          // stolen base
  | 'CS'          // caught stealing
  | 'WP'          // wild pitch
  | 'PB'          // passed ball
  | 'BK'          // balk

export type PlayType = AtBatPlayType | NonAtBatPlayType

// --- Core data types ---

export interface Team {
  id?: number
  name: string
  createdAt: Date
}

export interface Player {
  id?: number
  teamId: number
  name: string
  jerseyNumber: number
  defaultPosition: string
  createdAt: Date
}

export interface Substitution {
  inning: number
  half: HalfInning
  newPlayerName: string
  newJerseyNumber: number
  newPosition: string
}

export interface LineupSlot {
  orderPosition: number        // 1-based batting order position
  playerId: number
  playerName: string
  jerseyNumber: number
  position: string
  substitutions: Substitution[]
}

export interface Lineup {
  id?: number
  gameId: number
  side: Side
  battingOrder: LineupSlot[]
}

export interface Game {
  id?: number
  team1Id: number
  team2Id: number
  homeTeamId: number  // must equal team1Id or team2Id
  code: string
  date: Date
  status: GameStatus
  createdAt: Date
  updatedAt: Date
}

// --- Play event log ---

export interface BaseRunner {
  playerName: string
  orderPosition: number
}

export interface BaseRunnerOverride {
  first: BaseRunner | null
  second: BaseRunner | null
  third: BaseRunner | null
}

export interface Play {
  id?: number
  gameId: number
  sequenceNumber: number
  inning: number
  half: HalfInning
  batterOrderPosition: number  // 1-based position in batting order
  playType: PlayType
  notation: string             // display string: "6-3", "1B", "K", etc.
  fieldersInvolved: number[]   // position numbers [6, 3]
  basesReached: number[]       // bases the BATTER reached: [1] for single, [1,2] for double, etc.
  runsScoredOnPlay: number
  rbis: number
  pitches: PitchResult[]       // per-pitch tracking: ["B", "S", "F", "B", "S"]
  isAtBat: boolean             // true for plays that advance the batting order
  runnerOverrides?: BaseRunnerOverride  // scorekeeper adjustments from confirm step
  pitcherName?: string               // who was pitching when this play was recorded
  timestamp: Date
}

// --- Computed game state (never stored) ---

export interface BaseRunners {
  first: BaseRunner | null
  second: BaseRunner | null
  third: BaseRunner | null
}

export interface GameSnapshot {
  inning: number
  half: HalfInning
  outs: number
  scoreHome: number
  scoreAway: number
  currentBatterHome: number      // 1-based order position
  currentBatterAway: number      // 1-based order position
  baseRunners: BaseRunners
  pitchCountByPitcher: Map<string, number>
  runsPerInningHome: number[]    // index 0 = inning 1
  runsPerInningAway: number[]
  runsScoredByPositionHome: Map<number, number>  // orderPosition → run count (home)
  runsScoredByPositionAway: Map<number, number>  // orderPosition → run count (away)
  isGameOver: boolean
}
