import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
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

  it('should show correct AB and hit count for Alice (1B)', async () => {
    const gameId = await seedGameWithPlays()
    renderStats(gameId)

    await waitFor(() => {
      const rows = screen.getAllByRole('row')
      const aliceRow = rows.find(r => r.textContent?.includes('Alice'))!
      expect(aliceRow).toBeDefined()
      // Alice went 1-for-1: AVG shows 1.000
      expect(within(aliceRow).getByText('1.000')).toBeInTheDocument()
    })
  })

  it('should show HR=1 and RBI=2 for Bob (home run, scored Alice)', async () => {
    const gameId = await seedGameWithPlays()
    renderStats(gameId)

    await waitFor(() => {
      const rows = screen.getAllByRole('row')
      const bobRow = rows.find(r => r.textContent?.includes('Bob'))!
      expect(bobRow).toBeDefined()
      // Check cells by column index to avoid false matches
      // Column order: Player | AB | R | H | 2B | 3B | HR | RBI | BB | K | AVG
      const cells = within(bobRow).getAllByRole('cell')
      expect(cells[6].textContent).toBe('1') // HR column
      expect(cells[7].textContent).toBe('2') // RBI column
      expect(within(bobRow).getByText('1.000')).toBeInTheDocument()
    })
  })

  it('should credit Alice with R=1 (she scored from Bob\'s HR)', async () => {
    const gameId = await seedGameWithPlays()
    renderStats(gameId)

    await waitFor(() => {
      const rows = screen.getAllByRole('row')
      const aliceRow = rows.find(r => r.textContent?.includes('Alice'))!
      // Alice: AB=1, R=1, H=1 — three cells with value "1"
      const cells = within(aliceRow).getAllByRole('cell')
      const oneCells = cells.filter(c => c.textContent === '1')
      expect(oneCells.length).toBe(3)
    })
  })
})
