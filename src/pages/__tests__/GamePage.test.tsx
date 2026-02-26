import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { GameProvider } from '../../contexts/GameContext'
import { GamePage } from '../GamePage'
import { db } from '../../db/database'

async function seedFullGame() {
  const teamId = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
  const gameId = await db.games.add({
    teamId, code: 'TEST01', date: new Date(), opponentName: 'Tigers',
    homeOrAway: 'home', status: 'in_progress', createdAt: new Date(), updatedAt: new Date(),
  })
  await db.lineups.add({
    gameId, side: 'us',
    battingOrder: Array.from({ length: 9 }, (_, i) => ({
      orderPosition: i + 1, playerId: i + 1,
      playerName: `Player${i + 1}`, jerseyNumber: (i + 1) * 10,
      position: ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'][i],
      substitutions: [],
    })),
  })
  await db.lineups.add({
    gameId, side: 'them',
    battingOrder: Array.from({ length: 9 }, (_, i) => ({
      orderPosition: i + 1, playerId: null,
      playerName: `Opp${i + 1}`, jerseyNumber: (i + 1) * 10,
      position: ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'][i],
      substitutions: [],
    })),
  })
  return gameId
}

function renderGame(gameId: number) {
  return render(
    <MemoryRouter initialEntries={[`/game/${gameId}`]}>
      <GameProvider>
        <Routes>
          <Route path="/game/:gameId" element={<GamePage />} />
        </Routes>
      </GameProvider>
    </MemoryRouter>
  )
}

describe('GamePage', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  afterEach(async () => {
    await db.close()
  })

  it('should render scoresheet with player names', async () => {
    const gameId = await seedFullGame()
    renderGame(gameId)

    await waitFor(() => {
      // getAllByText: Player1 may appear in both ScoreSummary (as pitcher) and Scoresheet
      expect(screen.getAllByText('Player1').length).toBeGreaterThan(0)
      expect(screen.getByText('Player9')).toBeInTheDocument()
    })
  })

  it('should render score summary bar', async () => {
    const gameId = await seedFullGame()
    renderGame(gameId)

    await waitFor(() => {
      expect(screen.getByText(/top 1/i)).toBeInTheDocument()
    })
  })

  it('should show record play and undo buttons', async () => {
    const gameId = await seedFullGame()
    renderGame(gameId)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /record play/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument()
    })
  })

  it('should show home/away tabs', async () => {
    const gameId = await seedFullGame()
    renderGame(gameId)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /us/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /them/i })).toBeInTheDocument()
    })
  })
})
