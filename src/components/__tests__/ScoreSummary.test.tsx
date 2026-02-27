import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScoreSummary } from '../ScoreSummary'

describe('ScoreSummary', () => {
  it('should display inning and half', () => {
    render(
      <ScoreSummary inning={3} half="top" outs={2} scoreUs={4} scoreThem={1} pitchCount={47} pitcherName="Smith" />
    )
    expect(screen.getByText(/top 3/i)).toBeInTheDocument()
  })

  it('should display score', () => {
    render(
      <ScoreSummary inning={1} half="top" outs={0} scoreUs={4} scoreThem={1} pitchCount={0} pitcherName="Smith" />
    )
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('should display outs as visual indicators', () => {
    const { container } = render(
      <ScoreSummary inning={1} half="top" outs={2} scoreUs={0} scoreThem={0} pitchCount={0} pitcherName="Smith" />
    )
    const filledOuts = container.querySelectorAll('[data-testid="out-filled"]')
    expect(filledOuts.length).toBe(2)
  })

  it('should display pitcher pitch count', () => {
    render(
      <ScoreSummary inning={1} half="top" outs={0} scoreUs={0} scoreThem={0} pitchCount={47} pitcherName="Smith" />
    )
    expect(screen.getByText(/47/)).toBeInTheDocument()
    expect(screen.getByText(/smith/i)).toBeInTheDocument()
  })

  it('should display pitch count with PC: label', () => {
    render(
      <ScoreSummary
        inning={2} half="top" outs={1}
        scoreUs={3} scoreThem={1}
        pitchCount={47} pitcherName="Smith"
      />
    )
    expect(screen.getByText('PC: 47')).toBeInTheDocument()
  })
})
