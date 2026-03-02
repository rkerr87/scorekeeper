import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { GameProvider } from '../../contexts/GameContext'
import { GameStatsPage } from '../GameStatsPage'
import { db } from '../../db/database'

async function seedGameWithPlays() {
  const homeTeamId = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
  const awayTeamId = await db.teams.add({ name: 'Tigers', createdAt: new Date() })
  const gameId = await db.games.add({
    team1Id: homeTeamId, team2Id: awayTeamId, homeTeamId,
    code: 'TEST01', date: new Date(),
    status: 'completed', createdAt: new Date(), updatedAt: new Date(),
  })
  // Away team lineup (Tigers bat top)
  await db.lineups.add({
    gameId, side: 'away',
    battingOrder: [
      { orderPosition: 1, playerId: 101, playerName: 'Alice', jerseyNumber: 1, position: 'P', substitutions: [] },
      { orderPosition: 2, playerId: 102, playerName: 'Bob', jerseyNumber: 2, position: 'C', substitutions: [] },
    ],
  })
  // Home team lineup (Mudcats bat bottom)
  await db.lineups.add({
    gameId, side: 'home',
    battingOrder: [
      { orderPosition: 1, playerId: 201, playerName: 'Carol', jerseyNumber: 10, position: 'P', substitutions: [] },
    ],
  })
  // Away team plays (top half)
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

  it('should display game info with both team names', async () => {
    const gameId = await seedGameWithPlays()
    renderStats(gameId)

    await waitFor(() => {
      expect(screen.getByText(/Tigers vs Mudcats/)).toBeInTheDocument()
    })
  })

  it('should display player stats for both teams', async () => {
    const gameId = await seedGameWithPlays()
    renderStats(gameId)

    await waitFor(() => {
      // Away team players
      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.getByText('Bob')).toBeInTheDocument()
      // Home team players
      expect(screen.getByText('Carol')).toBeInTheDocument()
    })
  })

  it('should show away and home team section headers', async () => {
    const gameId = await seedGameWithPlays()
    renderStats(gameId)

    await waitFor(() => {
      expect(screen.getByText('Tigers (Away)')).toBeInTheDocument()
      expect(screen.getByText('Mudcats (Home)')).toBeInTheDocument()
    })
  })
})
