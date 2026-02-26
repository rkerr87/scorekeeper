import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { GameProvider } from '../../contexts/GameContext'
import { GameStatsPage } from '../GameStatsPage'
import { db } from '../../db/database'

async function seedGameWithPlays() {
  const teamId = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
  const gameId = await db.games.add({
    teamId, code: 'TEST01', date: new Date(), opponentName: 'Tigers',
    // us is away → us bats top, matching the half: 'top' plays below
    homeOrAway: 'away', status: 'completed', createdAt: new Date(), updatedAt: new Date(),
  })
  await db.lineups.add({
    gameId, side: 'us',
    battingOrder: [
      { orderPosition: 1, playerId: 1, playerName: 'Alice', jerseyNumber: 1, position: 'P', substitutions: [] },
      { orderPosition: 2, playerId: 2, playerName: 'Bob', jerseyNumber: 2, position: 'C', substitutions: [] },
    ],
  })
  await db.lineups.add({
    gameId, side: 'them',
    battingOrder: [
      { orderPosition: 1, playerId: null, playerName: 'Opp1', jerseyNumber: 10, position: 'P', substitutions: [] },
    ],
  })
  await db.plays.add({
    gameId, sequenceNumber: 1, inning: 1, half: 'top', batterOrderPosition: 1,
    playType: '1B', notation: '1B', fieldersInvolved: [], basesReached: [1],
    runsScoredOnPlay: 0, rbis: 0, pitches: ['B', 'S', 'B'], isAtBat: true, timestamp: new Date(),
  })
  await db.plays.add({
    gameId, sequenceNumber: 2, inning: 1, half: 'top', batterOrderPosition: 2,
    playType: 'HR', notation: 'HR', fieldersInvolved: [], basesReached: [1, 2, 3, 4],
    runsScoredOnPlay: 2, rbis: 2, pitches: ['S', 'B', 'S'], isAtBat: true, timestamp: new Date(),
  })
  return gameId
}

function renderStats(gameId: number) {
  return render(
    <MemoryRouter initialEntries={[`/game/${gameId}/stats`]}>
      <GameProvider>
        <Routes>
          <Route path="/game/:gameId/stats" element={<GameStatsPage />} />
        </Routes>
      </GameProvider>
    </MemoryRouter>
  )
}

describe('GameStatsPage', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  afterEach(async () => {
    await db.close()
  })

  it('should display game info', async () => {
    const gameId = await seedGameWithPlays()
    renderStats(gameId)

    await waitFor(() => {
      expect(screen.getByText(/tigers/i)).toBeInTheDocument()
    })
  })

  it('should display player stats', async () => {
    const gameId = await seedGameWithPlays()
    renderStats(gameId)

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.getByText('Bob')).toBeInTheDocument()
    })
  })
})
