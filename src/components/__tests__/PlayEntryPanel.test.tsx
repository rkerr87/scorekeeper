import { describe, it, expect } from 'vitest'
import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlayEntryPanel } from '../PlayEntryPanel'
import type { BaseRunners } from '../../engine/types'

const runnersOnFirst: BaseRunners = {
  first: { playerName: 'Alice', orderPosition: 1 },
  second: null,
  third: null,
}

const runnersOnFirstAndSecond: BaseRunners = {
  first: { playerName: 'Alice', orderPosition: 1 },
  second: { playerName: 'Bob', orderPosition: 2 },
  third: null,
}

describe('PlayEntryPanel', () => {
  it('should render pitch tracker and common play buttons', () => {
    render(<PlayEntryPanel batterName="John Doe" onPlayRecorded={() => {}} onClose={() => {}} />)
    expect(screen.getByText(/john doe/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ball/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^K$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^1B$/i })).toBeInTheDocument()
  })

  it('should call onPlayRecorded with play data for strikeout', async () => {
    const user = userEvent.setup()
    const onPlayRecorded = vi.fn()
    render(<PlayEntryPanel batterName="John" onPlayRecorded={onPlayRecorded} onClose={() => {}} />)

    // Track some pitches first
    await user.click(screen.getByRole('button', { name: /strike/i }))
    await user.click(screen.getByRole('button', { name: /strike/i }))

    // Record the outcome
    await user.click(screen.getByRole('button', { name: /^K$/i }))

    expect(onPlayRecorded).toHaveBeenCalledOnce()
    const call = onPlayRecorded.mock.calls[0][0]
    expect(call.playType).toBe('K')
    expect(call.pitches).toEqual(['S', 'S'])
  })

  it('should show field diagram when fielding play selected', async () => {
    const user = userEvent.setup()
    render(<PlayEntryPanel batterName="John" onPlayRecorded={() => {}} onClose={() => {}} />)

    await user.click(screen.getByRole('button', { name: /ground out/i }))

    // Field diagram should appear
    expect(screen.getByRole('button', { name: /6.*SS/i })).toBeInTheDocument()
  })

  it('should record fielding play after selecting positions', async () => {
    const user = userEvent.setup()
    const onPlayRecorded = vi.fn()
    render(<PlayEntryPanel batterName="John" onPlayRecorded={onPlayRecorded} onClose={() => {}} />)

    await user.click(screen.getByRole('button', { name: /ground out/i }))
    await user.click(screen.getByRole('button', { name: /6.*SS/i }))
    await user.click(screen.getByRole('button', { name: /3.*1B/i }))
    await user.click(screen.getByRole('button', { name: /confirm/i }))

    expect(onPlayRecorded).toHaveBeenCalledOnce()
    const call = onPlayRecorded.mock.calls[0][0]
    expect(call.playType).toBe('GO')
    expect(call.fieldersInvolved).toEqual([6, 3])
    expect(call.notation).toBe('6-3')
  })

  it('should have a shorthand text input', () => {
    render(<PlayEntryPanel batterName="John" onPlayRecorded={() => {}} onClose={() => {}} />)
    expect(screen.getByPlaceholderText(/shorthand/i)).toBeInTheDocument()
  })

  it('should show error and not call onPlayRecorded for invalid shorthand', async () => {
    const user = userEvent.setup()
    const onPlayRecorded = vi.fn()
    render(<PlayEntryPanel batterName="John" onPlayRecorded={onPlayRecorded} onClose={() => {}} />)

    await user.type(screen.getByPlaceholderText(/shorthand/i), '???')
    await user.click(screen.getByRole('button', { name: /^enter$/i }))

    expect(onPlayRecorded).not.toHaveBeenCalled()
    expect(screen.getByText(/unrecognized/i)).toBeInTheDocument()
  })

  it('should record SB immediately when only one runner on base', async () => {
    const user = userEvent.setup()
    const onPlayRecorded = vi.fn()
    render(
      <PlayEntryPanel
        batterName="John"
        baseRunners={runnersOnFirst}
        onPlayRecorded={onPlayRecorded}
        onClose={() => {}}
      />
    )
    await user.click(screen.getByRole('button', { name: /^SB$/i }))
    expect(onPlayRecorded).toHaveBeenCalledOnce()
    expect(onPlayRecorded.mock.calls[0][0].playType).toBe('SB')
  })

  it('should show runner selection when multiple runners on base and SB tapped', async () => {
    const user = userEvent.setup()
    render(
      <PlayEntryPanel
        batterName="John"
        baseRunners={runnersOnFirstAndSecond}
        onPlayRecorded={() => {}}
        onClose={() => {}}
      />
    )
    await user.click(screen.getByRole('button', { name: /^SB$/i }))
    expect(screen.getByText(/who is stealing/i)).toBeInTheDocument()
  })

  it('should record SB with runnerOverrides for the selected runner', async () => {
    const user = userEvent.setup()
    const onPlayRecorded = vi.fn()
    render(
      <PlayEntryPanel
        batterName="John"
        baseRunners={runnersOnFirstAndSecond}
        onPlayRecorded={onPlayRecorded}
        onClose={() => {}}
      />
    )
    await user.click(screen.getByRole('button', { name: /^SB$/i }))
    // Select Alice (on 1st) as the stealer
    await user.click(screen.getByRole('button', { name: /alice/i }))

    expect(onPlayRecorded).toHaveBeenCalledOnce()
    const call = onPlayRecorded.mock.calls[0][0]
    expect(call.playType).toBe('SB')
    expect(call.runnerOverrides).toBeDefined()
    // Alice moved from 1st to 2nd; Bob stays on 2nd
    expect(call.runnerOverrides.second).toMatchObject({ playerName: 'Alice' })
  })
})
