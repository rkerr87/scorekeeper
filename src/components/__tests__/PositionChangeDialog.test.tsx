import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PositionChangeDialog } from '../PositionChangeDialog'

const lineup = [
  { orderPosition: 1, playerId: 1, playerName: 'Smith', jerseyNumber: 12, position: 'P', substitutions: [] },
  { orderPosition: 2, playerId: 2, playerName: 'Jones', jerseyNumber: 7, position: 'SS', substitutions: [] },
  { orderPosition: 3, playerId: 3, playerName: 'Brown', jerseyNumber: 22, position: 'CF', substitutions: [] },
]

describe('PositionChangeDialog', () => {
  it('shows player list with names and positions', () => {
    render(<PositionChangeDialog lineup={lineup} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('Smith')).toBeInTheDocument()
    expect(screen.getByText('Jones')).toBeInTheDocument()
    expect(screen.getByText('Brown')).toBeInTheDocument()
    expect(screen.getByText('P')).toBeInTheDocument()
    expect(screen.getByText('SS')).toBeInTheDocument()
    expect(screen.getByText('CF')).toBeInTheDocument()
  })

  it('shows field diagram after selecting a player', async () => {
    const user = userEvent.setup()
    render(<PositionChangeDialog lineup={lineup} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    await user.click(screen.getByText('Smith'))
    // Field diagram should show with SS position button
    expect(screen.getByRole('button', { name: /6 SS/i })).toBeInTheDocument()
  })

  it('shows swap confirmation when target position is occupied', async () => {
    const user = userEvent.setup()
    render(<PositionChangeDialog lineup={lineup} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    await user.click(screen.getByText('Smith'))
    // Click SS (position 6) — occupied by Jones
    await user.click(screen.getByRole('button', { name: /6 SS/i }))
    // Should show swap confirmation with both players
    expect(screen.getByText(/Smith/)).toBeInTheDocument()
    expect(screen.getByText(/P → SS/)).toBeInTheDocument()
    expect(screen.getByText(/Jones/)).toBeInTheDocument()
    expect(screen.getByText(/SS → P/)).toBeInTheDocument()
  })

  it('calls onConfirm with both position changes on swap', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<PositionChangeDialog lineup={lineup} onConfirm={onConfirm} onCancel={vi.fn()} />)
    await user.click(screen.getByText('Smith'))
    await user.click(screen.getByRole('button', { name: /6 SS/i }))
    await user.click(screen.getByRole('button', { name: /confirm/i }))
    expect(onConfirm).toHaveBeenCalledWith([
      { orderPosition: 1, newPosition: 'SS' },
      { orderPosition: 2, newPosition: 'P' },
    ])
  })

  it('calls onConfirm directly for unoccupied position (no swap needed)', async () => {
    // Use a lineup where position 7 (LF) is empty
    const smallLineup = [
      { orderPosition: 1, playerId: 1, playerName: 'Smith', jerseyNumber: 12, position: 'P', substitutions: [] },
    ]
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<PositionChangeDialog lineup={smallLineup} onConfirm={onConfirm} onCancel={vi.fn()} />)
    await user.click(screen.getByText('Smith'))
    await user.click(screen.getByRole('button', { name: /7 LF/i }))
    expect(onConfirm).toHaveBeenCalledWith([
      { orderPosition: 1, newPosition: 'LF' },
    ])
  })

  it('calls onCancel when Cancel is clicked', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(<PositionChangeDialog lineup={lineup} onConfirm={vi.fn()} onCancel={onCancel} />)
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalled()
  })
})
