import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '../../contexts/ToastContext'
import { TeamsPage } from '../TeamsPage'
import { db } from '../../db/database'

function renderWithRouter() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <TeamsPage />
      </ToastProvider>
    </MemoryRouter>
  )
}

describe('TeamsPage', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  afterEach(async () => {
    await db.close()
  })

  it('should show "No teams yet" when no teams exist', async () => {
    renderWithRouter()
    await waitFor(() => {
      expect(screen.getByText(/no teams yet/i)).toBeInTheDocument()
    })
  })

  it('should show a back link to home', async () => {
    renderWithRouter()
    await waitFor(() => {
      expect(screen.getByText(/home/i)).toBeInTheDocument()
    })
    const homeLink = screen.getByRole('link', { name: /home/i })
    expect(homeLink).toHaveAttribute('href', '/')
  })

  it('should create a team and show it in the list', async () => {
    const user = userEvent.setup()
    renderWithRouter()

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/team name/i)).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText(/team name/i), 'Mudcats')
    await user.click(screen.getByRole('button', { name: /create/i }))

    await waitFor(() => {
      expect(screen.getByText('Mudcats')).toBeInTheDocument()
      expect(screen.getByText('0 players')).toBeInTheDocument()
    })

    // "No teams yet" should be gone
    expect(screen.queryByText(/no teams yet/i)).not.toBeInTheDocument()
  })

  it('should link each team to /teams/:id', async () => {
    await db.teams.add({ name: 'Cardinals', createdAt: new Date() })

    renderWithRouter()

    await waitFor(() => {
      expect(screen.getByText('Cardinals')).toBeInTheDocument()
    })

    const teamLink = screen.getByRole('link', { name: /cardinals/i })
    expect(teamLink).toHaveAttribute('href', '/teams/1')
  })

  it('should show player counts for teams', async () => {
    const teamId = await db.teams.add({ name: 'Eagles', createdAt: new Date() })
    await db.players.add({ teamId, name: 'Player 1', jerseyNumber: 1, defaultPosition: 'P', createdAt: new Date() })
    await db.players.add({ teamId, name: 'Player 2', jerseyNumber: 2, defaultPosition: 'C', createdAt: new Date() })

    renderWithRouter()

    await waitFor(() => {
      expect(screen.getByText('2 players')).toBeInTheDocument()
    })
  })

  it('should show singular "player" for teams with 1 player', async () => {
    const teamId = await db.teams.add({ name: 'Hawks', createdAt: new Date() })
    await db.players.add({ teamId, name: 'Solo Player', jerseyNumber: 1, defaultPosition: 'P', createdAt: new Date() })

    renderWithRouter()

    await waitFor(() => {
      expect(screen.getByText('1 player')).toBeInTheDocument()
    })
  })

  it('shows error for duplicate team name', async () => {
    const user = userEvent.setup()
    renderWithRouter()

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/team name/i)).toBeInTheDocument()
    })

    // Create "Tigers"
    await user.type(screen.getByPlaceholderText(/team name/i), 'Tigers')
    await user.click(screen.getByRole('button', { name: /create/i }))

    await waitFor(() => {
      expect(screen.getByText('Tigers')).toBeInTheDocument()
    })

    // Try to create "Tigers" again
    await user.type(screen.getByPlaceholderText(/team name/i), 'Tigers')
    await user.click(screen.getByRole('button', { name: /create/i }))

    await waitFor(() => {
      expect(screen.getByText('A team with this name already exists')).toBeInTheDocument()
    })
  })
})
