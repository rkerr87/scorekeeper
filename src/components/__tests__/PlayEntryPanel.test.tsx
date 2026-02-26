import { describe, it, expect } from 'vitest'
import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlayEntryPanel } from '../PlayEntryPanel'

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
})
