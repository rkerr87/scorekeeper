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

  describe('pre-play runner positions', () => {
    it('shows runner original base positions (pre-play) in labels and defaults to post-play positions', () => {
      // Pre-play: runner on 1st. Post-play: engine moved them to 2nd
      const prePlayRunners: BaseRunners = {
        first: { playerName: 'Smith', orderPosition: 3 },
        second: null,
        third: null,
      }
      const postPlayRunners: BaseRunners = {
        first: null,
        second: { playerName: 'Smith', orderPosition: 3 },
        third: null,
      }
      render(
        <RunnerConfirmation
          prePlayRunners={prePlayRunners}
          runners={postPlayRunners}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      )
      // Label should say "was on 1st" (pre-play position)
      expect(screen.getByText(/was on 1st/)).toBeInTheDocument()
      // Should NOT say "was on 2nd" since the runner was on 1st before the play
      expect(screen.queryByText(/was on 2nd/)).not.toBeInTheDocument()
    })

    it('defaults selection to post-play positions when prePlayRunners provided', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn()
      // Pre-play: runner on 1st. Post-play: engine moved them to 2nd
      const prePlayRunners: BaseRunners = {
        first: { playerName: 'Smith', orderPosition: 3 },
        second: null,
        third: null,
      }
      const postPlayRunners: BaseRunners = {
        first: null,
        second: { playerName: 'Smith', orderPosition: 3 },
        third: null,
      }
      render(
        <RunnerConfirmation
          prePlayRunners={prePlayRunners}
          runners={postPlayRunners}
          onConfirm={onConfirm}
          onCancel={vi.fn()}
        />
      )
      // Confirm without changes — should use post-play position as default
      await user.click(screen.getByRole('button', { name: /confirm/i }))
      expect(onConfirm).toHaveBeenCalledWith({
        runners: {
          first: null,
          second: { playerName: 'Smith', orderPosition: 3 },
          third: null,
        },
        runsScored: 0,
      })
    })

    it('uses pre-play runner identity for multiple runners with post-play defaults', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn()
      // Pre-play: runners on 1st and 3rd
      // Post-play: runner from 1st moved to 2nd, runner from 3rd scored
      const prePlayRunners: BaseRunners = {
        first: { playerName: 'Alice', orderPosition: 1 },
        second: null,
        third: { playerName: 'Bob', orderPosition: 2 },
      }
      const postPlayRunners: BaseRunners = {
        first: null,
        second: { playerName: 'Alice', orderPosition: 1 },
        third: null,
      }
      render(
        <RunnerConfirmation
          prePlayRunners={prePlayRunners}
          runners={postPlayRunners}
          initialRunsScored={0}
          onConfirm={onConfirm}
          onCancel={vi.fn()}
        />
      )
      // Labels should show pre-play positions
      expect(screen.getByText(/was on 1st/)).toBeInTheDocument()
      expect(screen.getByText(/was on 3rd/)).toBeInTheDocument()
      // Confirm without changes — Bob should be scored (not found on any post-play base)
      await user.click(screen.getByRole('button', { name: /confirm/i }))
      expect(onConfirm).toHaveBeenCalledWith({
        runners: {
          first: null,
          second: { playerName: 'Alice', orderPosition: 1 },
          third: null,
        },
        runsScored: 1,
      })
    })

    it('uses isValidDest based on pre-play base (not post-play)', () => {
      // Pre-play: runner on 1st. Post-play: runner on 2nd.
      // Backward prevention should use pre-play (1st) — so 1st base button should be disabled
      const prePlayRunners: BaseRunners = {
        first: { playerName: 'Smith', orderPosition: 3 },
        second: null,
        third: null,
      }
      const postPlayRunners: BaseRunners = {
        first: null,
        second: { playerName: 'Smith', orderPosition: 3 },
        third: null,
      }
      render(
        <RunnerConfirmation
          prePlayRunners={prePlayRunners}
          runners={postPlayRunners}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      )
      // 1st should be enabled (runner can stay on current base)
      const firstButtons = screen.getAllByRole('button', { name: /^1st$/i })
      expect(firstButtons[0]).toBeEnabled()
      // 2nd and 3rd should be enabled (forward from 1st)
      const secondButtons = screen.getAllByRole('button', { name: /^2nd$/i })
      const thirdButtons = screen.getAllByRole('button', { name: /^3rd$/i })
      expect(secondButtons[0]).toBeEnabled()
      expect(thirdButtons[0]).toBeEnabled()
    })
  })

  describe('backward movement prevention', () => {
    it('should disable backward bases but enable current base for runner on 2nd', () => {
      const runnersOn2nd: BaseRunners = {
        first: null,
        second: { playerName: 'Carol', orderPosition: 3 },
        third: null,
      }
      render(<RunnerConfirmation runners={runnersOn2nd} onConfirm={() => {}} onCancel={() => {}} />)
      const firstButtons = screen.getAllByRole('button', { name: /^1st$/i })
      const secondButtons = screen.getAllByRole('button', { name: /^2nd$/i })
      expect(firstButtons[0]).toBeDisabled()
      expect(secondButtons[0]).toBeEnabled() // can stay
    })

    it('should disable backward bases but enable current base for runner on 3rd', () => {
      const runnersOn3rd: BaseRunners = {
        first: null,
        second: null,
        third: { playerName: 'Bob', orderPosition: 2 },
      }
      render(<RunnerConfirmation runners={runnersOn3rd} onConfirm={() => {}} onCancel={() => {}} />)
      const firstButtons = screen.getAllByRole('button', { name: /^1st$/i })
      const secondButtons = screen.getAllByRole('button', { name: /^2nd$/i })
      const thirdButtons = screen.getAllByRole('button', { name: /^3rd$/i })
      expect(firstButtons[0]).toBeDisabled()
      expect(secondButtons[0]).toBeDisabled()
      expect(thirdButtons[0]).toBeEnabled() // can stay
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

    it('should allow runner on 3rd to stay at 3rd (hold up)', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn()
      const runnersOn3rd: BaseRunners = {
        first: null,
        second: null,
        third: { playerName: 'Bob', orderPosition: 2 },
      }
      render(<RunnerConfirmation runners={runnersOn3rd} onConfirm={onConfirm} onCancel={() => {}} />)
      // 3rd base button should be enabled (stay option)
      const thirdButtons = screen.getAllByRole('button', { name: /^3rd$/i })
      expect(thirdButtons[0]).toBeEnabled()
      // Select 3rd and confirm — runner stays at 3rd
      await user.click(thirdButtons[0])
      await user.click(screen.getByRole('button', { name: /confirm/i }))
      expect(onConfirm).toHaveBeenCalledWith({
        runners: { first: null, second: null, third: { playerName: 'Bob', orderPosition: 2 } },
        runsScored: 0,
      })
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

  describe('batter base advancement', () => {
    const emptyBases: BaseRunners = { first: null, second: null, third: null }

    it('renders batter section with name and base buttons when batterName and batterDefaultBase provided', () => {
      render(
        <RunnerConfirmation
          runners={emptyBases}
          batterName="Jones"
          batterDefaultBase={1}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      )
      expect(screen.getByText(/jones/i)).toBeInTheDocument()
      // Should have base buttons for 1st, 2nd, 3rd (batter can advance from default)
      const firstButtons = screen.getAllByRole('button', { name: /^1st$/i })
      const secondButtons = screen.getAllByRole('button', { name: /^2nd$/i })
      const thirdButtons = screen.getAllByRole('button', { name: /^3rd$/i })
      expect(firstButtons.length).toBeGreaterThanOrEqual(1)
      expect(secondButtons.length).toBeGreaterThanOrEqual(1)
      expect(thirdButtons.length).toBeGreaterThanOrEqual(1)
    })

    it('pre-selects the default base for the batter', () => {
      render(
        <RunnerConfirmation
          runners={emptyBases}
          batterName="Jones"
          batterDefaultBase={2}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      )
      // 2nd base button for batter should be visually selected (have ring styling)
      const secondButtons = screen.getAllByRole('button', { name: /^2nd$/i })
      // The batter's 2nd button should have selected styling (bg-blue-600)
      expect(secondButtons[0].className).toMatch(/bg-blue-600/)
    })

    it('allows selecting a higher base for the batter', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn()
      render(
        <RunnerConfirmation
          runners={emptyBases}
          batterName="Jones"
          batterDefaultBase={1}
          onConfirm={onConfirm}
          onCancel={vi.fn()}
        />
      )
      // Select 2nd base for batter
      const secondButtons = screen.getAllByRole('button', { name: /^2nd$/i })
      await user.click(secondButtons[0])
      await user.click(screen.getByRole('button', { name: /confirm/i }))
      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ batterBase: 2 })
      )
    })

    it('does not return batterBase when batter stays at default', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn()
      render(
        <RunnerConfirmation
          runners={emptyBases}
          batterName="Jones"
          batterDefaultBase={1}
          onConfirm={onConfirm}
          onCancel={vi.fn()}
        />
      )
      await user.click(screen.getByRole('button', { name: /confirm/i }))
      const result = onConfirm.mock.calls[0][0]
      expect(result.batterBase).toBeUndefined()
    })

    it('includes batter base in collision detection with runners', async () => {
      const user = userEvent.setup()
      const runnersOnFirst: BaseRunners = {
        first: { playerName: 'Smith', orderPosition: 3 },
        second: null,
        third: null,
      }
      render(
        <RunnerConfirmation
          runners={runnersOnFirst}
          prePlayRunners={runnersOnFirst}
          batterName="Jones"
          batterDefaultBase={1}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      )
      // Batter defaults to 1st, Smith is still on 1st — try to confirm
      // Smith should be defaulted to 2nd by engine, but let's manually set Smith to 1st
      // to force a collision with the batter on 1st
      const firstButtons = screen.getAllByRole('button', { name: /^1st$/i })
      // Click 1st for Smith (the runner section button)
      // The runner section comes after the batter section
      await user.click(firstButtons[firstButtons.length - 1])
      await user.click(screen.getByRole('button', { name: /confirm/i }))
      expect(screen.getByText(/two runners cannot share the same base/i)).toBeInTheDocument()
    })

    it('does not show batter section when batterName is not provided', () => {
      render(
        <RunnerConfirmation
          runners={runners}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      )
      // Should not have any "Batter" section header
      expect(screen.queryByText(/batter/i)).not.toBeInTheDocument()
    })

    it('disables bases below the default for the batter', () => {
      render(
        <RunnerConfirmation
          runners={emptyBases}
          batterName="Jones"
          batterDefaultBase={2}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      )
      // 1st should be disabled (below default of 2nd)
      const firstButtons = screen.getAllByRole('button', { name: /^1st$/i })
      expect(firstButtons[0]).toBeDisabled()
      // 2nd and 3rd should be enabled
      const secondButtons = screen.getAllByRole('button', { name: /^2nd$/i })
      const thirdButtons = screen.getAllByRole('button', { name: /^3rd$/i })
      expect(secondButtons[0]).toBeEnabled()
      expect(thirdButtons[0]).toBeEnabled()
    })
  })
})
