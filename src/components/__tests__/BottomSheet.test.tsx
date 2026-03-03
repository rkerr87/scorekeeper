import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BottomSheet } from '../BottomSheet'

describe('BottomSheet', () => {
  it('renders children in a bottom-anchored container', () => {
    render(<BottomSheet onClose={() => {}}><div>Content</div></BottomSheet>)
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('calls onClose when backdrop is clicked', async () => {
    const onClose = vi.fn()
    render(<BottomSheet onClose={onClose}><div>Content</div></BottomSheet>)
    fireEvent.click(screen.getByTestId('bottom-sheet-backdrop'))
    expect(onClose).toHaveBeenCalled()
  })
})
