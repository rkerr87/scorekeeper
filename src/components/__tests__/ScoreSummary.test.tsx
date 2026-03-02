import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScoreSummary } from '../ScoreSummary'

describe('ScoreSummary', () => {
  it('should display inning and half', () => {
    render(
      <ScoreSummary inning={3} half="top" outs={2} scoreUs={4} scoreThem={1} homeOrAway="home" pitchCount={47} pitcherName="Smith" />
    )
    expect(screen.getByText(/top 3/i)).toBeInTheDocument()
  })

  it('should display score', () => {
    render(
      <ScoreSummary inning={1} half="top" outs={0} scoreUs={4} scoreThem={1} homeOrAway="home" pitchCount={0} pitcherName="Smith" />
    )
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('should display outs as visual indicators', () => {
    const { container } = render(
      <ScoreSummary inning={1} half="top" outs={2} scoreUs={0} scoreThem={0} homeOrAway="home" pitchCount={0} pitcherName="Smith" />
    )
    const filledOuts = container.querySelectorAll('[data-testid="out-filled"]')
    expect(filledOuts.length).toBe(2)
  })

  it('should display pitcher pitch count', () => {
    render(
      <ScoreSummary inning={1} half="top" outs={0} scoreUs={0} scoreThem={0} homeOrAway="home" pitchCount={47} pitcherName="Smith" />
    )
    expect(screen.getByText(/47/)).toBeInTheDocument()
    expect(screen.getByText(/smith/i)).toBeInTheDocument()
  })

  it('should display pitch count with PC: label', () => {
    render(
      <ScoreSummary
        inning={2} half="top" outs={1}
        scoreUs={3} scoreThem={1} homeOrAway="home"
        pitchCount={47} pitcherName="Smith"
      />
    )
    expect(screen.getByText('PC: 47')).toBeInTheDocument()
  })

  it('should show away score first when us is home (them=away on left, us=home on right)', () => {
    render(
      <ScoreSummary inning={1} half="top" outs={0} scoreUs={5} scoreThem={3} homeOrAway="home" pitchCount={0} pitcherName="Smith" />
    )
    // Away (THEM) should be on left, Home (US) on right
    const labels = screen.getAllByText(/^(US|THEM)$/)
    expect(labels[0].textContent).toBe('THEM')
    expect(labels[1].textContent).toBe('US')
  })

  it('should show away score first when us is away (us=away on left, them=home on right)', () => {
    render(
      <ScoreSummary inning={1} half="top" outs={0} scoreUs={5} scoreThem={3} homeOrAway="away" pitchCount={0} pitcherName="Smith" />
    )
    // Away (US) should be on left, Home (THEM) on right
    const labels = screen.getAllByText(/^(US|THEM)$/)
    expect(labels[0].textContent).toBe('US')
    expect(labels[1].textContent).toBe('THEM')
  })
})
