import { describe, it, expect } from 'vitest'
import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FieldDiagram } from '../FieldDiagram'

describe('FieldDiagram', () => {
  it('should render all 9 position buttons', () => {
    render(<FieldDiagram selectedPositions={[]} onPositionClick={() => {}} />)
    expect(screen.getAllByRole('button')).toHaveLength(9)
  })

  it('should highlight selected positions', () => {
    const { container } = render(<FieldDiagram selectedPositions={[6, 3]} onPositionClick={() => {}} />)
    const highlighted = container.querySelectorAll('[data-selected="true"]')
    expect(highlighted.length).toBe(2)
  })

  it('should call onPositionClick when position tapped', async () => {
    const user = userEvent.setup()
    const onPositionClick = vi.fn()
    render(<FieldDiagram selectedPositions={[]} onPositionClick={onPositionClick} />)

    await user.click(screen.getByRole('button', { name: /6.*SS/i }))
    expect(onPositionClick).toHaveBeenCalledWith(6)
  })
})
