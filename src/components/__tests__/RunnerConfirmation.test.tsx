import { describe, it, expect } from 'vitest'
import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RunnerConfirmation } from '../RunnerConfirmation'
import type { BaseRunners } from '../../engine/types'

describe('RunnerConfirmation', () => {
  it('should display current base runners', () => {
    const runners: BaseRunners = {
      first: { playerName: 'Alice', orderPosition: 1 },
      second: null,
      third: { playerName: 'Bob', orderPosition: 2 },
    }
    render(<RunnerConfirmation runners={runners} onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.getByText(/alice/i)).toBeInTheDocument()
    expect(screen.getByText(/bob/i)).toBeInTheDocument()
  })

  it('should show confirm and cancel buttons', () => {
    const runners: BaseRunners = { first: null, second: null, third: null }
    render(<RunnerConfirmation runners={runners} onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('should call onConfirm with runners when confirmed', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const runners: BaseRunners = {
      first: { playerName: 'Alice', orderPosition: 1 },
      second: null,
      third: null,
    }
    render(<RunnerConfirmation runners={runners} onConfirm={onConfirm} onCancel={() => {}} />)

    await user.click(screen.getByRole('button', { name: /confirm/i }))
    expect(onConfirm).toHaveBeenCalledWith(runners)
  })

  it('should call onConfirm with modified runners after clearing a base', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const runners: BaseRunners = {
      first: { playerName: 'Alice', orderPosition: 1 },
      second: null,
      third: { playerName: 'Bob', orderPosition: 2 },
    }
    render(<RunnerConfirmation runners={runners} onConfirm={onConfirm} onCancel={() => {}} />)

    // Clear first base
    const clearButtons = screen.getAllByRole('button', { name: /clear/i })
    await user.click(clearButtons[clearButtons.length - 1]) // first base clear is last in DOM (3rd, 2nd, 1st order)

    await user.click(screen.getByRole('button', { name: /confirm/i }))
    expect(onConfirm).toHaveBeenCalledWith({
      first: null,
      second: null,
      third: { playerName: 'Bob', orderPosition: 2 },
    })
  })
})
