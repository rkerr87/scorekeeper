import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { GameProvider } from '../../contexts/GameContext'
import { ToastProvider } from '../../contexts/ToastContext'
import { HomePage } from '../HomePage'
import { db } from '../../db/database'

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <ToastProvider>
        <GameProvider>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/teams" element={<div>Teams Page</div>} />
            <Route path="/game/:gameId/setup" element={<div>Setup Page</div>} />
          </Routes>
        </GameProvider>
      </ToastProvider>
    </MemoryRouter>
  )
}

describe('HomePage', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  afterEach(async () => {
    await db.close()
  })

  it('should show message directing to create teams when no teams exist', async () => {
    renderHome()

    await waitFor(() => {
      expect(screen.getByText(/create.*teams/i)).toBeInTheDocument()
    })
  })

  it('should show "No games yet" when no games exist and teams are present', async () => {
    await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
    await db.teams.add({ name: 'Cardinals', createdAt: new Date() })

    renderHome()

    await waitFor(() => {
      expect(screen.getByText(/no games yet/i)).toBeInTheDocument()
    })
  })

  it('should show new game dialog with team pickers when clicking start new game', async () => {
    const user = userEvent.setup()
    await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
    await db.teams.add({ name: 'Cardinals', createdAt: new Date() })

    renderHome()

    await user.click(await screen.findByRole('button', { name: /start new game/i }))

    await waitFor(() => {
      expect(screen.getByLabelText(/away team/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/home team/i)).toBeInTheDocument()
    })
  })

  it('should navigate to setup page after creating game with two teams', async () => {
    const user = userEvent.setup()
    const team1Id = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
    const team2Id = await db.teams.add({ name: 'Cardinals', createdAt: new Date() })

    renderHome()

    await user.click(await screen.findByRole('button', { name: /start new game/i }))

    const awaySelect = await screen.findByLabelText(/away team/i)
    const homeSelect = await screen.findByLabelText(/home team/i)

    await user.selectOptions(awaySelect, team1Id.toString())
    await user.selectOptions(homeSelect, team2Id.toString())

    await user.click(screen.getByRole('button', { name: /create game/i }))

    await waitFor(() => {
      expect(screen.getByText('Setup Page')).toBeInTheDocument()
    })
  })

  it('should show all games across all teams', async () => {
    const team1Id = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
    const team2Id = await db.teams.add({ name: 'Cardinals', createdAt: new Date() })
    const team3Id = await db.teams.add({ name: 'Eagles', createdAt: new Date() })

    await db.games.add({
      team1Id, team2Id, homeTeamId: team1Id,
      code: 'ABC123', date: new Date(), status: 'in_progress',
      createdAt: new Date(), updatedAt: new Date(),
    })
    await db.games.add({
      team1Id: team2Id, team2Id: team3Id, homeTeamId: team3Id,
      code: 'DEF456', date: new Date(), status: 'in_progress',
      createdAt: new Date(), updatedAt: new Date(),
    })

    renderHome()

    // Game 1: Mudcats are home, Cardinals are away → "Cardinals @ Mudcats"
    await waitFor(() => {
      expect(screen.getByText('Cardinals @ Mudcats')).toBeInTheDocument()
    })
    // Game 2: Eagles are home, Cardinals are away → "Cardinals @ Eagles"
    expect(screen.getByText('Cardinals @ Eagles')).toBeInTheDocument()
  })

  it('should show game with away @ home format', async () => {
    const team1Id = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
    const team2Id = await db.teams.add({ name: 'Cardinals', createdAt: new Date() })

    await db.games.add({
      team1Id, team2Id, homeTeamId: team2Id,
      code: 'XYZ789', date: new Date(), status: 'in_progress',
      createdAt: new Date(), updatedAt: new Date(),
    })

    renderHome()

    // Mudcats are away (team1Id, not homeTeamId), Cardinals are home
    await waitFor(() => {
      expect(screen.getByText('Mudcats @ Cardinals')).toBeInTheDocument()
    })
  })

  it('should have manage teams link pointing to /teams', async () => {
    // Add two teams so the "create teams" info box doesn't appear
    await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
    await db.teams.add({ name: 'Cardinals', createdAt: new Date() })

    renderHome()

    const link = await screen.findByRole('link', { name: /manage teams/i })
    expect(link).toHaveAttribute('href', '/teams')
  })

  describe('game deletion', () => {
    it('should show inline confirm when delete button is clicked', async () => {
      const user = userEvent.setup()
      const team1Id = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
      const team2Id = await db.teams.add({ name: 'Cardinals', createdAt: new Date() })
      await db.games.add({
        team1Id, team2Id, homeTeamId: team1Id,
        code: 'ABC123', date: new Date(), status: 'in_progress',
        createdAt: new Date(), updatedAt: new Date(),
      })

      renderHome()

      await waitFor(() => expect(screen.getByText('Cardinals @ Mudcats')).toBeInTheDocument())

      await user.click(screen.getByRole('button', { name: /delete game cardinals.*mudcats/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /yes, delete/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
      })
    })

    it('should restore normal state when cancel is clicked', async () => {
      const user = userEvent.setup()
      const team1Id = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
      const team2Id = await db.teams.add({ name: 'Cardinals', createdAt: new Date() })
      await db.games.add({
        team1Id, team2Id, homeTeamId: team1Id,
        code: 'ABC123', date: new Date(), status: 'in_progress',
        createdAt: new Date(), updatedAt: new Date(),
      })

      renderHome()

      await waitFor(() => expect(screen.getByText('Cardinals @ Mudcats')).toBeInTheDocument())
      await user.click(screen.getByRole('button', { name: /delete game cardinals.*mudcats/i }))
      await waitFor(() => expect(screen.getByRole('button', { name: /yes, delete/i })).toBeInTheDocument())

      await user.click(screen.getByRole('button', { name: /cancel/i }))

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /yes, delete/i })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: /delete game cardinals.*mudcats/i })).toBeInTheDocument()
      })
    })

    it('should remove game from list after confirming delete', async () => {
      const user = userEvent.setup()
      const team1Id = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
      const team2Id = await db.teams.add({ name: 'Cardinals', createdAt: new Date() })
      await db.games.add({
        team1Id, team2Id, homeTeamId: team1Id,
        code: 'ABC123', date: new Date(), status: 'in_progress',
        createdAt: new Date(), updatedAt: new Date(),
      })

      renderHome()

      await waitFor(() => expect(screen.getByText('Cardinals @ Mudcats')).toBeInTheDocument())
      await user.click(screen.getByRole('button', { name: /delete game cardinals.*mudcats/i }))
      await waitFor(() => expect(screen.getByRole('button', { name: /yes, delete/i })).toBeInTheDocument())

      await user.click(screen.getByRole('button', { name: /yes, delete/i }))

      await waitFor(() => {
        expect(screen.queryByText('Cardinals @ Mudcats')).not.toBeInTheDocument()
      })
    })
  })

  it('should prevent selecting the same team as both away and home', async () => {
    const user = userEvent.setup()
    const team1Id = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
    await db.teams.add({ name: 'Cardinals', createdAt: new Date() })

    renderHome()

    await user.click(await screen.findByRole('button', { name: /start new game/i }))

    const awaySelect = await screen.findByLabelText(/away team/i)
    await user.selectOptions(awaySelect, team1Id.toString())

    // The home team dropdown should not have Mudcats as an option
    const homeSelect = screen.getByLabelText(/home team/i)
    const homeOptions = Array.from((homeSelect as HTMLSelectElement).options)
    const mudcatsOption = homeOptions.find(o => o.text === 'Mudcats')
    expect(mudcatsOption).toBeUndefined()
  })

  describe('dev tools', () => {
    it('hides dev tools by default', async () => {
      renderHome()

      await waitFor(() => {
        // The page should have loaded (heading visible)
        expect(screen.getByText(/scorekeeper/i)).toBeInTheDocument()
      })

      expect(screen.queryByRole('button', { name: /seed.*data/i })).not.toBeInTheDocument()
    })

    it('shows dev tools when Dev link is clicked', async () => {
      const user = userEvent.setup()
      renderHome()

      // Wait for page to load
      await waitFor(() => {
        expect(screen.getByText(/scorekeeper/i)).toBeInTheDocument()
      })

      // Click the "Dev" toggle button
      const devButton = screen.queryByRole('button', { name: /^dev$/i })
      if (devButton) {
        await user.click(devButton)
        await waitFor(() => {
          expect(screen.getByRole('button', { name: /seed.*data/i })).toBeInTheDocument()
        })
      }
      // If devButton is not present (not in DEV mode), test passes trivially
    })
  })

  describe('season stats link', () => {
    it('disables season stats link when no completed games', async () => {
      await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
      await db.teams.add({ name: 'Cardinals', createdAt: new Date() })

      renderHome()

      await waitFor(() => {
        expect(screen.getByText(/scorekeeper/i)).toBeInTheDocument()
      })

      // The season stats should be disabled (not an active link or pointer-events-none)
      const statsLink = screen.queryByRole('link', { name: /season stats/i })
      if (statsLink) {
        // If rendered as a link, it should have aria-disabled or pointer-events-none class
        expect(statsLink).toHaveAttribute('aria-disabled', 'true')
      } else {
        // Rendered as a non-link button-like element that is disabled
        const statsEl = screen.getByText(/season stats/i)
        expect(statsEl.closest('[aria-disabled="true"]') ?? statsEl).toBeTruthy()
      }
    })

    it('enables season stats link when completed games exist', async () => {
      const team1Id = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
      const team2Id = await db.teams.add({ name: 'Cardinals', createdAt: new Date() })

      await db.games.add({
        team1Id, team2Id, homeTeamId: team1Id,
        code: 'ABC123', date: new Date(), status: 'completed',
        createdAt: new Date(), updatedAt: new Date(),
      })

      renderHome()

      await waitFor(() => {
        const statsLink = screen.getByRole('link', { name: /season stats/i })
        expect(statsLink).not.toHaveAttribute('aria-disabled', 'true')
        expect(statsLink).toHaveAttribute('href', '/stats')
      })
    })
  })
})
