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
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('Charlie')).toBeInTheDocument()
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
})
