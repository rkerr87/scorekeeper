import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BeginnerGuide } from '../BeginnerGuide'

describe('BeginnerGuide', () => {
  it('should display the play notation', () => {
    render(<BeginnerGuide playType="K" notation="K" />)
    expect(screen.getByText('K')).toBeInTheDocument()
  })

  it('should show explanation for strikeout', () => {
    render(<BeginnerGuide playType="K" notation="K" />)
    expect(screen.getByText(/strikeout/i)).toBeInTheDocument()
  })

  it('should show explanation for ground out', () => {
    render(<BeginnerGuide playType="GO" notation="6-3" />)
    expect(screen.getByText(/ground out/i)).toBeInTheDocument()
    expect(screen.getByText(/shortstop.*first/i)).toBeInTheDocument()
  })

  it('should show explanation for single', () => {
    render(<BeginnerGuide playType="1B" notation="1B" />)
    expect(screen.getByText(/single/i)).toBeInTheDocument()
  })

  it('should render a diamond showing the play', () => {
    const { container } = render(<BeginnerGuide playType="1B" notation="1B" />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
