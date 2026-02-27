import { describe, it, expect } from 'vitest'
import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RunnerConfirmation } from '../RunnerConfirmation'
import type { BaseRunners } from '../../engine/types'

describe('RunnerConfirmation', () => {
  const runners: BaseRunners = {
    first: { playerName: 'Alice', orderPosition: 1 },
    second: null,
    third: { playerName: 'Bob', orderPosition: 2 },
  }

  it('should display an instructional title and subtitle', () => {
    render(<RunnerConfirmation runners={runners} onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.getByText(/where did they end up/i)).toBeInTheDocument()
    expect(screen.getByText(/best guess/i)).toBeInTheDocument()
  })

  it('should display current base runners with their names', () => {
    render(<RunnerConfirmation runners={runners} onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.getByText(/alice/i)).toBeInTheDocument()
    expect(screen.getByText(/bob/i)).toBeInTheDocument()
  })

  it('should show confirm and cancel buttons', () => {
    render(<RunnerConfirmation runners={runners} onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('should call onConfirm with unchanged runners and 0 runs when confirmed without changes', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<RunnerConfirmation runners={runners} onConfirm={onConfirm} onCancel={() => {}} />)
    await user.click(screen.getByRole('button', { name: /confirm/i }))
    expect(onConfirm).toHaveBeenCalledWith({
      runners: {
        first: { playerName: 'Alice', orderPosition: 1 },
        second: null,
        third: { playerName: 'Bob', orderPosition: 2 },
      },
      runsScored: 0,
    })
  })

  it('should count a run when a runner is set to Scored', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const singleRunner: BaseRunners = {
      first: null,
      second: null,
      third: { playerName: 'Bob', orderPosition: 2 },
    }
    render(<RunnerConfirmation runners={singleRunner} onConfirm={onConfirm} onCancel={() => {}} />)
    // Click the "Scored" destination button
    const scoredButtons = screen.getAllByRole('button', { name: /^scored$/i })
    await user.click(scoredButtons[0])
    await user.click(screen.getByRole('button', { name: /confirm/i }))
    expect(onConfirm).toHaveBeenCalledWith({
      runners: { first: null, second: null, third: null },
      runsScored: 1,
    })
  })

  it('should allow moving a runner to a different base', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const singleRunner: BaseRunners = {
      first: { playerName: 'Alice', orderPosition: 1 },
      second: null,
      third: null,
    }
    render(<RunnerConfirmation runners={singleRunner} onConfirm={onConfirm} onCancel={() => {}} />)
    // Move runner from 1st to 3rd
    const thirdButtons = screen.getAllByRole('button', { name: /^3rd$/i })
    await user.click(thirdButtons[0])
    await user.click(screen.getByRole('button', { name: /confirm/i }))
    expect(onConfirm).toHaveBeenCalledWith({
      runners: { first: null, second: null, third: { playerName: 'Alice', orderPosition: 1 } },
      runsScored: 0,
    })
  })

  it('should remove a runner marked as Out with no run scored', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const singleRunner: BaseRunners = {
      first: { playerName: 'Alice', orderPosition: 1 },
      second: null,
      third: null,
    }
    render(<RunnerConfirmation runners={singleRunner} onConfirm={onConfirm} onCancel={() => {}} />)
    const outButtons = screen.getAllByRole('button', { name: /^out$/i })
    await user.click(outButtons[0])
    await user.click(screen.getByRole('button', { name: /confirm/i }))
    expect(onConfirm).toHaveBeenCalledWith({
      runners: { first: null, second: null, third: null },
      runsScored: 0,
    })
  })

  describe('backward movement prevention', () => {
    it('should disable 1st base button for runner on 2nd', () => {
      const runnersOn2nd: BaseRunners = {
        first: null,
        second: { playerName: 'Carol', orderPosition: 3 },
        third: null,
      }
      render(<RunnerConfirmation runners={runnersOn2nd} onConfirm={() => {}} onCancel={() => {}} />)
      const firstButtons = screen.getAllByRole('button', { name: /^1st$/i })
      expect(firstButtons[0]).toBeDisabled()
    })

    it('should disable 1st and 2nd base buttons for runner on 3rd', () => {
      const runnersOn3rd: BaseRunners = {
        first: null,
        second: null,
        third: { playerName: 'Bob', orderPosition: 2 },
      }
      render(<RunnerConfirmation runners={runnersOn3rd} onConfirm={() => {}} onCancel={() => {}} />)
      const firstButtons = screen.getAllByRole('button', { name: /^1st$/i })
      const secondButtons = screen.getAllByRole('button', { name: /^2nd$/i })
      expect(firstButtons[0]).toBeDisabled()
      expect(secondButtons[0]).toBeDisabled()
    })

    it('should enable all forward destinations for runner on 1st', () => {
      const runnersOn1st: BaseRunners = {
        first: { playerName: 'Alice', orderPosition: 1 },
        second: null,
        third: null,
      }
      render(<RunnerConfirmation runners={runnersOn1st} onConfirm={() => {}} onCancel={() => {}} />)
      const secondButtons = screen.getAllByRole('button', { name: /^2nd$/i })
      const thirdButtons = screen.getAllByRole('button', { name: /^3rd$/i })
      const scoredButtons = screen.getAllByRole('button', { name: /^scored$/i })
      const outButtons = screen.getAllByRole('button', { name: /^out$/i })
      expect(secondButtons[0]).toBeEnabled()
      expect(thirdButtons[0]).toBeEnabled()
      expect(scoredButtons[0]).toBeEnabled()
      expect(outButtons[0]).toBeEnabled()
    })

    it('should always enable Scored and Out buttons regardless of starting base', () => {
      const runnersOn2nd: BaseRunners = {
        first: null,
        second: { playerName: 'Carol', orderPosition: 3 },
        third: null,
      }
      render(<RunnerConfirmation runners={runnersOn2nd} onConfirm={() => {}} onCancel={() => {}} />)
      const scoredButtons = screen.getAllByRole('button', { name: /^scored$/i })
      const outButtons = screen.getAllByRole('button', { name: /^out$/i })
      expect(scoredButtons[0]).toBeEnabled()
      expect(outButtons[0]).toBeEnabled()
    })
  })
})
