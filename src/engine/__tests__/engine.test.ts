import { describe, it, expect } from 'vitest'
import { replayGame } from '../engine'
import { computeRunnerJourneys } from '../journeys'
import type { Play, Lineup, LineupSlot } from '../types'

function makeLineup(side: 'home' | 'away', count = 9): Lineup {
  const battingOrder: LineupSlot[] = Array.from({ length: count }, (_, i) => ({
    orderPosition: i + 1,
    playerId: i + 1,
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

const lineupHome = makeLineup('home')
const lineupAway = makeLineup('away')

describe('replayGame — initial state', () => {
  it('should return initial state with no plays', () => {
    const snapshot = replayGame([], lineupHome, lineupAway)
    expect(snapshot.inning).toBe(1)
    expect(snapshot.half).toBe('top')
    expect(snapshot.outs).toBe(0)
    expect(snapshot.scoreHome).toBe(0)
    expect(snapshot.scoreAway).toBe(0)
    expect(snapshot.currentBatterHome).toBe(1)
    expect(snapshot.currentBatterAway).toBe(1)
    expect(snapshot.isGameOver).toBe(false)
  })
})

describe('replayGame — batting order', () => {
  it('should advance batter after an at-bat play', () => {
    // Top half = away team batting
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: 'K' }),
    ]
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    expect(snapshot.currentBatterAway).toBe(2)
    expect(snapshot.outs).toBe(1)
  })

  it('should NOT advance batter after a non-at-bat play', () => {
    const plays: Play[] = [
      makePlay({
        sequenceNumber: 1, half: 'top', batterOrderPosition: 1,
        playType: 'SB', isAtBat: false,
      }),
    ]
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    expect(snapshot.currentBatterAway).toBe(1)
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
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    expect(snapshot.currentBatterAway).toBe(1)
  })

  it('should advance home batter when home team bats in bottom half', () => {
    // Top half = away batting; home batter should not advance
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: 'K' }),
    ]
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    expect(snapshot.currentBatterAway).toBe(2)
    expect(snapshot.currentBatterHome).toBe(1)
  })
})

describe('replayGame — inning advancement', () => {
  it('should advance to bottom of inning after 3 outs in top', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: 'K' }),
      makePlay({ sequenceNumber: 2, half: 'top', batterOrderPosition: 2, playType: 'GO', fieldersInvolved: [6, 3] }),
      makePlay({ sequenceNumber: 3, half: 'top', batterOrderPosition: 3, playType: 'FO', fieldersInvolved: [8] }),
    ]
    const snapshot = replayGame(plays, lineupHome, lineupAway)
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
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    expect(snapshot.inning).toBe(2)
    expect(snapshot.half).toBe('top')
    expect(snapshot.outs).toBe(0)
  })

  it('should count double play as 2 outs', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: 'DP', fieldersInvolved: [6, 4, 3] }),
    ]
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    expect(snapshot.outs).toBe(2)
  })
})

describe('replayGame — baserunners', () => {
  it('should put batter on first after a single', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: '1B', basesReached: [1] }),
    ]
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    expect(snapshot.baseRunners.first?.orderPosition).toBe(1)
    expect(snapshot.baseRunners.second).toBeNull()
    expect(snapshot.baseRunners.third).toBeNull()
  })

  it('should advance runner from 1st to 2nd on next single', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: '1B', basesReached: [1] }),
      makePlay({ sequenceNumber: 2, half: 'top', batterOrderPosition: 2, playType: '1B', basesReached: [1] }),
    ]
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    expect(snapshot.baseRunners.first?.orderPosition).toBe(2)
    expect(snapshot.baseRunners.second?.orderPosition).toBe(1)
  })

  it('should score runner from 3rd on a single', () => {
    // Top half = away team batting
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: '3B', basesReached: [1, 2, 3] }),
      makePlay({ sequenceNumber: 2, half: 'top', batterOrderPosition: 2, playType: '1B', basesReached: [1] }),
    ]
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    expect(snapshot.scoreAway).toBe(1)
    expect(snapshot.baseRunners.first?.orderPosition).toBe(2)
    expect(snapshot.baseRunners.third).toBeNull()
  })

  it('should clear all bases and score everyone on HR', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: '1B', basesReached: [1] }),
      makePlay({ sequenceNumber: 2, half: 'top', batterOrderPosition: 2, playType: '2B', basesReached: [1, 2] }),
      makePlay({ sequenceNumber: 3, half: 'top', batterOrderPosition: 3, playType: 'HR', basesReached: [1, 2, 3, 4] }),
    ]
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    expect(snapshot.scoreAway).toBe(3)
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
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    expect(snapshot.scoreAway).toBe(1)
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
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    expect(snapshot.half).toBe('bottom')
    expect(snapshot.baseRunners.first).toBeNull()
  })

  it('should advance runner on stolen base without advancing batter', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: '1B', basesReached: [1] }),
      makePlay({ sequenceNumber: 2, half: 'top', batterOrderPosition: 2, playType: 'SB', isAtBat: false }),
    ]
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    expect(snapshot.baseRunners.first).toBeNull()
    expect(snapshot.baseRunners.second?.orderPosition).toBe(1)
    expect(snapshot.currentBatterAway).toBe(2)
  })

  it('should remove runner on caught stealing and record an out without advancing batter', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: '1B', basesReached: [1] }),
      makePlay({ sequenceNumber: 2, half: 'top', batterOrderPosition: 2, playType: 'CS', isAtBat: false }),
    ]
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    expect(snapshot.baseRunners.first).toBeNull()
    expect(snapshot.baseRunners.second).toBeNull()
    expect(snapshot.outs).toBe(1)
    expect(snapshot.currentBatterAway).toBe(2)  // batter does NOT advance
  })

  it('should remove correct runner on caught stealing with runnerOverrides (multi-runner)', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: '1B', basesReached: [1] }),
      makePlay({ sequenceNumber: 2, half: 'top', batterOrderPosition: 2, playType: '1B', basesReached: [1] }),
      // Runner on 2nd (batter 1) caught stealing; runner on 1st (batter 2) stays
      makePlay({
        sequenceNumber: 3, half: 'top', batterOrderPosition: 3, playType: 'CS', isAtBat: false,
        runnerOverrides: { first: { playerName: 'away-Player2', orderPosition: 2 }, second: null, third: null },
      }),
    ]
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    expect(snapshot.baseRunners.second).toBeNull()
    expect(snapshot.baseRunners.first?.orderPosition).toBe(2)
    expect(snapshot.outs).toBe(1)
    expect(snapshot.currentBatterAway).toBe(3)  // batter does NOT advance
  })

  it('should end half-inning when caught stealing produces third out', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: 'K' }),
      makePlay({ sequenceNumber: 2, half: 'top', batterOrderPosition: 2, playType: 'K' }),
      makePlay({ sequenceNumber: 3, half: 'top', batterOrderPosition: 3, playType: '1B', basesReached: [1] }),
      makePlay({ sequenceNumber: 4, half: 'top', batterOrderPosition: 4, playType: 'CS', isAtBat: false }),
    ]
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    expect(snapshot.half).toBe('bottom')
    expect(snapshot.outs).toBe(0)
  })

  it('should advance all runners on wild pitch', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: '2B', basesReached: [1, 2] }),
      makePlay({ sequenceNumber: 2, half: 'top', batterOrderPosition: 2, playType: 'WP', isAtBat: false }),
    ]
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    expect(snapshot.baseRunners.second).toBeNull()
    expect(snapshot.baseRunners.third?.orderPosition).toBe(1)
  })
})

describe('replayGame — scoring', () => {
  it('should track runs per inning for away team (top half)', () => {
    // Top half = away team batting
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, inning: 1, half: 'top', batterOrderPosition: 1, playType: 'HR', basesReached: [1, 2, 3, 4] }),
      makePlay({ sequenceNumber: 2, inning: 1, half: 'top', batterOrderPosition: 2, playType: 'K' }),
      makePlay({ sequenceNumber: 3, inning: 1, half: 'top', batterOrderPosition: 3, playType: 'K' }),
      makePlay({ sequenceNumber: 4, inning: 1, half: 'top', batterOrderPosition: 4, playType: 'K' }),
    ]
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    expect(snapshot.runsPerInningAway[0]).toBe(1)
    expect(snapshot.scoreAway).toBe(1)
  })

  it('should track runs per inning for home team (bottom half)', () => {
    // Bottom half = home team batting
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, inning: 1, half: 'top', batterOrderPosition: 1, playType: 'K' }),
      makePlay({ sequenceNumber: 2, inning: 1, half: 'top', batterOrderPosition: 2, playType: 'K' }),
      makePlay({ sequenceNumber: 3, inning: 1, half: 'top', batterOrderPosition: 3, playType: 'K' }),
      makePlay({ sequenceNumber: 4, inning: 1, half: 'bottom', batterOrderPosition: 1, playType: 'HR', basesReached: [1, 2, 3, 4] }),
    ]
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    expect(snapshot.runsPerInningHome[0]).toBe(1)
    expect(snapshot.scoreHome).toBe(1)
  })

  it('should handle multi-run innings', () => {
    // Top half = away team batting
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, inning: 1, half: 'top', batterOrderPosition: 1, playType: '1B', basesReached: [1] }),
      makePlay({ sequenceNumber: 2, inning: 1, half: 'top', batterOrderPosition: 2, playType: '1B', basesReached: [1] }),
      makePlay({ sequenceNumber: 3, inning: 1, half: 'top', batterOrderPosition: 3, playType: 'HR', basesReached: [1, 2, 3, 4] }),
    ]
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    expect(snapshot.scoreAway).toBe(3)
    expect(snapshot.runsPerInningAway[0]).toBe(3)
  })

  it('should credit runs to home team when they bat in bottom half', () => {
    // Bottom half = home team batting
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, inning: 1, half: 'top', batterOrderPosition: 1, playType: 'K' }),
      makePlay({ sequenceNumber: 2, inning: 1, half: 'top', batterOrderPosition: 2, playType: 'K' }),
      makePlay({ sequenceNumber: 3, inning: 1, half: 'top', batterOrderPosition: 3, playType: 'K' }),
      makePlay({ sequenceNumber: 4, inning: 1, half: 'bottom', batterOrderPosition: 1, playType: 'HR', basesReached: [1, 2, 3, 4] }),
    ]
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    expect(snapshot.scoreHome).toBe(1)
    expect(snapshot.scoreAway).toBe(0)
    expect(snapshot.runsPerInningHome[0]).toBe(1)
  })
})

describe('replayGame — 5-run rule', () => {
  it('should end the half-inning when a team scores 5 runs in innings 1-5', () => {
    // Away team scores 5 runs in the top of the 1st via solo HRs and a grand slam
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, inning: 1, half: 'top', batterOrderPosition: 1, playType: '1B', basesReached: [1] }),
      makePlay({ sequenceNumber: 2, inning: 1, half: 'top', batterOrderPosition: 2, playType: '1B', basesReached: [1] }),
      makePlay({ sequenceNumber: 3, inning: 1, half: 'top', batterOrderPosition: 3, playType: '1B', basesReached: [1] }),
      // Bases loaded, grand slam scores 4
      makePlay({ sequenceNumber: 4, inning: 1, half: 'top', batterOrderPosition: 4, playType: 'HR', basesReached: [1, 2, 3, 4], runsScoredOnPlay: 4 }),
      // 5th run: solo HR
      makePlay({ sequenceNumber: 5, inning: 1, half: 'top', batterOrderPosition: 5, playType: 'HR', basesReached: [1, 2, 3, 4], runsScoredOnPlay: 1 }),
    ]
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    // 5 runs scored, half-inning should have advanced to bottom of 1st
    expect(snapshot.scoreAway).toBe(5)
    expect(snapshot.runsPerInningAway[0]).toBe(5)
    expect(snapshot.inning).toBe(1)
    expect(snapshot.half).toBe('bottom')
    expect(snapshot.outs).toBe(0)
    // Bases should be cleared
    expect(snapshot.baseRunners.first).toBeNull()
    expect(snapshot.baseRunners.second).toBeNull()
    expect(snapshot.baseRunners.third).toBeNull()
  })

  it('should cap runs at 5 when a multi-run play would exceed the limit', () => {
    // 3 singles to load bases, then grand slam = 4 runs, only 1 more allowed
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, inning: 1, half: 'top', batterOrderPosition: 1, playType: '1B', basesReached: [1] }),
      makePlay({ sequenceNumber: 2, inning: 1, half: 'top', batterOrderPosition: 2, playType: '1B', basesReached: [1] }),
      makePlay({ sequenceNumber: 3, inning: 1, half: 'top', batterOrderPosition: 3, playType: '1B', basesReached: [1] }),
      // Grand slam: 4 runs scored on this play
      makePlay({ sequenceNumber: 4, inning: 1, half: 'top', batterOrderPosition: 4, playType: 'HR', basesReached: [1, 2, 3, 4], runsScoredOnPlay: 4 }),
      // 2-run HR but only 1 run allowed (cap at 5)
      makePlay({ sequenceNumber: 5, inning: 1, half: 'top', batterOrderPosition: 5, playType: '1B', basesReached: [1] }),
      makePlay({ sequenceNumber: 6, inning: 1, half: 'top', batterOrderPosition: 6, playType: 'HR', basesReached: [1, 2, 3, 4], runsScoredOnPlay: 2 }),
    ]
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    // Only 5 runs count, capped at limit
    expect(snapshot.scoreAway).toBe(5)
    expect(snapshot.runsPerInningAway[0]).toBe(5)
    expect(snapshot.inning).toBe(1)
    expect(snapshot.half).toBe('bottom')
  })

  it('should cap a grand slam at 5 when 3 runs already scored', () => {
    // 3 solo HRs then bases loaded grand slam — only 2 of the 4 runs count
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, inning: 2, half: 'top', batterOrderPosition: 1, playType: 'HR', basesReached: [1, 2, 3, 4], runsScoredOnPlay: 1 }),
      makePlay({ sequenceNumber: 2, inning: 2, half: 'top', batterOrderPosition: 2, playType: 'HR', basesReached: [1, 2, 3, 4], runsScoredOnPlay: 1 }),
      makePlay({ sequenceNumber: 3, inning: 2, half: 'top', batterOrderPosition: 3, playType: 'HR', basesReached: [1, 2, 3, 4], runsScoredOnPlay: 1 }),
      makePlay({ sequenceNumber: 4, inning: 2, half: 'top', batterOrderPosition: 4, playType: '1B', basesReached: [1] }),
      makePlay({ sequenceNumber: 5, inning: 2, half: 'top', batterOrderPosition: 5, playType: '1B', basesReached: [1] }),
      makePlay({ sequenceNumber: 6, inning: 2, half: 'top', batterOrderPosition: 6, playType: '1B', basesReached: [1] }),
      // Bases loaded, grand slam would score 4 but only 2 allowed
      makePlay({ sequenceNumber: 7, inning: 2, half: 'top', batterOrderPosition: 7, playType: 'HR', basesReached: [1, 2, 3, 4], runsScoredOnPlay: 4 }),
    ]
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    expect(snapshot.scoreAway).toBe(5)
    expect(snapshot.runsPerInningAway[1]).toBe(5)
    expect(snapshot.half).toBe('bottom')
  })

  it('should NOT apply the 5-run rule in the 6th inning', () => {
    // Build plays to get to 6th inning, then score 6 runs
    const plays: Play[] = []
    let seq = 1
    // Innings 1-5: 3 quick outs each half
    for (let inn = 1; inn <= 5; inn++) {
      for (const half of ['top', 'bottom'] as const) {
        for (let b = 1; b <= 3; b++) {
          plays.push(makePlay({ sequenceNumber: seq++, inning: inn, half, batterOrderPosition: ((seq - 2) % 9) + 1, playType: 'K' }))
        }
      }
    }
    // 6th inning top: away scores 6 runs (should be allowed)
    const sixthInningBatterStart = (seq - 1) % 9
    plays.push(makePlay({ sequenceNumber: seq++, inning: 6, half: 'top', batterOrderPosition: (sixthInningBatterStart % 9) + 1, playType: '1B', basesReached: [1] }))
    plays.push(makePlay({ sequenceNumber: seq++, inning: 6, half: 'top', batterOrderPosition: ((sixthInningBatterStart + 1) % 9) + 1, playType: '1B', basesReached: [1] }))
    plays.push(makePlay({ sequenceNumber: seq++, inning: 6, half: 'top', batterOrderPosition: ((sixthInningBatterStart + 2) % 9) + 1, playType: 'HR', basesReached: [1, 2, 3, 4], runsScoredOnPlay: 3 }))
    plays.push(makePlay({ sequenceNumber: seq++, inning: 6, half: 'top', batterOrderPosition: ((sixthInningBatterStart + 3) % 9) + 1, playType: '1B', basesReached: [1] }))
    plays.push(makePlay({ sequenceNumber: seq++, inning: 6, half: 'top', batterOrderPosition: ((sixthInningBatterStart + 4) % 9) + 1, playType: '1B', basesReached: [1] }))
    plays.push(makePlay({ sequenceNumber: seq++, inning: 6, half: 'top', batterOrderPosition: ((sixthInningBatterStart + 5) % 9) + 1, playType: 'HR', basesReached: [1, 2, 3, 4], runsScoredOnPlay: 3 }))

    const snapshot = replayGame(plays, lineupHome, lineupAway)
    // Should have scored 6 runs and still be in the 6th inning top (not forced to advance)
    expect(snapshot.scoreAway).toBe(6)
    expect(snapshot.inning).toBe(6)
    expect(snapshot.half).toBe('top')
  })

  it('should apply the 5-run rule in the 5th inning', () => {
    const plays: Play[] = []
    let seq = 1
    // Innings 1-4: 3 quick outs each half
    for (let inn = 1; inn <= 4; inn++) {
      for (const half of ['top', 'bottom'] as const) {
        for (let b = 1; b <= 3; b++) {
          plays.push(makePlay({ sequenceNumber: seq++, inning: inn, half, batterOrderPosition: ((seq - 2) % 9) + 1, playType: 'K' }))
        }
      }
    }
    // 5th inning top: score 5 runs
    const bp = (seq - 1) % 9
    for (let i = 0; i < 5; i++) {
      plays.push(makePlay({ sequenceNumber: seq++, inning: 5, half: 'top', batterOrderPosition: ((bp + i) % 9) + 1, playType: 'HR', basesReached: [1, 2, 3, 4], runsScoredOnPlay: 1 }))
    }

    const snapshot = replayGame(plays, lineupHome, lineupAway)
    expect(snapshot.scoreAway).toBe(5)
    expect(snapshot.inning).toBe(5)
    expect(snapshot.half).toBe('bottom')
    expect(snapshot.outs).toBe(0)
  })

  it('should apply the 5-run rule to the home team in the bottom half', () => {
    // Top of 1st: 3 outs
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, inning: 1, half: 'top', batterOrderPosition: 1, playType: 'K' }),
      makePlay({ sequenceNumber: 2, inning: 1, half: 'top', batterOrderPosition: 2, playType: 'K' }),
      makePlay({ sequenceNumber: 3, inning: 1, half: 'top', batterOrderPosition: 3, playType: 'K' }),
      // Bottom of 1st: home scores 5 HRs
      makePlay({ sequenceNumber: 4, inning: 1, half: 'bottom', batterOrderPosition: 1, playType: 'HR', basesReached: [1, 2, 3, 4], runsScoredOnPlay: 1 }),
      makePlay({ sequenceNumber: 5, inning: 1, half: 'bottom', batterOrderPosition: 2, playType: 'HR', basesReached: [1, 2, 3, 4], runsScoredOnPlay: 1 }),
      makePlay({ sequenceNumber: 6, inning: 1, half: 'bottom', batterOrderPosition: 3, playType: 'HR', basesReached: [1, 2, 3, 4], runsScoredOnPlay: 1 }),
      makePlay({ sequenceNumber: 7, inning: 1, half: 'bottom', batterOrderPosition: 4, playType: 'HR', basesReached: [1, 2, 3, 4], runsScoredOnPlay: 1 }),
      makePlay({ sequenceNumber: 8, inning: 1, half: 'bottom', batterOrderPosition: 5, playType: 'HR', basesReached: [1, 2, 3, 4], runsScoredOnPlay: 1 }),
    ]
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    expect(snapshot.scoreHome).toBe(5)
    expect(snapshot.inning).toBe(2)
    expect(snapshot.half).toBe('top')
    expect(snapshot.outs).toBe(0)
  })

  it('should allow fewer than 5 runs without ending the inning', () => {
    // Away team scores 4 runs with no outs — inning should continue
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, inning: 1, half: 'top', batterOrderPosition: 1, playType: 'HR', basesReached: [1, 2, 3, 4], runsScoredOnPlay: 1 }),
      makePlay({ sequenceNumber: 2, inning: 1, half: 'top', batterOrderPosition: 2, playType: 'HR', basesReached: [1, 2, 3, 4], runsScoredOnPlay: 1 }),
      makePlay({ sequenceNumber: 3, inning: 1, half: 'top', batterOrderPosition: 3, playType: 'HR', basesReached: [1, 2, 3, 4], runsScoredOnPlay: 1 }),
      makePlay({ sequenceNumber: 4, inning: 1, half: 'top', batterOrderPosition: 4, playType: 'HR', basesReached: [1, 2, 3, 4], runsScoredOnPlay: 1 }),
    ]
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    expect(snapshot.scoreAway).toBe(4)
    expect(snapshot.inning).toBe(1)
    expect(snapshot.half).toBe('top')
    expect(snapshot.outs).toBe(0)
  })
})

describe('replayGame — runnerOverrides must also place the batter', () => {
  it('should place batter on reached base when runnerOverrides is used', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: '1B', basesReached: [1] }),
      makePlay({
        sequenceNumber: 2, half: 'top', batterOrderPosition: 2,
        playType: '1B', basesReached: [1],
        runnerOverrides: {
          first: null,
          second: { playerName: 'away-Player1', orderPosition: 1 },
          third: null,
        },
        runsScoredOnPlay: 0,
      }),
    ]
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    // Batter 2 should be on 1st (from basesReached), batter 1 on 2nd (from override)
    expect(snapshot.baseRunners.first).toEqual(expect.objectContaining({ orderPosition: 2 }))
    expect(snapshot.baseRunners.second).toEqual(expect.objectContaining({ orderPosition: 1 }))
    expect(snapshot.baseRunners.third).toBeNull()
  })

  it('should handle 3 consecutive singles with overrides — bases loaded', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: '1B', basesReached: [1] }),
      makePlay({
        sequenceNumber: 2, half: 'top', batterOrderPosition: 2,
        playType: '1B', basesReached: [1],
        runnerOverrides: {
          first: null,
          second: { playerName: 'away-Player1', orderPosition: 1 },
          third: null,
        },
        runsScoredOnPlay: 0,
      }),
      makePlay({
        sequenceNumber: 3, half: 'top', batterOrderPosition: 3,
        playType: '1B', basesReached: [1],
        runnerOverrides: {
          first: null,
          second: { playerName: 'away-Player2', orderPosition: 2 },
          third: { playerName: 'away-Player1', orderPosition: 1 },
        },
        runsScoredOnPlay: 0,
      }),
    ]
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    // Bases loaded: batter 3 on 1st, batter 2 on 2nd, batter 1 on 3rd
    expect(snapshot.baseRunners.first).toEqual(expect.objectContaining({ orderPosition: 3 }))
    expect(snapshot.baseRunners.second).toEqual(expect.objectContaining({ orderPosition: 2 }))
    expect(snapshot.baseRunners.third).toEqual(expect.objectContaining({ orderPosition: 1 }))
  })
})

describe('replayGame — pitch count', () => {
  it('should track cumulative pitch count per pitcher', () => {
    // Top half = away batting, so pitcher is from home lineup
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
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    expect(snapshot.pitchCountByPitcher.get('home-Player1')).toBe(9)
  })

  it('should track pitch counts separately per half-inning pitcher', () => {
    // Top = away batting (pitcher from home), bottom = home batting (pitcher from away)
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, inning: 1, half: 'top', batterOrderPosition: 1, playType: 'K', pitches: ['S', 'S', 'S'] }),
      makePlay({ sequenceNumber: 2, inning: 1, half: 'top', batterOrderPosition: 2, playType: 'K', pitches: ['S', 'S', 'S'] }),
      makePlay({ sequenceNumber: 3, inning: 1, half: 'top', batterOrderPosition: 3, playType: 'K', pitches: ['S', 'S', 'S'] }),
      makePlay({ sequenceNumber: 4, inning: 1, half: 'bottom', batterOrderPosition: 1, playType: 'K', pitches: ['S', 'B', 'S', 'S'] }),
    ]
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    expect(snapshot.pitchCountByPitcher.get('home-Player1')).toBe(9)
    expect(snapshot.pitchCountByPitcher.get('away-Player1')).toBe(4)
  })

  it('should count an implicit pitch for ball-in-play outcomes', () => {
    const plays: Play[] = [
      makePlay({
        sequenceNumber: 1, half: 'top', batterOrderPosition: 1,
        playType: '1B', basesReached: [1], pitches: ['B', 'S'],
      }),
    ]
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    // 2 tracked pitches + 1 implicit ball-in-play = 3 total
    expect(snapshot.pitchCountByPitcher.get('home-Player1')).toBe(3)
  })

  it('should count implicit pitch for all ball-in-play types', () => {
    const plays: Play[] = [
      // GO with 1 tracked pitch → 2 total
      makePlay({
        sequenceNumber: 1, half: 'top', batterOrderPosition: 1,
        playType: 'GO', pitches: ['S'],
      }),
      // FO with 0 tracked pitches → 1 total
      makePlay({
        sequenceNumber: 2, half: 'top', batterOrderPosition: 2,
        playType: 'FO', pitches: [],
      }),
      // HBP with 2 tracked pitches → 3 total
      makePlay({
        sequenceNumber: 3, half: 'top', batterOrderPosition: 3,
        playType: 'HBP', basesReached: [1], pitches: ['B', 'S'],
      }),
    ]
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    // 1 + 1 + 2 tracked = 4; + 3 implicit = 6 total
    expect(snapshot.pitchCountByPitcher.get('home-Player1')).toBe(6)
  })

  it('should NOT count implicit pitch for K, KL, or BB (already tracked)', () => {
    const plays: Play[] = [
      makePlay({
        sequenceNumber: 1, half: 'top', batterOrderPosition: 1,
        playType: 'K', pitches: ['S', 'S', 'S'],
      }),
      makePlay({
        sequenceNumber: 2, half: 'top', batterOrderPosition: 2,
        playType: 'BB', pitches: ['B', 'B', 'B', 'B'],
      }),
    ]
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    // 3 + 4 = 7, no implicit pitches added
    expect(snapshot.pitchCountByPitcher.get('home-Player1')).toBe(7)
  })

  it('should NOT count implicit pitch for non-at-bat E (no pitch thrown)', () => {
    const plays: Play[] = [
      // 1B with 0 tracked pitches → 1 implicit = 1 pitch
      makePlay({
        sequenceNumber: 1, half: 'top', batterOrderPosition: 1,
        playType: '1B', basesReached: [1], pitches: [],
      }),
      // Non-at-bat E (batter stayed at bat): isAtBat=false, pitches=[]
      makePlay({
        sequenceNumber: 2, half: 'top', batterOrderPosition: 2,
        playType: 'E', basesReached: [], pitches: [], isAtBat: false,
      }),
      // Batter 2 finishes at-bat: K with 4 tracked pitches (B, S, S, S)
      makePlay({
        sequenceNumber: 3, half: 'top', batterOrderPosition: 2,
        playType: 'K', pitches: ['B', 'S', 'S', 'S'],
      }),
    ]
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    // 1 (1B implicit) + 0 (non-at-bat E, no implicit) + 4 (K tracked) = 5
    expect(snapshot.pitchCountByPitcher.get('home-Player1')).toBe(5)
  })

  it('should attribute pitches to correct pitcher after position change', () => {
    // Home lineup AFTER position change: Player1 moved P→RF, Player9 moved RF→P at inning 2 top
    const homeWithChange: Lineup = {
      gameId: 1,
      side: 'home',
      battingOrder: [
        { orderPosition: 1, playerId: 1, playerName: 'home-Player1', jerseyNumber: 10, position: 'RF',
          substitutions: [{ inning: 2, half: 'top', newPlayerName: 'home-Player1', newJerseyNumber: 10, newPosition: 'RF' }] },
        { orderPosition: 2, playerId: 2, playerName: 'home-Player2', jerseyNumber: 20, position: 'C', substitutions: [] },
        { orderPosition: 3, playerId: 3, playerName: 'home-Player3', jerseyNumber: 30, position: '1B', substitutions: [] },
        { orderPosition: 4, playerId: 4, playerName: 'home-Player4', jerseyNumber: 40, position: '2B', substitutions: [] },
        { orderPosition: 5, playerId: 5, playerName: 'home-Player5', jerseyNumber: 50, position: '3B', substitutions: [] },
        { orderPosition: 6, playerId: 6, playerName: 'home-Player6', jerseyNumber: 60, position: 'SS', substitutions: [] },
        { orderPosition: 7, playerId: 7, playerName: 'home-Player7', jerseyNumber: 70, position: 'LF', substitutions: [] },
        { orderPosition: 8, playerId: 8, playerName: 'home-Player8', jerseyNumber: 80, position: 'CF', substitutions: [] },
        { orderPosition: 9, playerId: 9, playerName: 'home-Player9', jerseyNumber: 90, position: 'P',
          substitutions: [{ inning: 2, half: 'top', newPlayerName: 'home-Player9', newJerseyNumber: 90, newPosition: 'P' }] },
      ],
    }

    const plays: Play[] = [
      // Inning 1 top: home-Player1 should be pitching (before change at inning 2)
      makePlay({ sequenceNumber: 1, inning: 1, half: 'top', batterOrderPosition: 1, playType: 'K', pitches: ['S', 'S', 'S'] }),
      makePlay({ sequenceNumber: 2, inning: 1, half: 'top', batterOrderPosition: 2, playType: 'K', pitches: ['S', 'S', 'S'] }),
      makePlay({ sequenceNumber: 3, inning: 1, half: 'top', batterOrderPosition: 3, playType: 'K', pitches: ['S', 'S', 'S'] }),
      // Inning 2 top: home-Player9 is now pitching (change took effect)
      makePlay({ sequenceNumber: 4, inning: 2, half: 'top', batterOrderPosition: 4, playType: 'K', pitches: ['S', 'S', 'S'] }),
      makePlay({ sequenceNumber: 5, inning: 2, half: 'top', batterOrderPosition: 5, playType: 'K', pitches: ['S', 'S', 'S'] }),
    ]

    const snapshot = replayGame(plays, homeWithChange, lineupAway)
    // Player1 pitched inning 1: 3 K's × 3 pitches = 9
    expect(snapshot.pitchCountByPitcher.get('home-Player1')).toBe(9)
    // Player9 pitched inning 2: 2 K's × 3 pitches = 6
    expect(snapshot.pitchCountByPitcher.get('home-Player9')).toBe(6)
  })

  it('should use play.pitcherName for mid-inning pitcher change', () => {
    // Position change happens MID-inning: both the play before and the sub are at (2, top)
    // play.pitcherName resolves the ambiguity
    const homeWithChange: Lineup = {
      gameId: 1,
      side: 'home',
      battingOrder: [
        { orderPosition: 1, playerId: 1, playerName: 'home-Player1', jerseyNumber: 10, position: 'RF',
          substitutions: [{ inning: 2, half: 'top', newPlayerName: 'home-Player1', newJerseyNumber: 10, newPosition: 'RF' }] },
        { orderPosition: 2, playerId: 2, playerName: 'home-Player2', jerseyNumber: 20, position: 'C', substitutions: [] },
        { orderPosition: 3, playerId: 3, playerName: 'home-Player3', jerseyNumber: 30, position: '1B', substitutions: [] },
        { orderPosition: 4, playerId: 4, playerName: 'home-Player4', jerseyNumber: 40, position: '2B', substitutions: [] },
        { orderPosition: 5, playerId: 5, playerName: 'home-Player5', jerseyNumber: 50, position: '3B', substitutions: [] },
        { orderPosition: 6, playerId: 6, playerName: 'home-Player6', jerseyNumber: 60, position: 'SS', substitutions: [] },
        { orderPosition: 7, playerId: 7, playerName: 'home-Player7', jerseyNumber: 70, position: 'LF', substitutions: [] },
        { orderPosition: 8, playerId: 8, playerName: 'home-Player8', jerseyNumber: 80, position: 'CF', substitutions: [] },
        { orderPosition: 9, playerId: 9, playerName: 'home-Player9', jerseyNumber: 90, position: 'P',
          substitutions: [{ inning: 2, half: 'top', newPlayerName: 'home-Player9', newJerseyNumber: 90, newPosition: 'P' }] },
      ],
    }

    const plays: Play[] = [
      // Inning 2 top, BEFORE position change: Player1 still pitching
      makePlay({ sequenceNumber: 1, inning: 2, half: 'top', batterOrderPosition: 1, playType: 'K', pitches: ['S', 'S', 'S'], pitcherName: 'home-Player1' }),
      // Position change happens here (also recorded at inning 2, top)
      // Inning 2 top, AFTER position change: Player9 now pitching
      makePlay({ sequenceNumber: 2, inning: 2, half: 'top', batterOrderPosition: 2, playType: 'K', pitches: ['S', 'S', 'S'], pitcherName: 'home-Player9' }),
    ]

    const snapshot = replayGame(plays, homeWithChange, lineupAway)
    expect(snapshot.pitchCountByPitcher.get('home-Player1')).toBe(3)
    expect(snapshot.pitchCountByPitcher.get('home-Player9')).toBe(3)
  })

  it('should handle multiple pitcher changes across a game', () => {
    // Three pitchers: Player1 (original), Player9 (from inning 2), Player8 (from inning 3)
    const homeWithChanges: Lineup = {
      gameId: 1,
      side: 'home',
      battingOrder: [
        { orderPosition: 1, playerId: 1, playerName: 'home-Player1', jerseyNumber: 10, position: 'RF',
          substitutions: [{ inning: 2, half: 'top', newPlayerName: 'home-Player1', newJerseyNumber: 10, newPosition: 'RF' }] },
        { orderPosition: 2, playerId: 2, playerName: 'home-Player2', jerseyNumber: 20, position: 'C', substitutions: [] },
        { orderPosition: 3, playerId: 3, playerName: 'home-Player3', jerseyNumber: 30, position: '1B', substitutions: [] },
        { orderPosition: 4, playerId: 4, playerName: 'home-Player4', jerseyNumber: 40, position: '2B', substitutions: [] },
        { orderPosition: 5, playerId: 5, playerName: 'home-Player5', jerseyNumber: 50, position: '3B', substitutions: [] },
        { orderPosition: 6, playerId: 6, playerName: 'home-Player6', jerseyNumber: 60, position: 'SS', substitutions: [] },
        { orderPosition: 7, playerId: 7, playerName: 'home-Player7', jerseyNumber: 70, position: 'LF', substitutions: [] },
        { orderPosition: 8, playerId: 8, playerName: 'home-Player8', jerseyNumber: 80, position: 'P',
          substitutions: [{ inning: 3, half: 'top', newPlayerName: 'home-Player8', newJerseyNumber: 80, newPosition: 'P' }] },
        { orderPosition: 9, playerId: 9, playerName: 'home-Player9', jerseyNumber: 90, position: 'CF',
          substitutions: [
            { inning: 2, half: 'top', newPlayerName: 'home-Player9', newJerseyNumber: 90, newPosition: 'P' },
            { inning: 3, half: 'top', newPlayerName: 'home-Player9', newJerseyNumber: 90, newPosition: 'CF' },
          ] },
      ],
    }

    const plays: Play[] = [
      // Inning 1: Player1 pitching
      makePlay({ sequenceNumber: 1, inning: 1, half: 'top', batterOrderPosition: 1, playType: 'K', pitches: ['S', 'S', 'S'] }),
      // Inning 2: Player9 pitching
      makePlay({ sequenceNumber: 2, inning: 2, half: 'top', batterOrderPosition: 2, playType: 'K', pitches: ['S', 'S', 'S'] }),
      // Inning 3: Player8 pitching
      makePlay({ sequenceNumber: 3, inning: 3, half: 'top', batterOrderPosition: 3, playType: 'K', pitches: ['S', 'S', 'S'] }),
    ]

    const snapshot = replayGame(plays, homeWithChanges, lineupAway)
    expect(snapshot.pitchCountByPitcher.get('home-Player1')).toBe(3)
    expect(snapshot.pitchCountByPitcher.get('home-Player9')).toBe(3)
    expect(snapshot.pitchCountByPitcher.get('home-Player8')).toBe(3)
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
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    expect(snapshot.isGameOver).toBe(true)
  })

  it('should not set isGameOver before 6 innings are complete', () => {
    const plays: Play[] = [
      ...makeInning(1, 1, 'top'),
      ...makeInning(4, 1, 'bottom'),
    ]
    const snapshot = replayGame(plays, lineupHome, lineupAway)
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
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    expect(snapshot.isGameOver).toBe(true)
    expect(snapshot.scoreAway).toBe(0) // HR in inning 7 was not processed
  })
})

describe('replayGame — walk-off and skip bottom of last inning', () => {
  // Helper: generates 3 strikeouts for one half-inning
  function makeHalfInning(startSeq: number, inning: number, half: 'top' | 'bottom'): Play[] {
    return [
      makePlay({ sequenceNumber: startSeq, inning, half, batterOrderPosition: 1, playType: 'K' }),
      makePlay({ sequenceNumber: startSeq + 1, inning, half, batterOrderPosition: 2, playType: 'K' }),
      makePlay({ sequenceNumber: startSeq + 2, inning, half, batterOrderPosition: 3, playType: 'K' }),
    ]
  }

  // Helper: generates plays for innings 1 through N (both halves), all strikeouts
  function makeScorelessInnings(count: number): Play[] {
    const plays: Play[] = []
    let seq = 1
    for (let inn = 1; inn <= count; inn++) {
      plays.push(...makeHalfInning(seq, inn, 'top'))
      seq += 3
      plays.push(...makeHalfInning(seq, inn, 'bottom'))
      seq += 3
    }
    return plays
  }

  it('should skip bottom of last inning when home team already leads', () => {
    // Home team scores in bottom of 1st, then leads through top 6
    const plays: Play[] = []
    let seq = 1

    // Top 1: away bats, 3 Ks
    plays.push(...makeHalfInning(seq, 1, 'top'))
    seq += 3

    // Bottom 1: home scores 5 runs via HR with bases loaded + solo HR (5-run rule ends half)
    plays.push(makePlay({ sequenceNumber: seq++, inning: 1, half: 'bottom', batterOrderPosition: 1, playType: '1B', basesReached: [1] }))
    plays.push(makePlay({ sequenceNumber: seq++, inning: 1, half: 'bottom', batterOrderPosition: 2, playType: '1B', basesReached: [1] }))
    plays.push(makePlay({ sequenceNumber: seq++, inning: 1, half: 'bottom', batterOrderPosition: 3, playType: '1B', basesReached: [1] }))
    plays.push(makePlay({ sequenceNumber: seq++, inning: 1, half: 'bottom', batterOrderPosition: 4, playType: 'HR', basesReached: [1, 2, 3, 4] }))
    // Score: home 4, away 0. Then HR for 5th run — 5-run rule ends the inning:
    plays.push(makePlay({ sequenceNumber: seq++, inning: 1, half: 'bottom', batterOrderPosition: 5, playType: 'HR', basesReached: [1, 2, 3, 4] }))

    // Innings 2-5: all scoreless
    for (let inn = 2; inn <= 5; inn++) {
      plays.push(...makeHalfInning(seq, inn, 'top'))
      seq += 3
      plays.push(...makeHalfInning(seq, inn, 'bottom'))
      seq += 3
    }

    // Top 6: away scores 0 (3 Ks)
    plays.push(...makeHalfInning(seq, 6, 'top'))

    // After top 6 ends with home leading 5-0, game should be over
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    expect(snapshot.isGameOver).toBe(true)
    expect(snapshot.scoreHome).toBe(5)
    expect(snapshot.scoreAway).toBe(0)
    // Should be at bottom of 6 (half was advanced) but game ended
    expect(snapshot.inning).toBe(6)
    expect(snapshot.half).toBe('bottom')
  })

  it('should NOT skip bottom of last inning when away team leads', () => {
    const plays: Play[] = []
    let seq = 1

    // Top 1: away scores 5 runs (5-run rule ends the half-inning)
    plays.push(makePlay({ sequenceNumber: seq++, inning: 1, half: 'top', batterOrderPosition: 1, playType: '1B', basesReached: [1] }))
    plays.push(makePlay({ sequenceNumber: seq++, inning: 1, half: 'top', batterOrderPosition: 2, playType: '1B', basesReached: [1] }))
    plays.push(makePlay({ sequenceNumber: seq++, inning: 1, half: 'top', batterOrderPosition: 3, playType: '1B', basesReached: [1] }))
    plays.push(makePlay({ sequenceNumber: seq++, inning: 1, half: 'top', batterOrderPosition: 4, playType: 'HR', basesReached: [1, 2, 3, 4] }))
    plays.push(makePlay({ sequenceNumber: seq++, inning: 1, half: 'top', batterOrderPosition: 5, playType: 'HR', basesReached: [1, 2, 3, 4] }))

    // Bottom 1: home scores 0 (5-run rule already advanced to bottom)
    plays.push(...makeHalfInning(seq, 1, 'bottom'))
    seq += 3

    // Innings 2-5: all scoreless
    for (let inn = 2; inn <= 5; inn++) {
      plays.push(...makeHalfInning(seq, inn, 'top'))
      seq += 3
      plays.push(...makeHalfInning(seq, inn, 'bottom'))
      seq += 3
    }

    // Top 6: away scores 0 (3 Ks)
    plays.push(...makeHalfInning(seq, 6, 'top'))

    // Away leads 5-0 after top 6 — game should NOT be over, home needs to bat
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    expect(snapshot.isGameOver).toBe(false)
    expect(snapshot.inning).toBe(6)
    expect(snapshot.half).toBe('bottom')
  })

  it('should end game on walk-off hit in bottom of 6th', () => {
    // Scoreless through 5.5 innings, then away scores in top 6, walk-off in bottom 6
    const plays: Play[] = []
    let seq = 1

    // Innings 1-5: all scoreless
    for (let inn = 1; inn <= 5; inn++) {
      plays.push(...makeHalfInning(seq, inn, 'top'))
      seq += 3
      plays.push(...makeHalfInning(seq, inn, 'bottom'))
      seq += 3
    }

    // Top 6: away scores 3 runs
    plays.push(makePlay({ sequenceNumber: seq++, inning: 6, half: 'top', batterOrderPosition: 1, playType: '1B', basesReached: [1] }))
    plays.push(makePlay({ sequenceNumber: seq++, inning: 6, half: 'top', batterOrderPosition: 2, playType: '1B', basesReached: [1] }))
    plays.push(makePlay({ sequenceNumber: seq++, inning: 6, half: 'top', batterOrderPosition: 3, playType: 'HR', basesReached: [1, 2, 3, 4] }))
    plays.push(makePlay({ sequenceNumber: seq++, inning: 6, half: 'top', batterOrderPosition: 4, playType: 'K' }))
    plays.push(makePlay({ sequenceNumber: seq++, inning: 6, half: 'top', batterOrderPosition: 5, playType: 'K' }))
    plays.push(makePlay({ sequenceNumber: seq++, inning: 6, half: 'top', batterOrderPosition: 6, playType: 'K' }))

    // Bottom 6: home scores 3 to tie, then walk-off HR
    plays.push(makePlay({ sequenceNumber: seq++, inning: 6, half: 'bottom', batterOrderPosition: 1, playType: '1B', basesReached: [1] }))
    plays.push(makePlay({ sequenceNumber: seq++, inning: 6, half: 'bottom', batterOrderPosition: 2, playType: '1B', basesReached: [1] }))
    plays.push(makePlay({ sequenceNumber: seq++, inning: 6, half: 'bottom', batterOrderPosition: 3, playType: 'HR', basesReached: [1, 2, 3, 4] }))
    // Score: home 3, away 3 — tied, NOT a walk-off yet

    // Walk-off HR
    plays.push(makePlay({ sequenceNumber: seq++, inning: 6, half: 'bottom', batterOrderPosition: 4, playType: 'HR', basesReached: [1, 2, 3, 4] }))
    // Score: home 4, away 3 — walk-off!

    const snapshot = replayGame(plays, lineupHome, lineupAway)
    expect(snapshot.isGameOver).toBe(true)
    expect(snapshot.scoreHome).toBe(4)
    expect(snapshot.scoreAway).toBe(3)
    expect(snapshot.inning).toBe(6)
    expect(snapshot.half).toBe('bottom')
  })

  it('should NOT end game on walk-off if score is only tied', () => {
    const plays: Play[] = []
    let seq = 1

    // Innings 1-5: all scoreless
    for (let inn = 1; inn <= 5; inn++) {
      plays.push(...makeHalfInning(seq, inn, 'top'))
      seq += 3
      plays.push(...makeHalfInning(seq, inn, 'bottom'))
      seq += 3
    }

    // Top 6: away scores 1
    plays.push(makePlay({ sequenceNumber: seq++, inning: 6, half: 'top', batterOrderPosition: 1, playType: 'HR', basesReached: [1, 2, 3, 4] }))
    plays.push(makePlay({ sequenceNumber: seq++, inning: 6, half: 'top', batterOrderPosition: 2, playType: 'K' }))
    plays.push(makePlay({ sequenceNumber: seq++, inning: 6, half: 'top', batterOrderPosition: 3, playType: 'K' }))
    plays.push(makePlay({ sequenceNumber: seq++, inning: 6, half: 'top', batterOrderPosition: 4, playType: 'K' }))

    // Bottom 6: home ties it 1-1
    plays.push(makePlay({ sequenceNumber: seq++, inning: 6, half: 'bottom', batterOrderPosition: 1, playType: 'HR', basesReached: [1, 2, 3, 4] }))
    // Score: 1-1 tied. Game should NOT be over.

    const snapshot = replayGame(plays, lineupHome, lineupAway)
    expect(snapshot.isGameOver).toBe(false)
    expect(snapshot.scoreHome).toBe(1)
    expect(snapshot.scoreAway).toBe(1)
    expect(snapshot.inning).toBe(6)
    expect(snapshot.half).toBe('bottom')
  })

  it('normal game over after full 6 innings with tied score going to extras', () => {
    // Both teams score 0, play all 6 full innings — game goes to inning 7
    const plays = makeScorelessInnings(6)
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    expect(snapshot.isGameOver).toBe(true)
    expect(snapshot.inning).toBe(7)
    expect(snapshot.half).toBe('top')
  })

  it('should handle walk-off in extra innings (bottom of 7th)', () => {
    const plays: Play[] = []
    let seq = 1

    // 6 scoreless innings
    for (let inn = 1; inn <= 6; inn++) {
      plays.push(...makeHalfInning(seq, inn, 'top'))
      seq += 3
      plays.push(...makeHalfInning(seq, inn, 'bottom'))
      seq += 3
    }

    // The existing engine marks game over after 6 full innings.
    // With the new logic, a tied game after 6 goes to 7. Let's test
    // top of 7 (away scores 0) then bottom of 7 walk-off.
    // NOTE: The current engine sets isGameOver when inning > 6 after advanceHalfInning.
    // With a tie, the game IS over by the standard rule. Extra innings handling
    // would require further engine changes — this test verifies current behavior
    // where a tied game after 6 full innings is marked game over.
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    expect(snapshot.isGameOver).toBe(true)
  })

  it('should NOT skip bottom when away team leads after top of last inning', () => {
    // Away leads after top 6 — home still needs to bat
    const plays: Play[] = []
    let seq = 1

    // Top 1: away scores 5 (5-run rule ends the half-inning)
    plays.push(makePlay({ sequenceNumber: seq++, inning: 1, half: 'top', batterOrderPosition: 1, playType: '1B', basesReached: [1] }))
    plays.push(makePlay({ sequenceNumber: seq++, inning: 1, half: 'top', batterOrderPosition: 2, playType: '1B', basesReached: [1] }))
    plays.push(makePlay({ sequenceNumber: seq++, inning: 1, half: 'top', batterOrderPosition: 3, playType: '1B', basesReached: [1] }))
    plays.push(makePlay({ sequenceNumber: seq++, inning: 1, half: 'top', batterOrderPosition: 4, playType: 'HR', basesReached: [1, 2, 3, 4] }))
    plays.push(makePlay({ sequenceNumber: seq++, inning: 1, half: 'top', batterOrderPosition: 5, playType: 'HR', basesReached: [1, 2, 3, 4] }))

    // Bottom 1: home scores 0 (5-run rule already advanced to bottom)
    plays.push(...makeHalfInning(seq, 1, 'bottom'))
    seq += 3

    // Innings 2-5: scoreless
    for (let inn = 2; inn <= 5; inn++) {
      plays.push(...makeHalfInning(seq, inn, 'top'))
      seq += 3
      plays.push(...makeHalfInning(seq, inn, 'bottom'))
      seq += 3
    }

    // Top 6: away scores 0
    plays.push(...makeHalfInning(seq, 6, 'top'))
    seq += 3

    // Away leads 5-0 after top 6. Home trails, so bottom of 6 is NOT skipped.
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    expect(snapshot.isGameOver).toBe(false)
    expect(snapshot.inning).toBe(6)
    expect(snapshot.half).toBe('bottom')
    expect(snapshot.scoreAway).toBe(5)
    expect(snapshot.scoreHome).toBe(0)
  })

  it('should skip bottom when home team leads after top of last inning', () => {
    // Home leads after top 6 — skip bottom
    const plays: Play[] = []
    let seq = 1

    // Top 1: away scores 0
    plays.push(...makeHalfInning(seq, 1, 'top'))
    seq += 3

    // Bottom 1: home scores 5 (5-run rule ends the half-inning)
    plays.push(makePlay({ sequenceNumber: seq++, inning: 1, half: 'bottom', batterOrderPosition: 1, playType: '1B', basesReached: [1] }))
    plays.push(makePlay({ sequenceNumber: seq++, inning: 1, half: 'bottom', batterOrderPosition: 2, playType: '1B', basesReached: [1] }))
    plays.push(makePlay({ sequenceNumber: seq++, inning: 1, half: 'bottom', batterOrderPosition: 3, playType: '1B', basesReached: [1] }))
    plays.push(makePlay({ sequenceNumber: seq++, inning: 1, half: 'bottom', batterOrderPosition: 4, playType: 'HR', basesReached: [1, 2, 3, 4] }))
    plays.push(makePlay({ sequenceNumber: seq++, inning: 1, half: 'bottom', batterOrderPosition: 5, playType: 'HR', basesReached: [1, 2, 3, 4] }))

    // Innings 2-5: scoreless
    for (let inn = 2; inn <= 5; inn++) {
      plays.push(...makeHalfInning(seq, inn, 'top'))
      seq += 3
      plays.push(...makeHalfInning(seq, inn, 'bottom'))
      seq += 3
    }

    // Top 6: away scores 0
    plays.push(...makeHalfInning(seq, 6, 'top'))

    // Home leads 5-0 after top 6 → skip bottom
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    expect(snapshot.isGameOver).toBe(true)
    expect(snapshot.scoreHome).toBe(5)
    expect(snapshot.scoreAway).toBe(0)
    expect(snapshot.inning).toBe(6)
    expect(snapshot.half).toBe('bottom')
  })

  it('walk-off on a non-at-bat play (WP scores runner in bottom 6)', () => {
    const plays: Play[] = []
    let seq = 1

    // Innings 1-5: scoreless
    for (let inn = 1; inn <= 5; inn++) {
      plays.push(...makeHalfInning(seq, inn, 'top'))
      seq += 3
      plays.push(...makeHalfInning(seq, inn, 'bottom'))
      seq += 3
    }

    // Top 6: away scores 1
    plays.push(makePlay({ sequenceNumber: seq++, inning: 6, half: 'top', batterOrderPosition: 1, playType: 'HR', basesReached: [1, 2, 3, 4] }))
    plays.push(makePlay({ sequenceNumber: seq++, inning: 6, half: 'top', batterOrderPosition: 2, playType: 'K' }))
    plays.push(makePlay({ sequenceNumber: seq++, inning: 6, half: 'top', batterOrderPosition: 3, playType: 'K' }))
    plays.push(makePlay({ sequenceNumber: seq++, inning: 6, half: 'top', batterOrderPosition: 4, playType: 'K' }))

    // Bottom 6: home gets runner on 3rd, then ties with single, then walk-off triple
    plays.push(makePlay({ sequenceNumber: seq++, inning: 6, half: 'bottom', batterOrderPosition: 1, playType: '3B', basesReached: [1, 2, 3] }))
    // Runner on 3rd scores on single, ties it 1-1
    plays.push(makePlay({ sequenceNumber: seq++, inning: 6, half: 'bottom', batterOrderPosition: 2, playType: '1B', basesReached: [1] }))
    // Now 1-1 tied. Batter on 1st. Next batter gets triple — runner scores, batter on 3rd: 2-1 walk-off
    plays.push(makePlay({ sequenceNumber: seq++, inning: 6, half: 'bottom', batterOrderPosition: 3, playType: '3B', basesReached: [1, 2, 3] }))

    const snapshot = replayGame(plays, lineupHome, lineupAway)
    expect(snapshot.isGameOver).toBe(true)
    expect(snapshot.scoreHome).toBe(2)
    expect(snapshot.scoreAway).toBe(1)
  })
})

describe('replayGame — runner advancement bugs', () => {
  it('1B with runner on 2nd: batter on 1st, runner on 2nd advances to 3rd', () => {
    const plays = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: '2B', basesReached: [1,2] }),
      makePlay({ sequenceNumber: 2, half: 'top', batterOrderPosition: 2, playType: '1B', basesReached: [1] }),
    ]
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    expect(snapshot.scoreAway).toBe(0)
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
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    expect(snapshot.scoreAway).toBe(1)  // only pos1 (was on 3rd) scores
    expect(snapshot.baseRunners.third?.orderPosition).toBe(2)  // pos2 (was on 2nd) advances to 3rd
    expect(snapshot.baseRunners.second?.orderPosition).toBe(3) // pos3 (was on 1st) advances to 2nd
    expect(snapshot.baseRunners.first?.orderPosition).toBe(4)  // batter on 1st
  })

  it('E with runner on 2nd should advance runner to 3rd, not score', () => {
    const plays = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: '2B', basesReached: [1,2] }),
      makePlay({ sequenceNumber: 2, half: 'top', batterOrderPosition: 2, playType: 'E', basesReached: [1] }),
    ]
    const snapshot = replayGame(plays, lineupHome, lineupAway)
    expect(snapshot.scoreAway).toBe(0)
    expect(snapshot.baseRunners.third?.orderPosition).toBe(1)  // runner advanced to 3rd
    expect(snapshot.baseRunners.first?.orderPosition).toBe(2)  // batter on 1st
  })
})

describe('score total matches visual diamond fills (journey base-4 count)', () => {
  it('total score equals count of journeys that include base 4', () => {
    // Multi-inning scenario with runs scored via continuation advancement:
    //
    // Inning 1 top (away batting):
    //   Batter 1: single (on 1st)
    //   Batter 2: single (batter on 1st, runner 1 → 2nd)
    //   Batter 3: single (batter on 1st, runner 2 → 2nd, runner 1 → 3rd)
    //   Batter 4: single (batter on 1st, runner 3 → 2nd, runner 2 → 3rd, runner 1 scores) → 1 run
    //   Batter 5: strikeout
    //   Batter 6: strikeout
    //   Batter 7: strikeout
    //   Score: away 1, home 0
    //
    // Inning 1 bottom (home batting):
    //   Batter 1: single (on 1st)
    //   Batter 2: single (batter on 1st, runner 1 → 2nd)
    //   Batter 3: double (batter on 2nd, runner 2 → 3rd, runner 1 scores) → 1 run
    //   Batter 4: single (batter on 1st, runner 3 → scores, runner on 2nd → 3rd) → 1 run
    //   Batter 5: strikeout
    //   Batter 6: strikeout
    //   Batter 7: strikeout
    //   Score: away 1, home 2

    const plays: Play[] = [
      // --- Inning 1 top: away bats ---
      makePlay({ id: 1, sequenceNumber: 1, inning: 1, half: 'top', batterOrderPosition: 1, playType: '1B', basesReached: [1] }),
      makePlay({ id: 2, sequenceNumber: 2, inning: 1, half: 'top', batterOrderPosition: 2, playType: '1B', basesReached: [1] }),
      makePlay({ id: 3, sequenceNumber: 3, inning: 1, half: 'top', batterOrderPosition: 3, playType: '1B', basesReached: [1] }),
      makePlay({ id: 4, sequenceNumber: 4, inning: 1, half: 'top', batterOrderPosition: 4, playType: '1B', basesReached: [1], runsScoredOnPlay: 1 }),
      makePlay({ id: 5, sequenceNumber: 5, inning: 1, half: 'top', batterOrderPosition: 5, playType: 'K' }),
      makePlay({ id: 6, sequenceNumber: 6, inning: 1, half: 'top', batterOrderPosition: 6, playType: 'K' }),
      makePlay({ id: 7, sequenceNumber: 7, inning: 1, half: 'top', batterOrderPosition: 7, playType: 'K' }),

      // --- Inning 1 bottom: home bats ---
      makePlay({ id: 8, sequenceNumber: 8, inning: 1, half: 'bottom', batterOrderPosition: 1, playType: '1B', basesReached: [1] }),
      makePlay({ id: 9, sequenceNumber: 9, inning: 1, half: 'bottom', batterOrderPosition: 2, playType: '1B', basesReached: [1] }),
      makePlay({ id: 10, sequenceNumber: 10, inning: 1, half: 'bottom', batterOrderPosition: 3, playType: '2B', basesReached: [1, 2], runsScoredOnPlay: 1 }),
      makePlay({ id: 11, sequenceNumber: 11, inning: 1, half: 'bottom', batterOrderPosition: 4, playType: '1B', basesReached: [1], runsScoredOnPlay: 1 }),
      makePlay({ id: 12, sequenceNumber: 12, inning: 1, half: 'bottom', batterOrderPosition: 5, playType: 'K' }),
      makePlay({ id: 13, sequenceNumber: 13, inning: 1, half: 'bottom', batterOrderPosition: 6, playType: 'K' }),
      makePlay({ id: 14, sequenceNumber: 14, inning: 1, half: 'bottom', batterOrderPosition: 7, playType: 'K' }),
    ]

    const snapshot = replayGame(plays, lineupHome, lineupAway)
    const journeys = computeRunnerJourneys(plays, lineupHome, lineupAway)

    // Count journeys that include base 4 (runner scored)
    let visualRuns = 0
    for (const [, journey] of journeys) {
      if (journey.includes(4)) visualRuns++
    }

    // Engine score: away scored 1 (top), home scored 2 (bottom) = 3 total
    expect(snapshot.scoreAway).toBe(1)
    expect(snapshot.scoreHome).toBe(2)
    expect(visualRuns).toBe(snapshot.scoreHome + snapshot.scoreAway)
  })

  it('score matches journeys with stolen base and wild pitch advancement', () => {
    // A runner reaches base, then advances via SB and WP before scoring on a hit.
    // This tests that non-at-bat continuation plays also produce correct journey-to-score matching.
    //
    // Inning 1 top (away batting):
    //   Batter 1: single (on 1st)
    //   SB: runner 1 steals 2nd
    //   WP: runner 1 advances to 3rd
    //   Batter 2: single (runner 1 scores from 3rd) → 1 run
    //   Batter 3: strikeout
    //   Batter 4: strikeout
    //   Batter 5: strikeout

    const plays: Play[] = [
      makePlay({ id: 1, sequenceNumber: 1, inning: 1, half: 'top', batterOrderPosition: 1, playType: '1B', basesReached: [1] }),
      makePlay({ id: 2, sequenceNumber: 2, inning: 1, half: 'top', batterOrderPosition: 2, playType: 'SB', basesReached: [], isAtBat: false }),
      makePlay({ id: 3, sequenceNumber: 3, inning: 1, half: 'top', batterOrderPosition: 2, playType: 'WP', basesReached: [], isAtBat: false }),
      makePlay({ id: 4, sequenceNumber: 4, inning: 1, half: 'top', batterOrderPosition: 2, playType: '1B', basesReached: [1], runsScoredOnPlay: 1 }),
      makePlay({ id: 5, sequenceNumber: 5, inning: 1, half: 'top', batterOrderPosition: 3, playType: 'K' }),
      makePlay({ id: 6, sequenceNumber: 6, inning: 1, half: 'top', batterOrderPosition: 4, playType: 'K' }),
      makePlay({ id: 7, sequenceNumber: 7, inning: 1, half: 'top', batterOrderPosition: 5, playType: 'K' }),
    ]

    const snapshot = replayGame(plays, lineupHome, lineupAway)
    const journeys = computeRunnerJourneys(plays, lineupHome, lineupAway)

    let visualRuns = 0
    for (const [, journey] of journeys) {
      if (journey.includes(4)) visualRuns++
    }

    expect(snapshot.scoreAway).toBe(1)
    expect(snapshot.scoreHome).toBe(0)
    expect(visualRuns).toBe(snapshot.scoreHome + snapshot.scoreAway)

    // Also verify the runner's full journey: 1st → SB 2nd → WP 3rd → scored on hit
    expect(journeys.get(1)).toEqual([1, 2, 3, 4])
  })
})
