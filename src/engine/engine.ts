import type { Play, Lineup, GameSnapshot, HalfInning, BaseRunner } from './types'

function initialSnapshot(): GameSnapshot {
  return {
    inning: 1,
    half: 'top',
    outs: 0,
    scoreHome: 0,
    scoreAway: 0,
    currentBatterHome: 1,
    currentBatterAway: 1,
    baseRunners: { first: null, second: null, third: null },
    pitchCountByPitcher: new Map(),
    runsPerInningHome: [],
    runsPerInningAway: [],
    runsScoredByPositionHome: new Map(),
    runsScoredByPositionAway: new Map(),
    isGameOver: false,
  }
}

function getOutsForPlay(play: Play): number {
  if (play.playType === 'CS') return 1  // caught stealing = out, even though isAtBat is false
  if (!play.isAtBat) return 0
  switch (play.playType) {
    case 'K':
    case 'KL':
    case 'GO':
    case 'FO':
    case 'LO':
    case 'PO':
    case 'FC':
    case 'SAC':
      return 1
    case 'DP':
      return 2
    default:
      return 0
  }
}

function advanceBatter(current: number, lineupSize: number): number {
  return current >= lineupSize ? 1 : current + 1
}

function advanceHalfInning(snapshot: GameSnapshot): void {
  snapshot.baseRunners = { first: null, second: null, third: null }
  snapshot.outs = 0
  if (snapshot.half === 'top') {
    snapshot.half = 'bottom'
  } else {
    snapshot.half = 'top'
    snapshot.inning += 1
  }
}

function ensureInningArray(arr: number[], inning: number): void {
  while (arr.length < inning) {
    arr.push(0)
  }
}

function getBaseRunnerForBatter(
  batterOrderPosition: number,
  half: HalfInning,
  lineupHome: Lineup,
  lineupAway: Lineup,
): BaseRunner {
  const lineup = half === 'bottom' ? lineupHome : lineupAway
  const slot = lineup.battingOrder.find(s => s.orderPosition === batterOrderPosition)
  return {
    playerName: slot?.playerName ?? `Player${batterOrderPosition}`,
    orderPosition: batterOrderPosition,
  }
}

function applyBaseRunning(
  snapshot: GameSnapshot,
  play: Play,
  lineupHome: Lineup,
  lineupAway: Lineup,
): { runsScored: number; scorers: number[] } {
  let runsScored = 0
  const scorers: number[] = []
  const batter = getBaseRunnerForBatter(play.batterOrderPosition, play.half, lineupHome, lineupAway)
  const runners = snapshot.baseRunners

  // If play has runner overrides from scorekeeper confirmation, use those
  // for existing runners, then also place the batter on their reached base
  if (play.runnerOverrides) {
    snapshot.baseRunners = {
      first: play.runnerOverrides.first,
      second: play.runnerOverrides.second,
      third: play.runnerOverrides.third,
    }
    if (play.basesReached.length > 0) {
      const maxBase = Math.max(...play.basesReached)
      if (maxBase === 1) snapshot.baseRunners.first = batter
      else if (maxBase === 2) snapshot.baseRunners.second = batter
      else if (maxBase === 3) snapshot.baseRunners.third = batter
      // maxBase === 4: batter scored (HR), not placed on base
    }
    return { runsScored: play.runsScoredOnPlay, scorers }
  }

  switch (play.playType) {
    case '1B': {
      if (runners.third) { runsScored++; scorers.push(runners.third.orderPosition) }
      // Runner on 2nd advances to 3rd (default); scorekeeper can override via RunnerConfirmation
      const newThird = runners.second
      const newSecond = runners.first
      snapshot.baseRunners = { first: batter, second: newSecond, third: newThird }
      break
    }
    case '2B': {
      if (runners.third) { runsScored++; scorers.push(runners.third.orderPosition) }
      if (runners.second) { runsScored++; scorers.push(runners.second.orderPosition) }
      const newThird = runners.first
      snapshot.baseRunners = { first: null, second: batter, third: newThird }
      break
    }
    case '3B': {
      if (runners.third) { runsScored++; scorers.push(runners.third.orderPosition) }
      if (runners.second) { runsScored++; scorers.push(runners.second.orderPosition) }
      if (runners.first) { runsScored++; scorers.push(runners.first.orderPosition) }
      snapshot.baseRunners = { first: null, second: null, third: batter }
      break
    }
    case 'HR': {
      if (runners.third) { runsScored++; scorers.push(runners.third.orderPosition) }
      if (runners.second) { runsScored++; scorers.push(runners.second.orderPosition) }
      if (runners.first) { runsScored++; scorers.push(runners.first.orderPosition) }
      runsScored++; scorers.push(batter.orderPosition) // batter
      snapshot.baseRunners = { first: null, second: null, third: null }
      break
    }
    case 'BB':
    case 'HBP': {
      if (runners.first) {
        if (runners.second) {
          if (runners.third) {
            runsScored++; scorers.push(runners.third.orderPosition) // bases loaded walk/HBP
          }
          snapshot.baseRunners.third = runners.second
        }
        snapshot.baseRunners.second = runners.first
      }
      snapshot.baseRunners.first = batter
      break
    }
    case 'SB': {
      if (runners.third) {
        runsScored++; scorers.push(runners.third.orderPosition)
        snapshot.baseRunners.third = null
      } else if (runners.second) {
        snapshot.baseRunners.third = runners.second
        snapshot.baseRunners.second = null
      } else if (runners.first) {
        snapshot.baseRunners.second = runners.first
        snapshot.baseRunners.first = null
      }
      break
    }
    case 'CS': {
      // Default: remove the leading runner (the one most likely attempting to steal)
      if (runners.third) {
        snapshot.baseRunners.third = null
      } else if (runners.second) {
        snapshot.baseRunners.second = null
      } else if (runners.first) {
        snapshot.baseRunners.first = null
      }
      break
    }
    case 'WP':
    case 'PB':
    case 'BK': {
      if (runners.third) {
        runsScored++; scorers.push(runners.third.orderPosition)
        snapshot.baseRunners.third = null
      }
      if (runners.second) {
        snapshot.baseRunners.third = runners.second
        snapshot.baseRunners.second = null
      }
      if (runners.first) {
        snapshot.baseRunners.second = runners.first
        snapshot.baseRunners.first = null
      }
      break
    }
    case 'FC': {
      if (runners.third) {
        snapshot.baseRunners.third = null
      } else if (runners.second) {
        snapshot.baseRunners.second = null
      } else if (runners.first) {
        snapshot.baseRunners.first = null
      }
      snapshot.baseRunners.first = batter
      break
    }
    case 'SAC': {
      if (runners.third) {
        runsScored++; scorers.push(runners.third.orderPosition)
        snapshot.baseRunners.third = null
      }
      if (runners.second) {
        snapshot.baseRunners.third = runners.second
        snapshot.baseRunners.second = null
      }
      if (runners.first) {
        snapshot.baseRunners.second = runners.first
        snapshot.baseRunners.first = null
      }
      break
    }
    case 'DP': {
      if (runners.first) {
        snapshot.baseRunners.first = null
      } else if (runners.second) {
        snapshot.baseRunners.second = null
      } else if (runners.third) {
        snapshot.baseRunners.third = null
      }
      break
    }
    case 'E': {
      if (runners.third) { runsScored++; scorers.push(runners.third.orderPosition) }
      // Runner on 2nd advances to 3rd (default); scorekeeper can override via RunnerConfirmation
      const newThird: BaseRunner | null = runners.second
      const newSecond: BaseRunner | null = runners.first
      snapshot.baseRunners = { first: batter, second: newSecond, third: newThird }
      break
    }
    case 'K':
    case 'KL':
    case 'GO':
    case 'FO':
    case 'LO':
    case 'PO':
      // Out — runners stay put
      break
  }

  return { runsScored, scorers }
}

function halfInningOrder(inning: number, half: HalfInning): number {
  return inning * 2 + (half === 'bottom' ? 1 : 0)
}

/**
 * Determine who was pitching at a given (inning, half) by examining
 * substitution history. Position changes record when players swap positions,
 * including the inning/half when it happened.
 */
function findPitcherName(lineup: Lineup, inning: number, half: HalfInning): string | undefined {
  // Collect all events where someone became pitcher via substitution
  const becamePitcher: { playerName: string; order: number }[] = []

  for (const slot of lineup.battingOrder) {
    for (const sub of slot.substitutions) {
      if (sub.newPosition === 'P') {
        becamePitcher.push({
          playerName: sub.newPlayerName,
          order: halfInningOrder(sub.inning, sub.half),
        })
      }
    }
  }

  if (becamePitcher.length === 0) {
    // No pitcher changes — current P is the original pitcher
    return lineup.battingOrder.find(s => s.position === 'P')?.playerName
  }

  // Sort chronologically
  becamePitcher.sort((a, b) => a.order - b.order)

  const targetOrder = halfInningOrder(inning, half)

  // Find the latest pitcher change at or before the target time
  let pitcherName: string | undefined
  for (const event of becamePitcher) {
    if (event.order <= targetOrder) {
      pitcherName = event.playerName
    } else {
      break
    }
  }

  if (pitcherName) return pitcherName

  // All pitcher changes are AFTER this play — find the original pitcher.
  // The original pitcher left 'P' at the time of the first pitcher change.
  // In a 2-way swap, the other slot at that time has newPosition !== 'P'.
  const firstChange = becamePitcher[0]
  for (const slot of lineup.battingOrder) {
    for (const sub of slot.substitutions) {
      if (halfInningOrder(sub.inning, sub.half) === firstChange.order && sub.newPosition !== 'P') {
        return slot.playerName
      }
    }
  }

  // Fallback
  return lineup.battingOrder.find(s => s.position === 'P')?.playerName
}

export function replayGame(
  plays: Play[],
  lineupHome: Lineup,
  lineupAway: Lineup,
): GameSnapshot {
  const snapshot = initialSnapshot()
  const lineupSizeHome = lineupHome.battingOrder.length
  const lineupSizeAway = lineupAway.battingOrder.length

  const sorted = [...plays].sort((a, b) => a.sequenceNumber - b.sequenceNumber)

  for (const play of sorted) {
    if (snapshot.isGameOver) break

    // Track pitch count — pitcher is the fielding team's position 'P'
    // Ball-in-play outcomes (1B, GO, HBP, etc.) imply a final pitch that isn't
    // in the pitches array (user only tracks B/S/F via buttons). K/KL/BB have
    // their final pitch auto-tracked; SB/WP/PB/BK don't consume a pitch.
    const BALL_IN_PLAY: Set<string> = new Set([
      '1B', '2B', '3B', 'HR', 'GO', 'FO', 'LO', 'PO', 'E', 'FC', 'DP', 'SAC', 'HBP',
    ])
    const implicitPitch = BALL_IN_PLAY.has(play.playType) && play.isAtBat ? 1 : 0
    const totalPitches = play.pitches.length + implicitPitch
    if (totalPitches > 0) {
      // Use play.pitcherName if recorded (handles mid-inning changes precisely).
      // Fall back to substitution-history lookup for legacy plays without it.
      const pitcherLineup = play.half === 'bottom' ? lineupAway : lineupHome
      const pitcherKey = play.pitcherName ?? findPitcherName(pitcherLineup, play.inning, play.half)
      if (pitcherKey) {
        const current = snapshot.pitchCountByPitcher.get(pitcherKey) ?? 0
        snapshot.pitchCountByPitcher.set(pitcherKey, current + totalPitches)
      }
    }

    // Apply base running and scoring
    const outsOnPlay = getOutsForPlay(play)
    const { runsScored, scorers } = applyBaseRunning(snapshot, play, lineupHome, lineupAway)

    // Apply outs
    snapshot.outs += outsOnPlay

    // Apply runs (capped by 5-run rule in innings 1-5)
    const isHomeBatting = play.half === 'bottom'
    const runsArr = isHomeBatting ? snapshot.runsPerInningHome : snapshot.runsPerInningAway
    ensureInningArray(runsArr, play.inning)
    const runsSoFar = runsArr[play.inning - 1]
    const runLimit = play.inning <= 5 ? 5 : Infinity
    const allowedRuns = Math.min(runsScored, runLimit - runsSoFar)
    const actualRuns = Math.max(0, allowedRuns)

    if (isHomeBatting) {
      snapshot.scoreHome += actualRuns
      snapshot.runsPerInningHome[play.inning - 1] += actualRuns
      for (let i = 0; i < actualRuns; i++) {
        const pos = scorers[i]
        snapshot.runsScoredByPositionHome.set(pos, (snapshot.runsScoredByPositionHome.get(pos) ?? 0) + 1)
      }
    } else {
      snapshot.scoreAway += actualRuns
      snapshot.runsPerInningAway[play.inning - 1] += actualRuns
      for (let i = 0; i < actualRuns; i++) {
        const pos = scorers[i]
        snapshot.runsScoredByPositionAway.set(pos, (snapshot.runsScoredByPositionAway.get(pos) ?? 0) + 1)
      }
    }

    // Advance batter
    if (play.isAtBat) {
      if (isHomeBatting) {
        snapshot.currentBatterHome = advanceBatter(snapshot.currentBatterHome, lineupSizeHome)
      } else {
        snapshot.currentBatterAway = advanceBatter(snapshot.currentBatterAway, lineupSizeAway)
      }
    }

    // Walk-off: home team takes lead in bottom of 6th or later
    // Check BEFORE the outs check which might advance the half-inning
    if (snapshot.inning >= 6 && snapshot.half === 'bottom' && runsScored > 0) {
      if (snapshot.scoreHome > snapshot.scoreAway) {
        snapshot.isGameOver = true
      }
    }

    // 5-run rule: in innings 1-5, a half-inning ends when a team scores 5 runs
    // (6th inning and beyond have unlimited runs)
    if (!snapshot.isGameOver && play.inning <= 5) {
      const runsThisHalfInning = isHomeBatting
        ? snapshot.runsPerInningHome[play.inning - 1]
        : snapshot.runsPerInningAway[play.inning - 1]
      if (runsThisHalfInning >= 5) {
        advanceHalfInning(snapshot)

        if (snapshot.half === 'bottom' && snapshot.inning >= 6) {
          if (snapshot.scoreHome > snapshot.scoreAway) {
            snapshot.isGameOver = true
          }
        }
      }
    }

    // Check for inning change (standard 6-inning LL game)
    if (!snapshot.isGameOver && snapshot.outs >= 3) {
      advanceHalfInning(snapshot)

      // Standard game over: completed all innings
      if (snapshot.inning > 6) {
        snapshot.isGameOver = true
      }
      // Skip bottom of last inning: home team already leads after top ends
      // After advanceHalfInning, if we're now in the bottom of inning 6+
      // and the home team leads, game is over
      else if (snapshot.half === 'bottom' && snapshot.inning >= 6) {
        if (snapshot.scoreHome > snapshot.scoreAway) {
          snapshot.isGameOver = true
        }
      }
    }
  }

  return snapshot
}
