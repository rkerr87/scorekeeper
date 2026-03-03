import { describe, it, expect } from 'vitest'
import { vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlayEntryPanel } from '../PlayEntryPanel'
import type { BaseRunners, PitchResult } from '../../engine/types'

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

function renderPanel(overrides?: Partial<{
  batterName: string
  baseRunners: BaseRunners
  pitches: PitchResult[]
  outs: number
  onAddPitch: (pitch: PitchResult) => void
  onRemovePitch: () => void
  onClear: () => void
  onRemoveAt: (index: number) => void
  onPlayRecorded: (data: unknown) => void
  onClose: () => void
}>) {
  const props = {
    batterName: 'John',
    pitches: [] as PitchResult[],
    onAddPitch: vi.fn(),
    onRemovePitch: vi.fn(),
    onClear: vi.fn(),
    onRemoveAt: vi.fn(),
    onPlayRecorded: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  }
  return { ...render(<PlayEntryPanel {...props} />), props }
}

describe('PlayEntryPanel', () => {
  // --- Tab layout tests ---

  it('shows tabbed layout with Hit, Out, Special, Shorthand tabs', () => {
    renderPanel({ batterName: 'John Doe' })
    expect(screen.getByText('Hit')).toBeInTheDocument()
    expect(screen.getByText('Out')).toBeInTheDocument()
    expect(screen.getByText('Special')).toBeInTheDocument()
  })

  it('only shows Hit buttons when Hit tab is active by default', () => {
    renderPanel({ batterName: 'John Doe' })
    // Hit tab is default — hit buttons visible
    expect(screen.getByRole('button', { name: /^1B$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^HR$/i })).toBeInTheDocument()
    // Out tab buttons not visible
    expect(screen.queryByText('Ground Out')).not.toBeInTheDocument()
    // Special tab buttons not visible
    expect(screen.queryByRole('button', { name: /^SB$/i })).not.toBeInTheDocument()
  })

  it('switches to Out tab and shows fielding buttons', () => {
    renderPanel({ batterName: 'John Doe' })
    fireEvent.click(screen.getByText('Out'))
    expect(screen.getByText('Ground Out')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^1B$/i })).not.toBeInTheDocument()
  })

  it('switches to Special tab and shows special play buttons', () => {
    renderPanel({ batterName: 'John Doe' })
    fireEvent.click(screen.getByText('Special'))
    expect(screen.getByRole('button', { name: /^FC$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^SB$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^1B$/i })).not.toBeInTheDocument()
  })

  it('switches to Shorthand tab and shows text input', () => {
    renderPanel({ batterName: 'John Doe' })
    fireEvent.click(screen.getByText(/shorthand/i))
    expect(screen.getByPlaceholderText(/shorthand/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^1B$/i })).not.toBeInTheDocument()
  })

  // --- Existing tests (updated for tabbed layout) ---

  it('should render pitch tracker and common play buttons', () => {
    renderPanel({ batterName: 'John Doe' })
    expect(screen.getByText(/john doe/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ball/i })).toBeInTheDocument()
    // Hit tab is default
    expect(screen.getByRole('button', { name: /^1B$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^HR$/i })).toBeInTheDocument()
  })

  it('should call onAddPitch when pitch buttons are clicked', async () => {
    const user = userEvent.setup()
    const { props } = renderPanel()

    await user.click(screen.getByRole('button', { name: /^strike$/i }))
    expect(props.onAddPitch).toHaveBeenCalledWith('S')

    await user.click(screen.getByRole('button', { name: /ball/i }))
    expect(props.onAddPitch).toHaveBeenCalledWith('B')
  })

  it('should include pitches prop in onPlayRecorded call', async () => {
    const user = userEvent.setup()
    const { props } = renderPanel({ pitches: ['B', 'S'] })

    // Hit tab is default — click 1B
    await user.click(screen.getByRole('button', { name: /^1B$/i }))

    expect(props.onPlayRecorded).toHaveBeenCalledOnce()
    const call = (props.onPlayRecorded as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.playType).toBe('1B')
    expect(call.pitches).toEqual(['B', 'S'])
  })

  it('should show field diagram when fielding play selected', async () => {
    const user = userEvent.setup()
    renderPanel()

    // Switch to Out tab first
    await user.click(screen.getByText('Out'))
    await user.click(screen.getByRole('button', { name: /ground out/i }))

    // Field diagram should appear
    expect(screen.getByRole('button', { name: /6.*SS/i })).toBeInTheDocument()
  })

  it('should record fielding play after selecting positions', async () => {
    const user = userEvent.setup()
    const { props } = renderPanel()

    // Switch to Out tab first
    await user.click(screen.getByText('Out'))
    await user.click(screen.getByRole('button', { name: /ground out/i }))
    await user.click(screen.getByRole('button', { name: /6.*SS/i }))
    await user.click(screen.getByRole('button', { name: /3.*1B/i }))
    await user.click(screen.getByRole('button', { name: /confirm/i }))

    expect(props.onPlayRecorded).toHaveBeenCalledOnce()
    const call = (props.onPlayRecorded as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.playType).toBe('GO')
    expect(call.fieldersInvolved).toEqual([6, 3])
    expect(call.notation).toBe('6-3')
  })

  it('should have a shorthand text input on the Shorthand tab', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByText(/shorthand/i))
    expect(screen.getByPlaceholderText(/shorthand/i)).toBeInTheDocument()
  })

  it('should show error and not call onPlayRecorded for invalid shorthand', async () => {
    const user = userEvent.setup()
    const { props } = renderPanel()

    await user.click(screen.getByText(/shorthand/i))
    await user.type(screen.getByPlaceholderText(/shorthand/i), '???')
    await user.click(screen.getByRole('button', { name: /^enter$/i }))

    expect(props.onPlayRecorded).not.toHaveBeenCalled()
    expect(screen.getByText(/unrecognized/i)).toBeInTheDocument()
  })

  it('should record SB immediately when only one runner on base', async () => {
    const user = userEvent.setup()
    const { props } = renderPanel({ baseRunners: runnersOnFirst })

    // SB is in Special tab
    await user.click(screen.getByText('Special'))
    await user.click(screen.getByRole('button', { name: /^SB$/i }))
    expect(props.onPlayRecorded).toHaveBeenCalledOnce()
    expect((props.onPlayRecorded as ReturnType<typeof vi.fn>).mock.calls[0][0].playType).toBe('SB')
  })

  it('should show runner selection when multiple runners on base and SB tapped', async () => {
    const user = userEvent.setup()
    renderPanel({ baseRunners: runnersOnFirstAndSecond })

    await user.click(screen.getByText('Special'))
    await user.click(screen.getByRole('button', { name: /^SB$/i }))
    expect(screen.getByText(/who is stealing/i)).toBeInTheDocument()
  })

  it('should record SB with runnerOverrides for the selected runner', async () => {
    const user = userEvent.setup()
    const { props } = renderPanel({ baseRunners: runnersOnFirstAndSecond })

    await user.click(screen.getByText('Special'))
    await user.click(screen.getByRole('button', { name: /^SB$/i }))
    // Select Alice (on 1st) as the stealer
    await user.click(screen.getByRole('button', { name: /alice/i }))

    expect(props.onPlayRecorded).toHaveBeenCalledOnce()
    const call = (props.onPlayRecorded as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.playType).toBe('SB')
    expect(call.runnerOverrides).toBeDefined()
    // Alice moved from 1st to 2nd; Bob stays on 2nd
    expect(call.runnerOverrides.second).toMatchObject({ playerName: 'Alice' })
  })

  it('disables FC, SAC, DP, SB, WP, PB, BK when bases empty', () => {
    renderPanel({
      baseRunners: { first: null, second: null, third: null },
    })
    fireEvent.click(screen.getByText('Special'))
    for (const label of ['FC', 'DP', 'SAC', 'SB', 'WP', 'PB', 'BK']) {
      expect(screen.getByRole('button', { name: label })).toBeDisabled()
    }
  })

  it('enables special plays when runners on base', () => {
    renderPanel({
      baseRunners: { first: { playerName: 'A', orderPosition: 1 }, second: null, third: null },
    })
    fireEvent.click(screen.getByText('Special'))
    expect(screen.getByRole('button', { name: 'FC' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'SB' })).toBeEnabled()
  })

  it('disables SAC when 2 outs even with runners', () => {
    renderPanel({
      baseRunners: { first: { playerName: 'A', orderPosition: 1 }, second: null, third: null },
      outs: 2,
    })
    fireEvent.click(screen.getByText('Special'))
    expect(screen.getByRole('button', { name: 'SAC' })).toBeDisabled()
  })

  it('E button is NOT disabled when bases empty (errors can happen anytime)', () => {
    renderPanel({
      baseRunners: { first: null, second: null, third: null },
    })
    fireEvent.click(screen.getByText('Special'))
    expect(screen.getByRole('button', { name: 'E' })).toBeEnabled()
  })

  it('E button opens field diagram for position selection', async () => {
    const user = userEvent.setup()
    const onPlayRecorded = vi.fn()
    renderPanel({ onPlayRecorded })
    await user.click(screen.getByText('Special'))
    await user.click(screen.getByRole('button', { name: 'E' }))
    // Should show field diagram with error-specific prompt
    expect(screen.getByText(/error by/i)).toBeInTheDocument()
    // Should not have recorded a play yet
    expect(onPlayRecorded).not.toHaveBeenCalled()
  })

  it('records error with position number via field diagram', async () => {
    const user = userEvent.setup()
    const onPlayRecorded = vi.fn()
    renderPanel({ onPlayRecorded })
    await user.click(screen.getByText('Special'))
    await user.click(screen.getByRole('button', { name: 'E' }))
    // Select SS (position 6)
    await user.click(screen.getByRole('button', { name: /6.*SS/i }))
    await user.click(screen.getByRole('button', { name: /confirm/i }))
    expect(onPlayRecorded).toHaveBeenCalledWith(
      expect.objectContaining({
        playType: 'E',
        notation: 'E6',
        fieldersInvolved: [6],
        basesReached: [1],
        isAtBat: true,
      })
    )
  })
})
