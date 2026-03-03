import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '../../contexts/ToastContext'
import { TeamDetailPage } from '../TeamDetailPage'
import { db } from '../../db/database'

function renderWithRouter(teamId: string) {
  return render(
    <MemoryRouter initialEntries={[`/teams/${teamId}`]}>
      <ToastProvider>
        <Routes>
          <Route path="/teams/:teamId" element={<TeamDetailPage />} />
          <Route path="/teams" element={<div>Teams List</div>} />
        </Routes>
      </ToastProvider>
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

    await user.click(screen.getByRole('button', { name: /^delete$/i }))
    await user.click(screen.getByRole('button', { name: /yes/i }))

    await waitFor(() => {
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
    })
  })

  it('shows confirmation before deleting a player', async () => {
    const user = userEvent.setup()
    const teamId = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
    await db.players.add({ teamId, name: 'John Doe', jerseyNumber: 23, defaultPosition: 'SS', createdAt: new Date() })

    renderWithRouter(String(teamId))

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    // Click delete — should show confirmation, not immediately delete
    await user.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(screen.getByText(/delete john doe\?/i)).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()

    // Click Cancel — player still in DOM
    await user.click(screen.getByRole('button', { name: /no/i }))
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.queryByText(/delete john doe\?/i)).not.toBeInTheDocument()

    // Click Delete again, then Yes — player removed
    await user.click(screen.getByRole('button', { name: /^delete$/i }))
    await user.click(screen.getByRole('button', { name: /yes/i }))

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

  describe('Team Rename', () => {
    it('allows renaming the team by clicking the name', async () => {
      const user = userEvent.setup()
      const teamId = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })

      renderWithRouter(String(teamId))

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /mudcats/i })).toBeInTheDocument()
      })

      // Click the team name heading
      await user.click(screen.getByRole('heading', { name: /mudcats/i }))

      // Input appears with current name
      const input = screen.getByDisplayValue('Mudcats')
      expect(input).toBeInTheDocument()

      // Change to "New Name" and press Enter
      await user.clear(input)
      await user.type(input, 'New Name')
      await user.keyboard('{Enter}')

      // Heading now shows "New Name"
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /new name/i })).toBeInTheDocument()
      })

      // Verify persisted to DB
      const updatedTeam = await db.teams.get(teamId)
      expect(updatedTeam?.name).toBe('New Name')
    })

    it('cancels rename on blur without changes', async () => {
      const user = userEvent.setup()
      const teamId = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })

      renderWithRouter(String(teamId))

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /mudcats/i })).toBeInTheDocument()
      })

      // Click the heading to start editing
      await user.click(screen.getByRole('heading', { name: /mudcats/i }))

      const input = screen.getByDisplayValue('Mudcats')
      expect(input).toBeInTheDocument()

      // Blur without changing — heading is restored
      await user.keyboard('{Tab}')

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /mudcats/i })).toBeInTheDocument()
      })
      expect(screen.queryByDisplayValue('Mudcats')).not.toBeInTheDocument()
    })
  })

  describe('Player Editing', () => {
    it('allows editing a player by clicking their row', async () => {
      const user = userEvent.setup()
      const teamId = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
      await db.players.add({ teamId, name: 'John Doe', jerseyNumber: 23, defaultPosition: 'SS', createdAt: new Date() })

      renderWithRouter(String(teamId))

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })

      // Click on the player row to start editing
      await user.click(screen.getByText('John Doe'))

      // Edit form appears with current values
      const nameInput = screen.getByDisplayValue('John Doe')
      expect(nameInput).toBeInTheDocument()
      expect(screen.getByDisplayValue('23')).toBeInTheDocument()

      // Change the name
      await user.clear(nameInput)
      await user.type(nameInput, 'Jane Smith')

      // Click Save
      await user.click(screen.getByRole('button', { name: /save/i }))

      // Row shows updated name
      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument()
        expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
      })
    })

    it('cancels editing when Cancel is clicked', async () => {
      const user = userEvent.setup()
      const teamId = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
      await db.players.add({ teamId, name: 'John Doe', jerseyNumber: 23, defaultPosition: 'SS', createdAt: new Date() })

      renderWithRouter(String(teamId))

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })

      // Click on the player row to start editing
      await user.click(screen.getByText('John Doe'))

      // Edit form appears
      expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument()

      // Click Cancel
      await user.click(screen.getByRole('button', { name: /cancel/i }))

      // Original row is shown again
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.queryByDisplayValue('John Doe')).not.toBeInTheDocument()
    })
  })

  describe('Delete Team', () => {
    it('shows a Delete Team button', async () => {
      const teamId = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })

      renderWithRouter(String(teamId))

      await waitFor(() => {
        expect(screen.getByText('Mudcats')).toBeInTheDocument()
      })

      expect(screen.getByRole('button', { name: /delete team/i })).toBeInTheDocument()
    })

    it('shows confirmation dialog when no games exist', async () => {
      const user = userEvent.setup()
      const teamId = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })

      renderWithRouter(String(teamId))

      await waitFor(() => {
        expect(screen.getByText('Mudcats')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /delete team/i }))

      expect(screen.getByText(/delete mudcats\? this cannot be undone/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /yes, delete/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })

    it('shows blocking message when team has games', async () => {
      const user = userEvent.setup()
      const teamId = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
      const team2Id = await db.teams.add({ name: 'Cardinals', createdAt: new Date() })
      await db.games.add({
        team1Id: teamId,
        team2Id: team2Id,
        homeTeamId: teamId,
        code: 'ABC123',
        date: new Date(),
        status: 'in_progress',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      renderWithRouter(String(teamId))

      await waitFor(() => {
        expect(screen.getByText('Mudcats')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /delete team/i }))

      expect(screen.getByText(/can't delete.*this team has games/i)).toBeInTheDocument()
      expect(screen.queryByText(/delete mudcats\? this cannot be undone/i)).not.toBeInTheDocument()
    })

    it('cancel hides the confirmation dialog', async () => {
      const user = userEvent.setup()
      const teamId = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })

      renderWithRouter(String(teamId))

      await waitFor(() => {
        expect(screen.getByText('Mudcats')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /delete team/i }))
      expect(screen.getByText(/delete mudcats\? this cannot be undone/i)).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /cancel/i }))
      expect(screen.queryByText(/delete mudcats\? this cannot be undone/i)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /delete team/i })).toBeInTheDocument()
    })

    it('deletes team and navigates to /teams on confirm', async () => {
      const user = userEvent.setup()
      const teamId = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
      await db.players.add({ teamId, name: 'Player A', jerseyNumber: 7, defaultPosition: 'P', createdAt: new Date() })

      renderWithRouter(String(teamId))

      await waitFor(() => {
        expect(screen.getByText('Mudcats')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /delete team/i }))
      await user.click(screen.getByRole('button', { name: /yes, delete/i }))

      await waitFor(() => {
        expect(screen.getByText('Teams List')).toBeInTheDocument()
      })

      // Verify team and players were removed from DB
      const teamInDb = await db.teams.get(teamId)
      expect(teamInDb).toBeUndefined()
      const playersInDb = await db.players.where('teamId').equals(teamId).toArray()
      expect(playersInDb).toHaveLength(0)
    })
  })
})
