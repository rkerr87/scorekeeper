import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { TeamPage } from '../TeamPage'
import { db } from '../../db/database'

function renderWithRouter() {
  return render(
    <MemoryRouter>
      <TeamPage />
    </MemoryRouter>
  )
}

describe('TeamPage', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  afterEach(async () => {
    await db.close()
  })

  it('should show create team form when no team exists', async () => {
    renderWithRouter()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /create team/i })).toBeInTheDocument()
    })
  })

  it('should create a team', async () => {
    const user = userEvent.setup()
    renderWithRouter()

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/team name/i)).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText(/team name/i), 'Mudcats')
    await user.click(screen.getByRole('button', { name: /create team/i }))

    await waitFor(() => {
      expect(screen.getByText('Mudcats')).toBeInTheDocument()
    })
  })

  it('should add a player to the roster', async () => {
    const user = userEvent.setup()
    // Pre-create a team
    await db.teams.add({ name: 'Mudcats', createdAt: new Date() })

    renderWithRouter()

    await waitFor(() => {
      expect(screen.getByText('Mudcats')).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText(/player name/i), 'John Doe')
    await user.type(screen.getByPlaceholderText(/jersey/i), '23')
    await user.type(screen.getByPlaceholderText(/position/i), 'SS')
    await user.click(screen.getByRole('button', { name: /add player/i }))

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('23')).toBeInTheDocument()
    })
  })

  it('should delete a player from the roster', async () => {
    const user = userEvent.setup()
    const teamId = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
    await db.players.add({ teamId, name: 'John Doe', jerseyNumber: 23, defaultPosition: 'SS', createdAt: new Date() })

    renderWithRouter()

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /delete/i }))

    await waitFor(() => {
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
    })
  })
})
