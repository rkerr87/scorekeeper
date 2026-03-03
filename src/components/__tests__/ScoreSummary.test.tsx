import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScoreSummary } from '../ScoreSummary'

const defaults = {
  homeTeamName: 'Mudcats',
  awayTeamName: 'Tigers',
}

describe('ScoreSummary', () => {
  it('should display inning and half', () => {
    render(
      <ScoreSummary inning={3} half="top" outs={2} scoreHome={4} scoreAway={1} {...defaults} pitchCount={47} pitcherName="Smith" />
    )
    expect(screen.getByText('TOP')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('should display score', () => {
    render(
      <ScoreSummary inning={2} half="top" outs={0} scoreHome={4} scoreAway={7} {...defaults} pitchCount={0} pitcherName="Smith" />
    )
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('should display outs as visual indicators', () => {
    const { container } = render(
      <ScoreSummary inning={1} half="top" outs={2} scoreHome={0} scoreAway={0} {...defaults} pitchCount={0} pitcherName="Smith" />
    )
    const filledOuts = container.querySelectorAll('[data-testid="out-filled"]')
    expect(filledOuts.length).toBe(2)
  })

  it('should display pitcher pitch count', () => {
    render(
      <ScoreSummary inning={1} half="top" outs={0} scoreHome={0} scoreAway={0} {...defaults} pitchCount={47} pitcherName="Smith" />
    )
    expect(screen.getByText(/47/)).toBeInTheDocument()
    expect(screen.getByText(/smith/i)).toBeInTheDocument()
  })

  it('should display pitch count with PC: label', () => {
    render(
      <ScoreSummary
        inning={2} half="top" outs={1}
        scoreHome={3} scoreAway={1} {...defaults}
        pitchCount={47} pitcherName="Smith"
      />
    )
    expect(screen.getByText('PC: 47')).toBeInTheDocument()
  })

  it('should show team names', () => {
    render(
      <ScoreSummary inning={1} half="top" outs={0} scoreHome={5} scoreAway={3} homeTeamName="Mudcats" awayTeamName="Tigers" pitchCount={0} pitcherName="Smith" />
    )
    expect(screen.getByText('Tigers')).toBeInTheDocument()
    expect(screen.getByText('Mudcats')).toBeInTheDocument()
  })

  it('should show away score first, home score second (sports convention)', () => {
    render(
      <ScoreSummary inning={1} half="top" outs={0} scoreHome={5} scoreAway={3} homeTeamName="Mudcats" awayTeamName="Tigers" pitchCount={0} pitcherName="Smith" />
    )
    const labels = screen.getAllByText(/^(Mudcats|Tigers)$/)
    expect(labels[0].textContent).toBe('Tigers')
    expect(labels[1].textContent).toBe('Mudcats')
  })

  it('shows TOP instead of triangle symbol for top half', () => {
    render(
      <ScoreSummary inning={3} half="top" outs={0} scoreHome={0} scoreAway={0} {...defaults} pitchCount={0} pitcherName="Smith" />
    )
    expect(screen.getByText('TOP')).toBeInTheDocument()
    expect(screen.queryByText('▲')).not.toBeInTheDocument()
  })

  it('shows BOT instead of triangle symbol for bottom half', () => {
    render(
      <ScoreSummary inning={3} half="bottom" outs={0} scoreHome={0} scoreAway={0} {...defaults} pitchCount={0} pitcherName="Smith" />
    )
    expect(screen.getByText('BOT')).toBeInTheDocument()
    expect(screen.queryByText('▼')).not.toBeInTheDocument()
  })

  it('shows team names in score display', () => {
    render(
      <ScoreSummary inning={1} half="top" outs={0} scoreHome={0} scoreAway={0} awayTeamName="Tigers" homeTeamName="Lions" pitchCount={0} pitcherName="Smith" />
    )
    expect(screen.getByText('Tigers')).toBeInTheDocument()
    expect(screen.getByText('Lions')).toBeInTheDocument()
  })
})
