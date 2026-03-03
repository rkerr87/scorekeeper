import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { TeamDetailPage } from '../TeamDetailPage'
import { db } from '../../db/database'

function renderWithRouter(teamId: string) {
  return render(
    <MemoryRouter initialEntries={[`/teams/${teamId}`]}>
      <Routes>
        <Route path="/teams/:teamId" element={<TeamDetailPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('TeamDetailPage', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  afterEach(async () => {
    await db.close()
  })

  it('should show "No players on the roster yet." when team has no players', async () => {
    const teamId = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })

    renderWithRouter(String(teamId))

    await waitFor(() => {
      expect(screen.getByText(/no players on the roster yet/i)).toBeInTheDocument()
    })
  })

  it('should load a team by ID from URL params', async () => {
    const teamId = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })

    renderWithRouter(String(teamId))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Mudcats' })).toBeInTheDocument()
    })
  })

  it('should show "Team not found" for a bad ID', async () => {
    renderWithRouter('9999')

    await waitFor(() => {
      expect(screen.getByText('Team not found.')).toBeInTheDocument()
    })
  })

  it('should show a back link to /teams', async () => {
    const teamId = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })

    renderWithRouter(String(teamId))

    await waitFor(() => {
      expect(screen.getByText('Mudcats')).toBeInTheDocument()
    })
    const backLink = screen.getByRole('link', { name: /teams/i })
    expect(backLink).toHaveAttribute('href', '/teams')
  })

  it('should add a player to the roster', async () => {
    const user = userEvent.setup()
    const teamId = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })

    renderWithRouter(String(teamId))

    await waitFor(() => {
      expect(screen.getByText('Mudcats')).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText(/player name/i), 'John Doe')
    await user.type(screen.getByPlaceholderText(/jersey/i), '23')
    await user.selectOptions(screen.getByRole('combobox'), 'SS')
    await user.click(screen.getByRole('button', { name: /add player/i }))

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('23')).toBeInTheDocument()
      expect(screen.getByRole('cell', { name: 'SS' })).toBeInTheDocument()
    })

    // Player count should update
    expect(screen.getByText('1 player')).toBeInTheDocument()
  })

  it('should delete a player from the roster', async () => {
    const user = userEvent.setup()
    const teamId = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
    await db.players.add({ teamId, name: 'John Doe', jerseyNumber: 23, defaultPosition: 'SS', createdAt: new Date() })

    renderWithRouter(String(teamId))

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /delete/i }))

    await waitFor(() => {
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
    })
  })

  it('should show the roster table when players exist', async () => {
    const teamId = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
    await db.players.add({ teamId, name: 'Player A', jerseyNumber: 7, defaultPosition: 'P', createdAt: new Date() })
    await db.players.add({ teamId, name: 'Player B', jerseyNumber: 12, defaultPosition: 'C', createdAt: new Date() })

    renderWithRouter(String(teamId))

    await waitFor(() => {
      expect(screen.getByText('Player A')).toBeInTheDocument()
      expect(screen.getByText('Player B')).toBeInTheDocument()
    })

    // Table headers
    expect(screen.getByText('#')).toBeInTheDocument()
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Pos' })).toBeInTheDocument()

    // Player count
    expect(screen.getByText('2 players')).toBeInTheDocument()
  })

  it('should default position to UT when not specified', async () => {
    const user = userEvent.setup()
    const teamId = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })

    renderWithRouter(String(teamId))

    await waitFor(() => {
      expect(screen.getByText('Mudcats')).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText(/player name/i), 'Jane Smith')
    await user.type(screen.getByPlaceholderText(/jersey/i), '5')
    await user.click(screen.getByRole('button', { name: /add player/i }))

    await waitFor(() => {
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      expect(screen.getByText('UT')).toBeInTheDocument()
    })
  })

  it('shows error when jersey number is not numeric', async () => {
    const user = userEvent.setup()
    const teamId = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })

    renderWithRouter(String(teamId))

    await waitFor(() => {
      expect(screen.getByText('Mudcats')).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText(/player name/i), 'John Doe')
    await user.type(screen.getByPlaceholderText(/jersey/i), 'abc')
    await user.click(screen.getByRole('button', { name: /add player/i }))

    await waitFor(() => {
      expect(screen.getByText('Jersey # must be a number')).toBeInTheDocument()
    })
  })

  it('shows error when player name is empty on submit', async () => {
    const user = userEvent.setup()
    const teamId = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })

    renderWithRouter(String(teamId))

    await waitFor(() => {
      expect(screen.getByText('Mudcats')).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText(/jersey/i), '23')
    await user.click(screen.getByRole('button', { name: /add player/i }))

    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument()
    })
  })
})
