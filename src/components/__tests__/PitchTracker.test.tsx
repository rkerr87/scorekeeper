import { describe, it, expect } from 'vitest'
import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PitchTracker } from '../PitchTracker'

describe('PitchTracker', () => {
  it('should render ball and strike buttons', () => {
    render(<PitchTracker pitches={[]} onAddPitch={() => {}} onRemovePitch={() => {}} />)
    expect(screen.getByRole('button', { name: /ball/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /strike/i })).toBeInTheDocument()
  })

  it('should display current count', () => {
    render(<PitchTracker pitches={['B', 'S', 'B', 'F']} onAddPitch={() => {}} onRemovePitch={() => {}} />)
    // 2 balls, 1 strike + 1 foul = 2 strikes displayed
    expect(screen.getByText('2-2')).toBeInTheDocument()
  })

  it('should call onAddPitch when ball pressed', async () => {
    const user = userEvent.setup()
    const onAddPitch = vi.fn()
    render(<PitchTracker pitches={[]} onAddPitch={onAddPitch} onRemovePitch={() => {}} />)

    await user.click(screen.getByRole('button', { name: /ball/i }))
    expect(onAddPitch).toHaveBeenCalledWith('B')
  })

  it('should call onAddPitch when strike pressed', async () => {
    const user = userEvent.setup()
    const onAddPitch = vi.fn()
    render(<PitchTracker pitches={[]} onAddPitch={onAddPitch} onRemovePitch={() => {}} />)

    await user.click(screen.getByRole('button', { name: /strike/i }))
    expect(onAddPitch).toHaveBeenCalledWith('S')
  })

  it('should show total pitch count', () => {
    render(<PitchTracker pitches={['B', 'S', 'F', 'B', 'S']} onAddPitch={() => {}} onRemovePitch={() => {}} />)
    expect(screen.getByText(/5 pitches/i)).toBeInTheDocument()
  })
})
