import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BeginnerGuide } from '../BeginnerGuide'

describe('BeginnerGuide', () => {
  it('should display the play notation', () => {
    render(<BeginnerGuide playType="K" notation="K" onDismiss={() => {}} />)
    expect(screen.getByText('K')).toBeInTheDocument()
  })

  it('should show explanation for strikeout', () => {
    render(<BeginnerGuide playType="K" notation="K" onDismiss={() => {}} />)
    expect(screen.getByText(/strikeout/i)).toBeInTheDocument()
  })

  it('should show explanation for ground out', () => {
    render(<BeginnerGuide playType="GO" notation="6-3" onDismiss={() => {}} />)
    expect(screen.getByText(/ground out/i)).toBeInTheDocument()
    expect(screen.getByText(/shortstop.*first/i)).toBeInTheDocument()
  })

  it('should show explanation for single', () => {
    render(<BeginnerGuide playType="1B" notation="1B" onDismiss={() => {}} />)
    expect(screen.getByText(/single/i)).toBeInTheDocument()
  })

  it('should render a diamond showing the play', () => {
    const { container } = render(<BeginnerGuide playType="1B" notation="1B" onDismiss={() => {}} />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('stays visible until manually dismissed', () => {
    const onDismiss = vi.fn()
    render(<BeginnerGuide playType="K" notation="K" onDismiss={onDismiss} />)
    expect(screen.getByText(/Strikeout/)).toBeInTheDocument()
    // Guide should still be visible — onDismiss not called
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('calls onDismiss when X button is clicked', () => {
    const onDismiss = vi.fn()
    render(<BeginnerGuide playType="K" notation="K" onDismiss={onDismiss} />)
    fireEvent.click(screen.getByLabelText('Dismiss'))
    expect(onDismiss).toHaveBeenCalled()
  })
})
