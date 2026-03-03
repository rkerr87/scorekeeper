import { describe, it, expect } from 'vitest'
import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PitchTracker } from '../PitchTracker'

const defaultProps = {
  onAddPitch: vi.fn(),
  onRemovePitch: vi.fn(),
  onClear: vi.fn(),
  onRemoveAt: vi.fn(),
}

describe('PitchTracker', () => {
  it('should render ball and strike buttons', () => {
    render(<PitchTracker pitches={[]} {...defaultProps} />)
    expect(screen.getByRole('button', { name: /ball/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /strike/i })).toBeInTheDocument()
  })

  it('should display current count', () => {
    render(<PitchTracker pitches={['B', 'S', 'B', 'F']} {...defaultProps} />)
    // 2 balls, 1 strike + 1 foul = 2 strikes displayed
    expect(screen.getByText('2-2')).toBeInTheDocument()
  })

  it('should call onAddPitch when ball pressed', async () => {
    const user = userEvent.setup()
    const onAddPitch = vi.fn()
    render(<PitchTracker pitches={[]} {...defaultProps} onAddPitch={onAddPitch} />)

    await user.click(screen.getByRole('button', { name: /ball/i }))
    expect(onAddPitch).toHaveBeenCalledWith('B')
  })

  it('should call onAddPitch when strike pressed', async () => {
    const user = userEvent.setup()
    const onAddPitch = vi.fn()
    render(<PitchTracker pitches={[]} {...defaultProps} onAddPitch={onAddPitch} />)

    await user.click(screen.getByRole('button', { name: /strike/i }))
    expect(onAddPitch).toHaveBeenCalledWith('S')
  })

  it('should show total pitch count', () => {
    render(<PitchTracker pitches={['B', 'S', 'F', 'B', 'S']} {...defaultProps} />)
    expect(screen.getByText(/5 pitches/i)).toBeInTheDocument()
  })

  it('shows clear pitches button when pitches exist', () => {
    render(<PitchTracker pitches={['B', 'S']} {...defaultProps} />)
    expect(screen.getByRole('button', { name: /clear pitches/i })).toBeInTheDocument()
  })

  it('does not show clear pitches button when no pitches', () => {
    render(<PitchTracker pitches={[]} {...defaultProps} />)
    expect(screen.queryByRole('button', { name: /clear pitches/i })).not.toBeInTheDocument()
  })

  it('shows inline confirmation before clearing', async () => {
    const user = userEvent.setup()
    const onClear = vi.fn()
    render(<PitchTracker pitches={['B', 'S']} {...defaultProps} onClear={onClear} />)
    await user.click(screen.getByRole('button', { name: /clear pitches/i }))
    expect(screen.getByText(/clear 2 pitches\?/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^clear$/i }))
    expect(onClear).toHaveBeenCalled()
  })

  it('cancels clearing when cancel is clicked', async () => {
    const user = userEvent.setup()
    const onClear = vi.fn()
    render(<PitchTracker pitches={['B', 'S']} {...defaultProps} onClear={onClear} />)
    await user.click(screen.getByRole('button', { name: /clear pitches/i }))
    expect(screen.getByText(/clear 2 pitches\?/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClear).not.toHaveBeenCalled()
    // Clear pitches button should be visible again
    expect(screen.getByRole('button', { name: /clear pitches/i })).toBeInTheDocument()
  })

  it('calls onRemoveAt when pitch dot is clicked', async () => {
    const user = userEvent.setup()
    const onRemoveAt = vi.fn()
    render(<PitchTracker pitches={['B', 'S', 'F']} {...defaultProps} onRemoveAt={onRemoveAt} />)
    const dots = screen.getAllByTestId('pitch-dot')
    await user.click(dots[1]) // click the 'S' dot
    expect(onRemoveAt).toHaveBeenCalledWith(1)
  })
})
