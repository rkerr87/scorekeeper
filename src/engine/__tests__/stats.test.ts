import { describe, it, expect } from 'vitest'
import { computePlayerStats } from '../stats'
import { replayGame } from '../engine'
import type { Play, Lineup } from '../types'

function makeBatterPlay(overrides: Partial<Play>): Play {
  return {
    gameId: 1,
    sequenceNumber: 1,
    inning: 1,
    half: 'top',
    batterOrderPosition: 1,
    playType: 'K',
    notation: 'K',
    fieldersInvolved: [],
    basesReached: [],
    runsScoredOnPlay: 0,
    rbis: 0,
    pitches: [],
    isAtBat: true,
    timestamp: new Date(),
    ...overrides,
  }
}

describe('computePlayerStats', () => {
  it('should compute basic stats from plays', () => {
    const plays: Play[] = [
      makeBatterPlay({ playType: '1B', basesReached: [1] }),
      makeBatterPlay({ playType: 'K', sequenceNumber: 2 }),
      makeBatterPlay({ playType: '2B', basesReached: [1, 2], sequenceNumber: 3 }),
      makeBatterPlay({ playType: 'BB', basesReached: [1], sequenceNumber: 4 }),
      makeBatterPlay({ playType: 'HR', basesReached: [1, 2, 3, 4], rbis: 1, sequenceNumber: 5 }),
    ]
    const stats = computePlayerStats(plays, 1)
    expect(stats.atBats).toBe(4)   // BB excluded
    expect(stats.hits).toBe(3)     // 1B + 2B + HR
    expect(stats.walks).toBe(1)
    expect(stats.strikeouts).toBe(1)
    expect(stats.doubles).toBe(1)
    expect(stats.homeRuns).toBe(1)
    expect(stats.rbis).toBe(1)
  })

  it('should compute batting average', () => {
    const plays: Play[] = [
      makeBatterPlay({ playType: '1B', basesReached: [1] }),
      makeBatterPlay({ playType: 'K', sequenceNumber: 2 }),
      makeBatterPlay({ playType: 'K', sequenceNumber: 3 }),
      makeBatterPlay({ playType: '1B', basesReached: [1], sequenceNumber: 4 }),
    ]
    const stats = computePlayerStats(plays, 1)
    expect(stats.avg).toBeCloseTo(0.500)
  })

  it('should handle zero at-bats', () => {
    const stats = computePlayerStats([], 1)
    expect(stats.atBats).toBe(0)
    expect(stats.avg).toBe(0)
  })

  it('should not count HBP as at-bat', () => {
    const plays: Play[] = [
      makeBatterPlay({ playType: 'HBP', basesReached: [1] }),
    ]
    const stats = computePlayerStats(plays, 1)
    expect(stats.atBats).toBe(0)
  })
})

describe('runs scored tracking via GameSnapshot', () => {
  function makeLineup(size: number): Lineup {
    return {
      gameId: 1,
      side: 'us',
      battingOrder: Array.from({ length: size }, (_, i) => ({
        orderPosition: i + 1,
        playerId: null,
        playerName: `Player${i + 1}`,
        jerseyNumber: i + 1,
        position: i === 0 ? 'P' : 'CF',
        substitutions: [],
      })),
    }
  }

  function makePlay(overrides: Partial<Play>): Play {
    return {
      gameId: 1,
      sequenceNumber: 1,
      inning: 1,
      half: 'top',
      batterOrderPosition: 1,
      playType: 'K',
      notation: 'K',
      fieldersInvolved: [],
      basesReached: [],
      runsScoredOnPlay: 0,
      rbis: 0,
      pitches: [],
      isAtBat: true,
      timestamp: new Date(),
      ...overrides,
    }
  }

  it('credits the runner who crosses home plate, not the batter who drove them in', () => {
    // pos1 singles → on 1st; pos2 hits HR → pos1 scores, pos2 scores
    const lineup = makeLineup(4)
    const plays = [
      makePlay({ sequenceNumber: 1, batterOrderPosition: 1, playType: '1B', basesReached: [1] }),
      makePlay({ sequenceNumber: 2, batterOrderPosition: 2, playType: 'HR', basesReached: [1, 2, 3, 4], rbis: 2 }),
    ]
    const snapshot = replayGame(plays, lineup, lineup, 'away')
    // pos1 scored once (driven in by pos2 HR), pos2 scored once (home run)
    expect(snapshot.runsScoredByPositionUs.get(1)).toBe(1)
    expect(snapshot.runsScoredByPositionUs.get(2)).toBe(1)
    // pos2's plays should NOT show runs from driving in pos1
    const pos2Stats = computePlayerStats(plays.filter(p => p.batterOrderPosition === 2), 2, snapshot.runsScoredByPositionUs.get(2) ?? 0)
    expect(pos2Stats.runs).toBe(1)
  })
})
