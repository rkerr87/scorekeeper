import { describe, it, expect } from 'vitest'
import { replayGame } from '../engine'
import type { Play, Lineup, LineupSlot } from '../types'

function makeLineup(side: 'us' | 'them', count = 9): Lineup {
  const battingOrder: LineupSlot[] = Array.from({ length: count }, (_, i) => ({
    orderPosition: i + 1,
    playerId: side === 'us' ? i + 1 : null,
    playerName: `${side}-Player${i + 1}`,
    jerseyNumber: (i + 1) * 10,
    position: ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'][i] ?? 'DH',
    substitutions: [],
  }))
  return { gameId: 1, side, battingOrder }
}

function makePlay(overrides: Partial<Play> & Pick<Play, 'sequenceNumber' | 'half' | 'batterOrderPosition' | 'playType'>): Play {
  return {
    gameId: 1,
    inning: 1,
    notation: overrides.playType,
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

const lineupUs = makeLineup('us')
const lineupThem = makeLineup('them')

describe('replayGame — initial state', () => {
  it('should return initial state with no plays', () => {
    const snapshot = replayGame([], lineupUs, lineupThem, 'away')
    expect(snapshot.inning).toBe(1)
    expect(snapshot.half).toBe('top')
    expect(snapshot.outs).toBe(0)
    expect(snapshot.scoreUs).toBe(0)
    expect(snapshot.scoreThem).toBe(0)
    expect(snapshot.currentBatterUs).toBe(1)
    expect(snapshot.currentBatterThem).toBe(1)
    expect(snapshot.isGameOver).toBe(false)
  })
})

describe('replayGame — batting order', () => {
  it('should advance batter after an at-bat play', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: 'K' }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem, 'away')
    expect(snapshot.currentBatterUs).toBe(2)
    expect(snapshot.outs).toBe(1)
  })

  it('should NOT advance batter after a non-at-bat play', () => {
    const plays: Play[] = [
      makePlay({
        sequenceNumber: 1, half: 'top', batterOrderPosition: 1,
        playType: 'SB', isAtBat: false,
      }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem, 'away')
    expect(snapshot.currentBatterUs).toBe(1)
  })

  it('should wrap batting order from 9 back to 1', () => {
    const plays: Play[] = Array.from({ length: 9 }, (_, i) =>
      makePlay({
        sequenceNumber: i + 1,
        inning: Math.floor(i / 3) + 1,
        half: 'top',
        batterOrderPosition: i + 1,
        playType: 'K',
      })
    )
    const snapshot = replayGame(plays, lineupUs, lineupThem, 'away')
    expect(snapshot.currentBatterUs).toBe(1)
  })

  it('should advance them batter when home team bats in top half', () => {
    // For a home game, us bats in the bottom — top half is them batting
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: 'K' }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem, 'home')
    expect(snapshot.currentBatterThem).toBe(2)
    expect(snapshot.currentBatterUs).toBe(1)
  })
})

describe('replayGame — inning advancement', () => {
  it('should advance to bottom of inning after 3 outs in top', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: 'K' }),
      makePlay({ sequenceNumber: 2, half: 'top', batterOrderPosition: 2, playType: 'GO', fieldersInvolved: [6, 3] }),
      makePlay({ sequenceNumber: 3, half: 'top', batterOrderPosition: 3, playType: 'FO', fieldersInvolved: [8] }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem, 'away')
    expect(snapshot.inning).toBe(1)
    expect(snapshot.half).toBe('bottom')
    expect(snapshot.outs).toBe(0)
  })

  it('should advance to next inning after 3 outs in bottom', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, inning: 1, half: 'top', batterOrderPosition: 1, playType: 'K' }),
      makePlay({ sequenceNumber: 2, inning: 1, half: 'top', batterOrderPosition: 2, playType: 'K' }),
      makePlay({ sequenceNumber: 3, inning: 1, half: 'top', batterOrderPosition: 3, playType: 'K' }),
      makePlay({ sequenceNumber: 4, inning: 1, half: 'bottom', batterOrderPosition: 1, playType: 'K' }),
      makePlay({ sequenceNumber: 5, inning: 1, half: 'bottom', batterOrderPosition: 2, playType: 'K' }),
      makePlay({ sequenceNumber: 6, inning: 1, half: 'bottom', batterOrderPosition: 3, playType: 'K' }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem, 'away')
    expect(snapshot.inning).toBe(2)
    expect(snapshot.half).toBe('top')
    expect(snapshot.outs).toBe(0)
  })

  it('should count double play as 2 outs', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: 'DP', fieldersInvolved: [6, 4, 3] }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem, 'away')
    expect(snapshot.outs).toBe(2)
  })
})

describe('replayGame — baserunners', () => {
  it('should put batter on first after a single', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: '1B', basesReached: [1] }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem, 'away')
    expect(snapshot.baseRunners.first?.orderPosition).toBe(1)
    expect(snapshot.baseRunners.second).toBeNull()
    expect(snapshot.baseRunners.third).toBeNull()
  })

  it('should advance runner from 1st to 2nd on next single', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: '1B', basesReached: [1] }),
      makePlay({ sequenceNumber: 2, half: 'top', batterOrderPosition: 2, playType: '1B', basesReached: [1] }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem, 'away')
    expect(snapshot.baseRunners.first?.orderPosition).toBe(2)
    expect(snapshot.baseRunners.second?.orderPosition).toBe(1)
  })

  it('should score runner from 3rd on a single', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: '3B', basesReached: [1, 2, 3] }),
      makePlay({ sequenceNumber: 2, half: 'top', batterOrderPosition: 2, playType: '1B', basesReached: [1] }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem, 'away')
    expect(snapshot.scoreUs).toBe(1)
    expect(snapshot.baseRunners.first?.orderPosition).toBe(2)
    expect(snapshot.baseRunners.third).toBeNull()
  })

  it('should clear all bases and score everyone on HR', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: '1B', basesReached: [1] }),
      makePlay({ sequenceNumber: 2, half: 'top', batterOrderPosition: 2, playType: '2B', basesReached: [1, 2] }),
      makePlay({ sequenceNumber: 3, half: 'top', batterOrderPosition: 3, playType: 'HR', basesReached: [1, 2, 3, 4] }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem, 'away')
    expect(snapshot.scoreUs).toBe(3)
    expect(snapshot.baseRunners.first).toBeNull()
    expect(snapshot.baseRunners.second).toBeNull()
    expect(snapshot.baseRunners.third).toBeNull()
  })

  it('should force-advance on walk with bases loaded', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: '1B', basesReached: [1] }),
      makePlay({ sequenceNumber: 2, half: 'top', batterOrderPosition: 2, playType: '1B', basesReached: [1] }),
      makePlay({ sequenceNumber: 3, half: 'top', batterOrderPosition: 3, playType: '1B', basesReached: [1] }),
      makePlay({ sequenceNumber: 4, half: 'top', batterOrderPosition: 4, playType: 'BB', basesReached: [1] }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem, 'away')
    expect(snapshot.scoreUs).toBe(1)
    expect(snapshot.baseRunners.first).not.toBeNull()
    expect(snapshot.baseRunners.second).not.toBeNull()
    expect(snapshot.baseRunners.third).not.toBeNull()
  })

  it('should clear bases on 3rd out', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: '1B', basesReached: [1] }),
      makePlay({ sequenceNumber: 2, half: 'top', batterOrderPosition: 2, playType: 'K' }),
      makePlay({ sequenceNumber: 3, half: 'top', batterOrderPosition: 3, playType: 'K' }),
      makePlay({ sequenceNumber: 4, half: 'top', batterOrderPosition: 4, playType: 'K' }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem, 'away')
    expect(snapshot.half).toBe('bottom')
    expect(snapshot.baseRunners.first).toBeNull()
  })

  it('should advance runner on stolen base without advancing batter', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: '1B', basesReached: [1] }),
      makePlay({ sequenceNumber: 2, half: 'top', batterOrderPosition: 2, playType: 'SB', isAtBat: false }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem, 'away')
    expect(snapshot.baseRunners.first).toBeNull()
    expect(snapshot.baseRunners.second?.orderPosition).toBe(1)
    expect(snapshot.currentBatterUs).toBe(2)
  })

  it('should advance all runners on wild pitch', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: '2B', basesReached: [1, 2] }),
      makePlay({ sequenceNumber: 2, half: 'top', batterOrderPosition: 2, playType: 'WP', isAtBat: false }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem, 'away')
    expect(snapshot.baseRunners.second).toBeNull()
    expect(snapshot.baseRunners.third?.orderPosition).toBe(1)
  })
})

describe('replayGame — scoring', () => {
  it('should track runs per inning for us', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, inning: 1, half: 'top', batterOrderPosition: 1, playType: 'HR', basesReached: [1, 2, 3, 4] }),
      makePlay({ sequenceNumber: 2, inning: 1, half: 'top', batterOrderPosition: 2, playType: 'K' }),
      makePlay({ sequenceNumber: 3, inning: 1, half: 'top', batterOrderPosition: 3, playType: 'K' }),
      makePlay({ sequenceNumber: 4, inning: 1, half: 'top', batterOrderPosition: 4, playType: 'K' }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem, 'away')
    expect(snapshot.runsPerInningUs[0]).toBe(1)
    expect(snapshot.scoreUs).toBe(1)
  })

  it('should track runs per inning for them', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, inning: 1, half: 'top', batterOrderPosition: 1, playType: 'K' }),
      makePlay({ sequenceNumber: 2, inning: 1, half: 'top', batterOrderPosition: 2, playType: 'K' }),
      makePlay({ sequenceNumber: 3, inning: 1, half: 'top', batterOrderPosition: 3, playType: 'K' }),
      makePlay({ sequenceNumber: 4, inning: 1, half: 'bottom', batterOrderPosition: 1, playType: 'HR', basesReached: [1, 2, 3, 4] }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem, 'away')
    expect(snapshot.runsPerInningThem[0]).toBe(1)
    expect(snapshot.scoreThem).toBe(1)
  })

  it('should handle multi-run innings', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, inning: 1, half: 'top', batterOrderPosition: 1, playType: '1B', basesReached: [1] }),
      makePlay({ sequenceNumber: 2, inning: 1, half: 'top', batterOrderPosition: 2, playType: '1B', basesReached: [1] }),
      makePlay({ sequenceNumber: 3, inning: 1, half: 'top', batterOrderPosition: 3, playType: 'HR', basesReached: [1, 2, 3, 4] }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem, 'away')
    expect(snapshot.scoreUs).toBe(3)
    expect(snapshot.runsPerInningUs[0]).toBe(3)
  })

  it('should credit runs to us when home team bats in bottom half', () => {
    // Home game: us bats in bottom half
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, inning: 1, half: 'top', batterOrderPosition: 1, playType: 'K' }),
      makePlay({ sequenceNumber: 2, inning: 1, half: 'top', batterOrderPosition: 2, playType: 'K' }),
      makePlay({ sequenceNumber: 3, inning: 1, half: 'top', batterOrderPosition: 3, playType: 'K' }),
      makePlay({ sequenceNumber: 4, inning: 1, half: 'bottom', batterOrderPosition: 1, playType: 'HR', basesReached: [1, 2, 3, 4] }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem, 'home')
    expect(snapshot.scoreUs).toBe(1)
    expect(snapshot.scoreThem).toBe(0)
    expect(snapshot.runsPerInningUs[0]).toBe(1)
  })
})

describe('replayGame — pitch count', () => {
  it('should track cumulative pitch count per pitcher', () => {
    const plays: Play[] = [
      makePlay({
        sequenceNumber: 1, half: 'top', batterOrderPosition: 1,
        playType: 'K', pitches: ['S', 'B', 'S', 'S'],
      }),
      makePlay({
        sequenceNumber: 2, half: 'top', batterOrderPosition: 2,
        playType: 'BB', pitches: ['B', 'B', 'S', 'B', 'B'],
      }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem, 'away')
    expect(snapshot.pitchCountByPitcher.get('them-Player1')).toBe(9)
  })

  it('should track pitch counts separately per half-inning pitcher', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, inning: 1, half: 'top', batterOrderPosition: 1, playType: 'K', pitches: ['S', 'S', 'S'] }),
      makePlay({ sequenceNumber: 2, inning: 1, half: 'top', batterOrderPosition: 2, playType: 'K', pitches: ['S', 'S', 'S'] }),
      makePlay({ sequenceNumber: 3, inning: 1, half: 'top', batterOrderPosition: 3, playType: 'K', pitches: ['S', 'S', 'S'] }),
      makePlay({ sequenceNumber: 4, inning: 1, half: 'bottom', batterOrderPosition: 1, playType: 'K', pitches: ['S', 'B', 'S', 'S'] }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem, 'away')
    expect(snapshot.pitchCountByPitcher.get('them-Player1')).toBe(9)
    expect(snapshot.pitchCountByPitcher.get('us-Player1')).toBe(4)
  })
})

describe('replayGame — isGameOver', () => {
  function makeInning(startSeq: number, inning: number, half: 'top' | 'bottom'): Play[] {
    return [
      makePlay({ sequenceNumber: startSeq, inning, half, batterOrderPosition: 1, playType: 'K' }),
      makePlay({ sequenceNumber: startSeq + 1, inning, half, batterOrderPosition: 2, playType: 'K' }),
      makePlay({ sequenceNumber: startSeq + 2, inning, half, batterOrderPosition: 3, playType: 'K' }),
    ]
  }

  it('should set isGameOver after 6 complete innings', () => {
    const plays: Play[] = [
      ...makeInning(1, 1, 'top'),
      ...makeInning(4, 1, 'bottom'),
      ...makeInning(7, 2, 'top'),
      ...makeInning(10, 2, 'bottom'),
      ...makeInning(13, 3, 'top'),
      ...makeInning(16, 3, 'bottom'),
      ...makeInning(19, 4, 'top'),
      ...makeInning(22, 4, 'bottom'),
      ...makeInning(25, 5, 'top'),
      ...makeInning(28, 5, 'bottom'),
      ...makeInning(31, 6, 'top'),
      ...makeInning(34, 6, 'bottom'),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem, 'away')
    expect(snapshot.isGameOver).toBe(true)
  })

  it('should not set isGameOver before 6 innings are complete', () => {
    const plays: Play[] = [
      ...makeInning(1, 1, 'top'),
      ...makeInning(4, 1, 'bottom'),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem, 'away')
    expect(snapshot.isGameOver).toBe(false)
  })

  it('should stop processing plays once isGameOver is true', () => {
    const plays: Play[] = [
      ...makeInning(1, 1, 'top'),
      ...makeInning(4, 1, 'bottom'),
      ...makeInning(7, 2, 'top'),
      ...makeInning(10, 2, 'bottom'),
      ...makeInning(13, 3, 'top'),
      ...makeInning(16, 3, 'bottom'),
      ...makeInning(19, 4, 'top'),
      ...makeInning(22, 4, 'bottom'),
      ...makeInning(25, 5, 'top'),
      ...makeInning(28, 5, 'bottom'),
      ...makeInning(31, 6, 'top'),
      ...makeInning(34, 6, 'bottom'),
      // Extra plays that should be ignored
      makePlay({ sequenceNumber: 37, inning: 7, half: 'top', batterOrderPosition: 1, playType: 'HR', basesReached: [1, 2, 3, 4] }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem, 'away')
    expect(snapshot.isGameOver).toBe(true)
    expect(snapshot.scoreUs).toBe(0) // HR in inning 7 was not processed
  })
})

describe('replayGame — runner advancement bugs', () => {
  it('1B with runner on 2nd: batter on 1st, runner on 2nd advances to 3rd', () => {
    const plays = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: '2B', basesReached: [1,2] }),
      makePlay({ sequenceNumber: 2, half: 'top', batterOrderPosition: 2, playType: '1B', basesReached: [1] }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem, 'away')
    expect(snapshot.scoreUs).toBe(0)
    expect(snapshot.baseRunners.first?.orderPosition).toBe(2)  // batter on 1st
    expect(snapshot.baseRunners.third?.orderPosition).toBe(1)  // runner advanced to 3rd
    expect(snapshot.baseRunners.second).toBeNull()
  })

  it('1B with runners on 2nd and 3rd: only runner on 3rd scores, runner on 2nd advances to 3rd', () => {
    // Use 3 walks to load bases: pos1 on 3rd, pos2 on 2nd, pos3 on 1st
    const plays = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: 'BB', basesReached: [1], isAtBat: true }),
      makePlay({ sequenceNumber: 2, half: 'top', batterOrderPosition: 2, playType: 'BB', basesReached: [1], isAtBat: true }),
      makePlay({ sequenceNumber: 3, half: 'top', batterOrderPosition: 3, playType: 'BB', basesReached: [1], isAtBat: true }),
      // pos4 singles: pos1 (on 3rd) scores, pos2 (on 2nd) → 3rd, pos3 (on 1st) → 2nd, pos4 → 1st
      makePlay({ sequenceNumber: 4, half: 'top', batterOrderPosition: 4, playType: '1B', basesReached: [1] }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem, 'away')
    expect(snapshot.scoreUs).toBe(1)  // only pos1 (was on 3rd) scores
    expect(snapshot.baseRunners.third?.orderPosition).toBe(2)  // pos2 (was on 2nd) advances to 3rd
    expect(snapshot.baseRunners.second?.orderPosition).toBe(3) // pos3 (was on 1st) advances to 2nd
    expect(snapshot.baseRunners.first?.orderPosition).toBe(4)  // batter on 1st
  })

  it('E with runner on 2nd should advance runner to 3rd, not score', () => {
    const plays = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: '2B', basesReached: [1,2] }),
      makePlay({ sequenceNumber: 2, half: 'top', batterOrderPosition: 2, playType: 'E', basesReached: [1] }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem, 'away')
    expect(snapshot.scoreUs).toBe(0)
    expect(snapshot.baseRunners.third?.orderPosition).toBe(1)  // runner advanced to 3rd
    expect(snapshot.baseRunners.first?.orderPosition).toBe(2)  // batter on 1st
  })
})
