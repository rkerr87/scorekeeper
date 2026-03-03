import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ToastProvider, useToast } from '../../contexts/ToastContext'

function TestComponent() {
  const { showToast } = useToast()
  return <button onClick={() => showToast('Player added', 'success')}>Trigger</button>
}

describe('Toast', () => {
  it('shows toast message when triggered', async () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )
    await act(async () => {
      screen.getByText('Trigger').click()
    })
    expect(screen.getByText('Player added')).toBeInTheDocument()
  })

  it('auto-dismisses after timeout', async () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )
    await act(async () => {
      screen.getByText('Trigger').click()
    })
    expect(screen.getByText('Player added')).toBeInTheDocument()
    await act(async () => {
      vi.advanceTimersByTime(3500)
    })
    expect(screen.queryByText('Player added')).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('supports success, error, and info variants', async () => {
    function MultiToast() {
      const { showToast } = useToast()
      return (
        <>
          <button onClick={() => showToast('Good', 'success')}>S</button>
          <button onClick={() => showToast('Bad', 'error')}>E</button>
          <button onClick={() => showToast('Info', 'info')}>I</button>
        </>
      )
    }
    render(
      <ToastProvider>
        <MultiToast />
      </ToastProvider>
    )
    await act(async () => { screen.getByText('S').click() })
    expect(screen.getByText('Good').closest('[data-variant]')?.getAttribute('data-variant')).toBe('success')
  })
})
