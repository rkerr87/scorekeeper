import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Scoresheet } from '../Scoresheet'
import type { LineupSlot, Play } from '../../engine/types'

const mockLineup: LineupSlot[] = [
  { orderPosition: 1, playerId: 1, playerName: 'Alice', jerseyNumber: 1, position: 'P', substitutions: [] },
  { orderPosition: 2, playerId: 2, playerName: 'Bob', jerseyNumber: 2, position: 'C', substitutions: [] },
  { orderPosition: 3, playerId: 3, playerName: 'Charlie', jerseyNumber: 3, position: '1B', substitutions: [] },
]

describe('Scoresheet', () => {
  it('should render player names in batting order', () => {
    render(
      <Scoresheet
        lineup={mockLineup}
        plays={[]}
        currentInning={1}
        currentBatterPosition={1}
        maxInnings={6}
        onCellClick={() => {}}
      />
    )
    expect(screen.getByText('1 Alice')).toBeInTheDocument()
    expect(screen.getByText('2 Bob')).toBeInTheDocument()
    expect(screen.getByText('3 Charlie')).toBeInTheDocument()
  })

  it('should render inning column headers', () => {
    render(
      <Scoresheet
        lineup={mockLineup}
        plays={[]}
        currentInning={3}
        currentBatterPosition={1}
        maxInnings={6}
        onCellClick={() => {}}
      />
    )
    for (let i = 1; i <= 6; i++) {
      expect(screen.getByText(i.toString())).toBeInTheDocument()
    }
  })

  it('should render summary stat headers', () => {
    render(
      <Scoresheet
        lineup={mockLineup}
        plays={[]}
        currentInning={1}
        currentBatterPosition={1}
        maxInnings={6}
        onCellClick={() => {}}
      />
    )
    expect(screen.getByText('AB')).toBeInTheDocument()
    expect(screen.getByText('R')).toBeInTheDocument()
    expect(screen.getByText('H')).toBeInTheDocument()
  })

  it('should populate cells with play data', () => {
    const plays: Play[] = [{
      id: 1, gameId: 1, sequenceNumber: 1, inning: 1, half: 'top',
      batterOrderPosition: 1, playType: 'K', notation: 'K',
      fieldersInvolved: [], basesReached: [], runsScoredOnPlay: 0,
      rbis: 0, pitches: ['S', 'S', 'S'], isAtBat: true, timestamp: new Date(),
    }]
    const { container } = render(
      <Scoresheet
        lineup={mockLineup}
        plays={plays}
        currentInning={1}
        currentBatterPosition={2}
        maxInnings={6}
        onCellClick={() => {}}
      />
    )
    expect(container.textContent).toContain('K')
  })

  it('shows K in first column and BB in wrap column when batter bats twice in same inning', () => {
    const smallLineup: LineupSlot[] = [
      { orderPosition: 1, playerId: 1, playerName: 'Alice', jerseyNumber: 1, position: 'P', substitutions: [] },
      { orderPosition: 2, playerId: 2, playerName: 'Bob', jerseyNumber: 2, position: 'C', substitutions: [] },
    ]
    const plays: Play[] = [
      {
        id: 1, gameId: 1, sequenceNumber: 1, inning: 1, half: 'top',
        batterOrderPosition: 1, playType: 'K', notation: 'K',
        fieldersInvolved: [], basesReached: [], runsScoredOnPlay: 0,
        rbis: 0, pitches: [], isAtBat: true, timestamp: new Date(),
      },
      {
        id: 2, gameId: 1, sequenceNumber: 2, inning: 1, half: 'top',
        batterOrderPosition: 2, playType: 'GO', notation: '6-3',
        fieldersInvolved: [6, 3], basesReached: [], runsScoredOnPlay: 0,
        rbis: 0, pitches: [], isAtBat: true, timestamp: new Date(),
      },
      {
        id: 3, gameId: 1, sequenceNumber: 10, inning: 1, half: 'top',
        batterOrderPosition: 1, playType: 'BB', notation: 'BB',
        fieldersInvolved: [], basesReached: [1], runsScoredOnPlay: 0,
        rbis: 0, pitches: [], isAtBat: true, timestamp: new Date(),
      },
    ]
    const { container } = render(
      <Scoresheet
        lineup={smallLineup}
        plays={plays}
        currentInning={2}
        currentBatterPosition={1}
        maxInnings={6}
        onCellClick={() => {}}
      />
    )
    // Pass 1 column shows K for Alice
    const cells = container.querySelectorAll('[data-testid="atbat-cell"]')
    expect(cells[0].textContent).toContain('K')
    // "1b" column header should exist
    expect(screen.getByText('1b')).toBeInTheDocument()
  })

  it('shows "1b" column and active cell when lineup bats around before any pass-2 play is recorded', () => {
    const plays: Play[] = mockLineup.map((slot, i) => ({
      id: i + 1, gameId: 1, sequenceNumber: i + 1, inning: 1, half: 'top' as const,
      batterOrderPosition: slot.orderPosition, playType: '1B' as const, notation: '1B',
      fieldersInvolved: [7], basesReached: [1], runsScoredOnPlay: 0,
      rbis: 0, pitches: [], isAtBat: true, timestamp: new Date(),
    }))
    const { container } = render(
      <Scoresheet
        lineup={mockLineup}
        plays={plays}
        currentInning={1}
        currentBatterPosition={1}
        maxInnings={6}
        onCellClick={() => {}}
      />
    )
    // "1b" column should appear for the upcoming pass-2 at-bat
    expect(screen.getByText('1b')).toBeInTheDocument()
    // The active cell (current batter highlight) should exist
    const activeCells = container.querySelectorAll('[data-testid="atbat-cell"]')
    const activeCell = Array.from(activeCells).find(cell =>
      cell.className.includes('bg-amber-50') || cell.className.includes('ring-amber')
    )
    expect(activeCell).toBeDefined()
  })

  it('shows both at-bats in separate columns when batter wraps in same inning', () => {
    const smallLineup: LineupSlot[] = [
      { orderPosition: 1, playerId: 1, playerName: 'Alice', jerseyNumber: 1, position: 'P', substitutions: [] },
      { orderPosition: 2, playerId: 2, playerName: 'Bob', jerseyNumber: 2, position: 'C', substitutions: [] },
    ]
    const plays: Play[] = [
      {
        id: 1, gameId: 1, sequenceNumber: 1, inning: 1, half: 'top',
        batterOrderPosition: 1, playType: 'K', notation: 'K',
        fieldersInvolved: [], basesReached: [], runsScoredOnPlay: 0,
        rbis: 0, pitches: [], isAtBat: true, timestamp: new Date(),
      },
      {
        id: 2, gameId: 1, sequenceNumber: 2, inning: 1, half: 'top',
        batterOrderPosition: 2, playType: 'BB', notation: 'BB',
        fieldersInvolved: [], basesReached: [1], runsScoredOnPlay: 0,
        rbis: 0, pitches: [], isAtBat: true, timestamp: new Date(),
      },
      {
        id: 3, gameId: 1, sequenceNumber: 10, inning: 1, half: 'top',
        batterOrderPosition: 1, playType: 'BB', notation: 'BB',
        fieldersInvolved: [], basesReached: [1], runsScoredOnPlay: 0,
        rbis: 0, pitches: [], isAtBat: true, timestamp: new Date(),
      },
    ]
    render(
      <Scoresheet
        lineup={smallLineup}
        plays={plays}
        currentInning={2}
        currentBatterPosition={1}
        maxInnings={6}
        onCellClick={() => {}}
      />
    )
    expect(screen.getByText('1b')).toBeInTheDocument()
  })
})
