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

  it('should render a mirrored K for KL notation', () => {
    const { container } = render(<Diamond basesReached={[]} notation="KL" />)
    // Should NOT contain the literal text "KL"
    expect(container.textContent).not.toContain('KL')
    // Should contain a K inside a mirrored span
    const mirror = container.querySelector('[data-testid="backwards-k"]')
    expect(mirror).toBeInTheDocument()
    expect(mirror?.textContent).toBe('K')
  })

  describe('continuation lines', () => {
    it('renders solid continuation lines for runner advancement', () => {
      const { container } = render(
        <Diamond basesReached={[1]} continuationBases={[2, 3]} />
      )
      // Original path: solid line to 1st (home->1st)
      const paths = container.querySelectorAll('[data-testid="base-path"]')
      expect(paths.length).toBe(1)

      // Continuation paths: solid lines 1st->2nd, 2nd->3rd
      const contPaths = container.querySelectorAll('[data-testid="continuation-path"]')
      expect(contPaths.length).toBe(2)
      expect(contPaths[0].getAttribute('stroke-dasharray')).toBeNull()
    })

    it('fills diamond when runner eventually scores via continuation', () => {
      const { container } = render(
        <Diamond basesReached={[1]} continuationBases={[2, 3, 4]} runScored={true} />
      )
      expect(container.querySelector('[data-testid="run-scored"]')).toBeTruthy()
    })

    it('renders no continuation paths when continuationBases not provided', () => {
      const { container } = render(
        <Diamond basesReached={[1, 2]} />
      )
      const contPaths = container.querySelectorAll('[data-testid="continuation-path"]')
      expect(contPaths.length).toBe(0)
    })

    it('renders continuation from home when basesReached is empty', () => {
      // Edge case: non-AB play where runner later advances
      const { container } = render(
        <Diamond basesReached={[]} continuationBases={[1, 2]} />
      )
      const contPaths = container.querySelectorAll('[data-testid="continuation-path"]')
      expect(contPaths.length).toBe(2)
    })
  })
})
