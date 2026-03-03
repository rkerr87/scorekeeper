import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Spinner } from '../Spinner'

describe('Spinner', () => {
  it('renders with default label', () => {
    render(<Spinner />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('renders with custom label', () => {
    render(<Spinner label="Fetching data…" />)
    expect(screen.getByText('Fetching data…')).toBeInTheDocument()
  })

  it('renders the spinning element', () => {
    render(<Spinner />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
