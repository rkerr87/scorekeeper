import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlayDetailPopover } from '../PlayDetailPopover'

describe('PlayDetailPopover', () => {
  const play = {
    id: 1,
    playType: '1B' as const,
    notation: '1B',
    basesReached: [1],
    pitches: ['B', 'S', 'F', 'B'] as ('B' | 'S' | 'F')[],
    runsScoredOnPlay: 0,
  }

  it('shows play notation and pitch summary', () => {
    render(<PlayDetailPopover play={play} onUndo={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('1B')).toBeInTheDocument()
    expect(screen.getByText(/2-2/)).toBeInTheDocument()
    expect(screen.getByText(/4 pitches/)).toBeInTheDocument()
  })

  it('does not show Edit button', () => {
    render(<PlayDetailPopover play={play} onUndo={vi.fn()} onClose={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
  })

  it('calls onUndo directly when no subsequent plays', async () => {
    const onUndo = vi.fn()
    const user = userEvent.setup()
    render(<PlayDetailPopover play={play} playsAfterCount={0} onUndo={onUndo} onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /undo/i }))
    expect(onUndo).toHaveBeenCalledWith(1)
  })

  it('shows confirmation before undo when subsequent plays exist', async () => {
    const onUndo = vi.fn()
    const user = userEvent.setup()
    render(<PlayDetailPopover play={play} playsAfterCount={3} onUndo={onUndo} onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /undo/i }))
    // Should show confirmation, not call onUndo yet
    expect(onUndo).not.toHaveBeenCalled()
    expect(screen.getByText(/will also remove 3 subsequent plays/i)).toBeInTheDocument()
    // Confirm
    await user.click(screen.getByRole('button', { name: /confirm/i }))
    expect(onUndo).toHaveBeenCalledWith(1)
  })

  it('can cancel undo confirmation', async () => {
    const onUndo = vi.fn()
    const user = userEvent.setup()
    render(<PlayDetailPopover play={play} playsAfterCount={2} onUndo={onUndo} onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /undo/i }))
    expect(screen.getByText(/will also remove 2 subsequent plays/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onUndo).not.toHaveBeenCalled()
    // Should be back to Undo button (no Edit button)
    expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
  })

  it('calls onClose when backdrop clicked', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    const { container } = render(<PlayDetailPopover play={play} onUndo={vi.fn()} onClose={onClose} />)
    // Click the backdrop (outermost div)
    const backdrop = container.firstElementChild as HTMLElement
    await user.click(backdrop)
    expect(onClose).toHaveBeenCalled()
  })
})
