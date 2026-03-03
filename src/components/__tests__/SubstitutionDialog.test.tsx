import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SubstitutionDialog } from '../SubstitutionDialog'

describe('SubstitutionDialog', () => {
  it('should show form fields for new player', () => {
    render(
      <SubstitutionDialog
        currentPlayerName="Alice"
        orderPosition={3}
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )
    expect(screen.getByText(/replacing alice/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/new player name/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/jersey/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/position/i)).toBeInTheDocument()
  })

  it('should call onConfirm with substitution data', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(
      <SubstitutionDialog
        currentPlayerName="Alice"
        orderPosition={3}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />
    )

    await user.type(screen.getByPlaceholderText(/new player name/i), 'Dave')
    await user.type(screen.getByPlaceholderText(/jersey/i), '99')
    await user.type(screen.getByPlaceholderText(/position/i), 'RF')
    await user.click(screen.getByRole('button', { name: /confirm sub/i }))

    expect(onConfirm).toHaveBeenCalledWith({
      newPlayerName: 'Dave',
      newJerseyNumber: 99,
      newPosition: 'RF',
    })
  })

  it('should call onCancel when Cancel is clicked and not call onConfirm', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <SubstitutionDialog
        currentPlayerName="Alice"
        orderPosition={3}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    )

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(onCancel).toHaveBeenCalledOnce()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('should disable Confirm Sub button when name is empty', () => {
    render(
      <SubstitutionDialog
        currentPlayerName="Alice"
        orderPosition={3}
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )

    // Nothing typed yet — button must be disabled
    expect(screen.getByRole('button', { name: /confirm sub/i })).toBeDisabled()
  })
})
