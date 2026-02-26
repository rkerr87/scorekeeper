import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { GameProvider } from '../../contexts/GameContext'
import { HomePage } from '../HomePage'
import { db } from '../../db/database'

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <GameProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/team" element={<div>Team Page</div>} />
          <Route path="/game/:gameId/setup" element={<div>Setup Page</div>} />
        </Routes>
      </GameProvider>
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

  it('should show new game dialog when clicking start new game', async () => {
    const user = userEvent.setup()
    await db.teams.add({ name: 'Mudcats', createdAt: new Date() })

    renderHome()

    await user.click(screen.getByRole('button', { name: /start new game/i }))

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/opponent/i)).toBeInTheDocument()
    })
  })

  it('should redirect to team page if no team exists when starting game', async () => {
    const user = userEvent.setup()
    renderHome()

    await user.click(screen.getByRole('button', { name: /start new game/i }))

    await waitFor(() => {
      expect(screen.getByText('Team Page')).toBeInTheDocument()
    })
  })

  it('should show in-progress games', async () => {
    const teamId = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
    await db.games.add({
      teamId, code: 'ABC123', date: new Date(), opponentName: 'Tigers',
      homeOrAway: 'home', status: 'in_progress', createdAt: new Date(), updatedAt: new Date(),
    })

    renderHome()

    await waitFor(() => {
      expect(screen.getByText(/tigers/i)).toBeInTheDocument()
    })
  })
})
