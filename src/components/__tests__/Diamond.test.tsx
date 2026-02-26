import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Diamond } from '../Diamond'

describe('Diamond', () => {
  it('should render an SVG element', () => {
    const { container } = render(<Diamond basesReached={[]} />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('should render base path for a single', () => {
    const { container } = render(<Diamond basesReached={[1]} />)
    const paths = container.querySelectorAll('[data-testid="base-path"]')
    expect(paths.length).toBeGreaterThan(0)
  })

  it('should render filled diamond for home run', () => {
    const { container } = render(<Diamond basesReached={[1, 2, 3, 4]} runScored />)
    const filled = container.querySelector('[data-testid="run-scored"]')
    expect(filled).toBeInTheDocument()
  })

  it('should display notation text', () => {
    const { container } = render(<Diamond basesReached={[1]} notation="1B" />)
    expect(container.textContent).toContain('1B')
  })

  it('should render pitch dots', () => {
    const { container } = render(
      <Diamond basesReached={[]} pitches={['B', 'S', 'F', 'B', 'S']} />
    )
    const dots = container.querySelectorAll('[data-testid="pitch-dot"]')
    expect(dots.length).toBe(5)
  })
})
