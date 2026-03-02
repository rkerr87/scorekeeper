import { describe, it, expect } from 'vitest'
import { computeRunnerJourneys } from '../journeys'
import type { Play, Lineup, LineupSlot } from '../types'

function makeSlot(pos: number, side: string): LineupSlot {
  return {
    orderPosition: pos,
    playerId: pos,
    playerName: `${side}Player${pos}`,
    jerseyNumber: pos * 10,
    position: ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'][pos - 1] ?? 'DH',
    substitutions: [],
  }
}

function makeLineup(side: 'home' | 'away'): Lineup {
  return {
    gameId: 1,
    side,
    battingOrder: Array.from({ length: 9 }, (_, i) => makeSlot(i + 1, side)),
  }
}

function makePlay(overrides: Partial<Play> & { sequenceNumber: number }): Play {
  return {
    id: overrides.sequenceNumber,
    gameId: 1,
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

describe('computeRunnerJourneys', () => {
  const lineupHome = makeLineup('home')
  const lineupAway = makeLineup('away')

  it('returns batter bases when no subsequent advancement', () => {
    const plays = [
      makePlay({ sequenceNumber: 1, batterOrderPosition: 1, playType: '1B', basesReached: [1], notation: '1B' }),
    ]
    const journeys = computeRunnerJourneys(plays, lineupHome, lineupAway)
    expect(journeys.get(1)).toEqual([1])
  })

  it('extends journey when runner advances on subsequent play', () => {
    const plays = [
      makePlay({ sequenceNumber: 1, batterOrderPosition: 1, playType: '1B', basesReached: [1], notation: '1B' }),
      makePlay({ sequenceNumber: 2, batterOrderPosition: 2, playType: '1B', basesReached: [1], notation: '1B' }),
    ]
    // Player 1 singles, then Player 2 singles -> Player 1 advances to 2nd
    const journeys = computeRunnerJourneys(plays, lineupHome, lineupAway)
    expect(journeys.get(1)).toEqual([1, 2])
    expect(journeys.get(2)).toEqual([1])
  })

  it('tracks runner all the way home when they score', () => {
    const plays = [
      makePlay({ sequenceNumber: 1, batterOrderPosition: 1, playType: '1B', basesReached: [1], notation: '1B' }),
      makePlay({ sequenceNumber: 2, batterOrderPosition: 2, playType: '1B', basesReached: [1], notation: '1B' }),
      // Player 1 now on 2nd. HR by Player 3 scores everyone
      makePlay({ sequenceNumber: 3, batterOrderPosition: 3, playType: 'HR', basesReached: [1, 2, 3, 4], notation: 'HR' }),
    ]
    const journeys = computeRunnerJourneys(plays, lineupHome, lineupAway)
    expect(journeys.get(1)).toEqual([1, 2, 3, 4]) // scored
    expect(journeys.get(2)).toEqual([1, 2, 3, 4]) // scored
    expect(journeys.get(3)).toEqual([1, 2, 3, 4]) // HR batter also scores
  })

  it('returns empty array for strikeouts', () => {
    const plays = [
      makePlay({ sequenceNumber: 1, batterOrderPosition: 1, playType: 'K', basesReached: [], notation: 'K' }),
    ]
    const journeys = computeRunnerJourneys(plays, lineupHome, lineupAway)
    expect(journeys.get(1)).toEqual([])
  })

  it('handles non-at-bat plays (SB) extending a runner journey', () => {
    const plays = [
      makePlay({ sequenceNumber: 1, batterOrderPosition: 1, playType: '1B', basesReached: [1], notation: '1B' }),
      makePlay({ sequenceNumber: 2, batterOrderPosition: 2, playType: 'SB', basesReached: [], notation: 'SB', isAtBat: false }),
    ]
    const journeys = computeRunnerJourneys(plays, lineupHome, lineupAway)
    // Player 1 singled to 1st, then SB advances them to 2nd
    expect(journeys.get(1)).toEqual([1, 2])
    // SB is non-at-bat, has no journey of its own in terms of batter reaching base
    expect(journeys.get(2)).toEqual([])
  })

  it('handles WP advancing a runner', () => {
    const plays = [
      makePlay({ sequenceNumber: 1, batterOrderPosition: 1, playType: '2B', basesReached: [1, 2], notation: '2B' }),
      makePlay({ sequenceNumber: 2, batterOrderPosition: 2, playType: 'WP', basesReached: [], notation: 'WP', isAtBat: false }),
    ]
    const journeys = computeRunnerJourneys(plays, lineupHome, lineupAway)
    // Player 1 doubled to 2nd, then WP advances them to 3rd
    expect(journeys.get(1)).toEqual([1, 2, 3])
  })

  it('clears runners on half-inning transition (3 outs)', () => {
    const plays = [
      // Top of 1st: Player 1 singles, then 3 outs end the inning
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: '1B', basesReached: [1], notation: '1B' }),
      makePlay({ sequenceNumber: 2, half: 'top', batterOrderPosition: 2, playType: 'GO', basesReached: [], notation: 'GO' }),
      makePlay({ sequenceNumber: 3, half: 'top', batterOrderPosition: 3, playType: 'GO', basesReached: [], notation: 'GO' }),
      makePlay({ sequenceNumber: 4, half: 'top', batterOrderPosition: 4, playType: 'GO', basesReached: [], notation: 'GO' }),
      // Bottom of 1st: opponent plays
      makePlay({ sequenceNumber: 5, half: 'bottom', batterOrderPosition: 1, playType: '1B', basesReached: [1], notation: '1B' }),
    ]
    const journeys = computeRunnerJourneys(plays, lineupHome, lineupAway)
    // Player 1 (top) was stranded on 1st when 3 outs occurred
    // Journey should NOT extend beyond 1st — they didn't score
    expect(journeys.get(1)).toEqual([1])
    // Bottom-half play should also have a journey
    expect(journeys.get(5)).toEqual([1])
  })

  it('tracks runners per-half independently', () => {
    const plays = [
      // Top of 1st: away team batting
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: '1B', basesReached: [1], notation: '1B' }),
      makePlay({ sequenceNumber: 2, half: 'top', batterOrderPosition: 2, playType: 'K', basesReached: [], notation: 'K' }),
      makePlay({ sequenceNumber: 3, half: 'top', batterOrderPosition: 3, playType: 'K', basesReached: [], notation: 'K' }),
      makePlay({ sequenceNumber: 4, half: 'top', batterOrderPosition: 4, playType: 'K', basesReached: [], notation: 'K' }),
      // Bottom of 1st: home team batting — same orderPosition 1 but different half
      makePlay({ sequenceNumber: 5, half: 'bottom', batterOrderPosition: 1, playType: '2B', basesReached: [1, 2], notation: '2B' }),
    ]
    const journeys = computeRunnerJourneys(plays, lineupHome, lineupAway)
    // Top Player 1: stranded on 1st
    expect(journeys.get(1)).toEqual([1])
    // Bottom Player 1: reached 2nd
    expect(journeys.get(5)).toEqual([1, 2])
  })

  it('handles double (batter reaches 2nd)', () => {
    const plays = [
      makePlay({ sequenceNumber: 1, batterOrderPosition: 1, playType: '2B', basesReached: [1, 2], notation: '2B' }),
    ]
    const journeys = computeRunnerJourneys(plays, lineupHome, lineupAway)
    expect(journeys.get(1)).toEqual([1, 2])
  })

  it('handles triple (batter reaches 3rd)', () => {
    const plays = [
      makePlay({ sequenceNumber: 1, batterOrderPosition: 1, playType: '3B', basesReached: [1, 2, 3], notation: '3B' }),
    ]
    const journeys = computeRunnerJourneys(plays, lineupHome, lineupAway)
    expect(journeys.get(1)).toEqual([1, 2, 3])
  })

  it('handles home run (batter scores)', () => {
    const plays = [
      makePlay({ sequenceNumber: 1, batterOrderPosition: 1, playType: 'HR', basesReached: [1, 2, 3, 4], notation: 'HR' }),
    ]
    const journeys = computeRunnerJourneys(plays, lineupHome, lineupAway)
    expect(journeys.get(1)).toEqual([1, 2, 3, 4])
  })

  it('handles walk (BB) — batter reaches 1st', () => {
    const plays = [
      makePlay({ sequenceNumber: 1, batterOrderPosition: 1, playType: 'BB', basesReached: [1], notation: 'BB' }),
    ]
    const journeys = computeRunnerJourneys(plays, lineupHome, lineupAway)
    expect(journeys.get(1)).toEqual([1])
  })

  it('skips plays without IDs', () => {
    const plays: Play[] = [
      {
        gameId: 1,
        sequenceNumber: 1,
        inning: 1,
        half: 'top',
        batterOrderPosition: 1,
        playType: '1B',
        notation: '1B',
        fieldersInvolved: [],
        basesReached: [1],
        runsScoredOnPlay: 0,
        rbis: 0,
        pitches: [],
        isAtBat: true,
        timestamp: new Date(),
        // id is undefined
      },
    ]
    const journeys = computeRunnerJourneys(plays, lineupHome, lineupAway)
    // Should not have any entries since play has no id
    expect(journeys.size).toBe(0)
  })

  it('handles ground out with no base journey', () => {
    const plays = [
      makePlay({ sequenceNumber: 1, batterOrderPosition: 1, playType: 'GO', basesReached: [], notation: '6-3' }),
    ]
    const journeys = computeRunnerJourneys(plays, lineupHome, lineupAway)
    expect(journeys.get(1)).toEqual([])
  })

  it('handles runner advancing across multiple plays', () => {
    // Single -> SB to 2nd -> WP to 3rd -> scored on another hit
    const plays = [
      makePlay({ sequenceNumber: 1, batterOrderPosition: 1, playType: '1B', basesReached: [1], notation: '1B' }),
      makePlay({ sequenceNumber: 2, batterOrderPosition: 2, playType: 'SB', basesReached: [], notation: 'SB', isAtBat: false }),
      makePlay({ sequenceNumber: 3, batterOrderPosition: 2, playType: 'WP', basesReached: [], notation: 'WP', isAtBat: false }),
      makePlay({ sequenceNumber: 4, batterOrderPosition: 2, playType: '1B', basesReached: [1], notation: '1B' }),
    ]
    const journeys = computeRunnerJourneys(plays, lineupHome, lineupAway)
    // Player 1: 1st -> SB 2nd -> WP 3rd -> scored on Player 2's hit
    expect(journeys.get(1)).toEqual([1, 2, 3, 4])
    // Player 2: reached 1st on single
    expect(journeys.get(4)).toEqual([1])
  })

  it('handles home team batting in bottom half', () => {
    const plays = [
      // Top: away bats — 3 quick outs
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: 'K', basesReached: [], notation: 'K' }),
      makePlay({ sequenceNumber: 2, half: 'top', batterOrderPosition: 2, playType: 'K', basesReached: [], notation: 'K' }),
      makePlay({ sequenceNumber: 3, half: 'top', batterOrderPosition: 3, playType: 'K', basesReached: [], notation: 'K' }),
      // Bottom: home bats
      makePlay({ sequenceNumber: 4, half: 'bottom', batterOrderPosition: 1, playType: '1B', basesReached: [1], notation: '1B' }),
      makePlay({ sequenceNumber: 5, half: 'bottom', batterOrderPosition: 2, playType: '2B', basesReached: [1, 2], notation: '2B' }),
    ]
    const journeys = computeRunnerJourneys(plays, lineupHome, lineupAway)
    // Player 1 (home, bottom): singled to 1st, then advanced through 2nd to 3rd on Player 2's double
    expect(journeys.get(4)).toEqual([1, 2, 3])
    // Player 2 (home, bottom): doubled to 2nd
    expect(journeys.get(5)).toEqual([1, 2])
  })

  it('handles FC — runner out, batter reaches 1st', () => {
    const plays = [
      makePlay({ sequenceNumber: 1, batterOrderPosition: 1, playType: '1B', basesReached: [1], notation: '1B' }),
      makePlay({ sequenceNumber: 2, batterOrderPosition: 2, playType: 'FC', basesReached: [1], notation: 'FC' }),
    ]
    const journeys = computeRunnerJourneys(plays, lineupHome, lineupAway)
    // Player 1 was on 1st, got out on FC — journey stays at [1]
    expect(journeys.get(1)).toEqual([1])
    // Player 2 reaches 1st via FC
    expect(journeys.get(2)).toEqual([1])
  })

  it('includes intermediate bases when runner advances 2+ bases in one play', () => {
    // Runner on 1st, next batter doubles → runner goes from 1st to 3rd
    // Journey should include 2nd base as intermediate so Diamond draws
    // the line along the base paths (1st → 2nd → 3rd), not a straight line
    const plays = [
      makePlay({ sequenceNumber: 1, batterOrderPosition: 1, playType: '1B', basesReached: [1], notation: '1B' }),
      makePlay({ sequenceNumber: 2, batterOrderPosition: 2, playType: '2B', basesReached: [1, 2], notation: '2B' }),
    ]
    const journeys = computeRunnerJourneys(plays, lineupHome, lineupAway)
    // Player 1: singled to 1st, then advanced through 2nd to 3rd
    expect(journeys.get(1)).toEqual([1, 2, 3])
    // Player 2: doubled
    expect(journeys.get(2)).toEqual([1, 2])
  })

  it('includes intermediate bases when runner scores from 1st', () => {
    // Runner on 1st, next batter hits HR → runner goes from 1st through 2nd, 3rd, home
    const plays = [
      makePlay({ sequenceNumber: 1, batterOrderPosition: 1, playType: '1B', basesReached: [1], notation: '1B' }),
      makePlay({ sequenceNumber: 2, batterOrderPosition: 2, playType: 'HR', basesReached: [1, 2, 3, 4], notation: 'HR', runsScoredOnPlay: 2 }),
    ]
    const journeys = computeRunnerJourneys(plays, lineupHome, lineupAway)
    // Player 1: singled to 1st, scored via 2nd, 3rd, home
    expect(journeys.get(1)).toEqual([1, 2, 3, 4])
  })

  it('handles runner overrides from scorekeeper', () => {
    const plays = [
      makePlay({ sequenceNumber: 1, batterOrderPosition: 1, playType: '1B', basesReached: [1], notation: '1B' }),
      makePlay({
        sequenceNumber: 2,
        batterOrderPosition: 2,
        playType: '1B',
        basesReached: [1],
        notation: '1B',
        runnerOverrides: {
          first: { playerName: 'awayPlayer2', orderPosition: 2 },
          second: null,
          third: { playerName: 'awayPlayer1', orderPosition: 1 },
        },
        runsScoredOnPlay: 0,
      }),
    ]
    const journeys = computeRunnerJourneys(plays, lineupHome, lineupAway)
    // Player 1 overridden to 3rd — journey includes intermediate base 2 for Diamond path rendering
    expect(journeys.get(1)).toEqual([1, 2, 3])
    // Player 2 reaches 1st
    expect(journeys.get(2)).toEqual([1])
  })
})
