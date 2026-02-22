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
    const snapshot = replayGame([], lineupUs, lineupThem)
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
    const snapshot = replayGame(plays, lineupUs, lineupThem)
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
    const snapshot = replayGame(plays, lineupUs, lineupThem)
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
    const snapshot = replayGame(plays, lineupUs, lineupThem)
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
    const snapshot = replayGame(plays, lineupUs, lineupThem)
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
    const snapshot = replayGame(plays, lineupUs, lineupThem)
    expect(snapshot.inning).toBe(2)
    expect(snapshot.half).toBe('top')
    expect(snapshot.outs).toBe(0)
  })

  it('should count double play as 2 outs', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: 'DP', fieldersInvolved: [6, 4, 3] }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem)
    expect(snapshot.outs).toBe(2)
  })
})

describe('replayGame — baserunners', () => {
  it('should put batter on first after a single', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: '1B', basesReached: [1] }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem)
    expect(snapshot.baseRunners.first?.orderPosition).toBe(1)
    expect(snapshot.baseRunners.second).toBeNull()
    expect(snapshot.baseRunners.third).toBeNull()
  })

  it('should advance runner from 1st to 2nd on next single', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: '1B', basesReached: [1] }),
      makePlay({ sequenceNumber: 2, half: 'top', batterOrderPosition: 2, playType: '1B', basesReached: [1] }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem)
    expect(snapshot.baseRunners.first?.orderPosition).toBe(2)
    expect(snapshot.baseRunners.second?.orderPosition).toBe(1)
  })

  it('should score runner from 3rd on a single', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: '3B', basesReached: [1, 2, 3] }),
      makePlay({ sequenceNumber: 2, half: 'top', batterOrderPosition: 2, playType: '1B', basesReached: [1] }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem)
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
    const snapshot = replayGame(plays, lineupUs, lineupThem)
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
    const snapshot = replayGame(plays, lineupUs, lineupThem)
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
    const snapshot = replayGame(plays, lineupUs, lineupThem)
    expect(snapshot.half).toBe('bottom')
    expect(snapshot.baseRunners.first).toBeNull()
  })

  it('should advance runner on stolen base without advancing batter', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: '1B', basesReached: [1] }),
      makePlay({ sequenceNumber: 2, half: 'top', batterOrderPosition: 2, playType: 'SB', isAtBat: false }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem)
    expect(snapshot.baseRunners.first).toBeNull()
    expect(snapshot.baseRunners.second?.orderPosition).toBe(1)
    expect(snapshot.currentBatterUs).toBe(2)
  })

  it('should advance all runners on wild pitch', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: '2B', basesReached: [1, 2] }),
      makePlay({ sequenceNumber: 2, half: 'top', batterOrderPosition: 2, playType: 'WP', isAtBat: false }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem)
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
    const snapshot = replayGame(plays, lineupUs, lineupThem)
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
    const snapshot = replayGame(plays, lineupUs, lineupThem)
    expect(snapshot.runsPerInningThem[0]).toBe(1)
    expect(snapshot.scoreThem).toBe(1)
  })

  it('should handle multi-run innings', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, inning: 1, half: 'top', batterOrderPosition: 1, playType: '1B', basesReached: [1] }),
      makePlay({ sequenceNumber: 2, inning: 1, half: 'top', batterOrderPosition: 2, playType: '1B', basesReached: [1] }),
      makePlay({ sequenceNumber: 3, inning: 1, half: 'top', batterOrderPosition: 3, playType: 'HR', basesReached: [1, 2, 3, 4] }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem)
    expect(snapshot.scoreUs).toBe(3)
    expect(snapshot.runsPerInningUs[0]).toBe(3)
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
    const snapshot = replayGame(plays, lineupUs, lineupThem)
    expect(snapshot.pitchCountByPitcher.get('them-Player1')).toBe(9)
  })

  it('should track pitch counts separately per half-inning pitcher', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, inning: 1, half: 'top', batterOrderPosition: 1, playType: 'K', pitches: ['S', 'S', 'S'] }),
      makePlay({ sequenceNumber: 2, inning: 1, half: 'top', batterOrderPosition: 2, playType: 'K', pitches: ['S', 'S', 'S'] }),
      makePlay({ sequenceNumber: 3, inning: 1, half: 'top', batterOrderPosition: 3, playType: 'K', pitches: ['S', 'S', 'S'] }),
      makePlay({ sequenceNumber: 4, inning: 1, half: 'bottom', batterOrderPosition: 1, playType: 'K', pitches: ['S', 'B', 'S', 'S'] }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem)
    expect(snapshot.pitchCountByPitcher.get('them-Player1')).toBe(9)
    expect(snapshot.pitchCountByPitcher.get('us-Player1')).toBe(4)
  })
})
