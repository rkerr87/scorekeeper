import type { Play, Lineup, GameSnapshot, HalfInning, BaseRunner, HomeOrAway } from './types'

function initialSnapshot(): GameSnapshot {
  return {
    inning: 1,
    half: 'top',
    outs: 0,
    scoreUs: 0,
    scoreThem: 0,
    currentBatterUs: 1,
    currentBatterThem: 1,
    baseRunners: { first: null, second: null, third: null },
    pitchCountByPitcher: new Map(),
    runsPerInningUs: [],
    runsPerInningThem: [],
    runsScoredByPositionUs: new Map(),
    runsScoredByPositionThem: new Map(),
    isGameOver: false,
  }
}

function getOutsForPlay(play: Play): number {
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

// Away team bats in the top half; home team bats in the bottom half.
function isUsBattingHalf(half: HalfInning, homeOrAway: HomeOrAway): boolean {
  return homeOrAway === 'away' ? half === 'top' : half === 'bottom'
}

function getBaseRunnerForBatter(
  batterOrderPosition: number,
  half: HalfInning,
  homeOrAway: HomeOrAway,
  lineupUs: Lineup,
  lineupThem: Lineup,
): BaseRunner {
  const lineup = isUsBattingHalf(half, homeOrAway) ? lineupUs : lineupThem
  const slot = lineup.battingOrder.find(s => s.orderPosition === batterOrderPosition)
  return {
    playerName: slot?.playerName ?? `Player${batterOrderPosition}`,
    orderPosition: batterOrderPosition,
  }
}

function applyBaseRunning(
  snapshot: GameSnapshot,
  play: Play,
  homeOrAway: HomeOrAway,
  lineupUs: Lineup,
  lineupThem: Lineup,
): { runsScored: number; scorers: number[] } {
  let runsScored = 0
  const scorers: number[] = []
  const batter = getBaseRunnerForBatter(play.batterOrderPosition, play.half, homeOrAway, lineupUs, lineupThem)
  const runners = snapshot.baseRunners

  // If play has runner overrides from scorekeeper confirmation, use those
  if (play.runnerOverrides) {
    snapshot.baseRunners = {
      first: play.runnerOverrides.first,
      second: play.runnerOverrides.second,
      third: play.runnerOverrides.third,
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

export function replayGame(
  plays: Play[],
  lineupUs: Lineup,
  lineupThem: Lineup,
  homeOrAway: HomeOrAway,
): GameSnapshot {
  const snapshot = initialSnapshot()
  const lineupSizeUs = lineupUs.battingOrder.length
  const lineupSizeThem = lineupThem.battingOrder.length

  const sorted = [...plays].sort((a, b) => a.sequenceNumber - b.sequenceNumber)

  for (const play of sorted) {
    if (snapshot.isGameOver) break

    // Track pitch count — pitcher is the fielding team's position 'P'
    if (play.pitches.length > 0) {
      const pitcherLineup = isUsBattingHalf(play.half, homeOrAway) ? lineupThem : lineupUs
      const pitcher = pitcherLineup.battingOrder.find(s => s.position === 'P')
      if (pitcher) {
        const key = pitcher.playerName
        const current = snapshot.pitchCountByPitcher.get(key) ?? 0
        snapshot.pitchCountByPitcher.set(key, current + play.pitches.length)
      }
    }

    // Apply base running and scoring
    const outsOnPlay = getOutsForPlay(play)
    const { runsScored, scorers } = applyBaseRunning(snapshot, play, homeOrAway, lineupUs, lineupThem)

    // Apply outs
    snapshot.outs += outsOnPlay

    // Apply runs
    const isUsBatting = isUsBattingHalf(play.half, homeOrAway)
    if (isUsBatting) {
      snapshot.scoreUs += runsScored
      ensureInningArray(snapshot.runsPerInningUs, play.inning)
      snapshot.runsPerInningUs[play.inning - 1] += runsScored
      for (const pos of scorers) {
        snapshot.runsScoredByPositionUs.set(pos, (snapshot.runsScoredByPositionUs.get(pos) ?? 0) + 1)
      }
    } else {
      snapshot.scoreThem += runsScored
      ensureInningArray(snapshot.runsPerInningThem, play.inning)
      snapshot.runsPerInningThem[play.inning - 1] += runsScored
      for (const pos of scorers) {
        snapshot.runsScoredByPositionThem.set(pos, (snapshot.runsScoredByPositionThem.get(pos) ?? 0) + 1)
      }
    }

    // Advance batter
    if (play.isAtBat) {
      if (isUsBatting) {
        snapshot.currentBatterUs = advanceBatter(snapshot.currentBatterUs, lineupSizeUs)
      } else {
        snapshot.currentBatterThem = advanceBatter(snapshot.currentBatterThem, lineupSizeThem)
      }
    }

    // Walk-off: home team takes lead in bottom of 6th or later
    // Check BEFORE the outs check which might advance the half-inning
    if (snapshot.inning >= 6 && snapshot.half === 'bottom' && runsScored > 0) {
      const homeScore = homeOrAway === 'home' ? snapshot.scoreUs : snapshot.scoreThem
      const awayScore = homeOrAway === 'home' ? snapshot.scoreThem : snapshot.scoreUs
      if (homeScore > awayScore) {
        snapshot.isGameOver = true
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
        const homeScore = homeOrAway === 'home' ? snapshot.scoreUs : snapshot.scoreThem
        const awayScore = homeOrAway === 'home' ? snapshot.scoreThem : snapshot.scoreUs
        if (homeScore > awayScore) {
          snapshot.isGameOver = true
        }
      }
    }
  }

  return snapshot
}
