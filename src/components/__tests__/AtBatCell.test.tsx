import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AtBatCell } from '../AtBatCell'

describe('AtBatCell', () => {
  it('should render empty cell', () => {
    const { container } = render(
      <AtBatCell play={null} isCurrentBatter={false} onClick={() => {}} />
    )
    expect(container.querySelector('[data-testid="atbat-cell"]')).toBeInTheDocument()
  })

  it('should render diamond with notation when play exists', () => {
    const { container } = render(
      <AtBatCell
        play={{
          playType: '1B',
          notation: '1B',
          basesReached: [1],
          runsScoredOnPlay: 0,
          pitches: ['B', 'S'],
        }}
        isCurrentBatter={false}
        onClick={() => {}}
      />
    )
    expect(container.textContent).toContain('1B')
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('should highlight current batter cell', () => {
    const { container } = render(
      <AtBatCell play={null} isCurrentBatter={true} onClick={() => {}} />
    )
    expect(container.querySelector('[data-testid="atbat-cell"]')?.className).toContain('ring')
  })

  it('should not show run scored when other runners score on batter single', () => {
    const { container } = render(
      <AtBatCell
        play={{
          playType: '1B',
          notation: '1B7',
          basesReached: [1],
          runsScoredOnPlay: 1, // runner on 3rd scored, not the batter
          pitches: ['B', 'S', 'B'],
        }}
        isCurrentBatter={false}
        onClick={() => {}}
      />
    )
    expect(container.querySelector('[data-testid="run-scored"]')).not.toBeInTheDocument()
  })

  it('should show run scored when batter hits a home run', () => {
    const { container } = render(
      <AtBatCell
        play={{
          playType: 'HR',
          notation: 'HR',
          basesReached: [1, 2, 3, 4],
          runsScoredOnPlay: 2, // batter + runner scored
          pitches: ['S'],
        }}
        isCurrentBatter={false}
        onClick={() => {}}
      />
    )
    expect(container.querySelector('[data-testid="run-scored"]')).toBeInTheDocument()
  })

  it('should call onClick when clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<AtBatCell play={null} isCurrentBatter={false} onClick={onClick} />)

    await user.click(screen.getByTestId('atbat-cell'))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
