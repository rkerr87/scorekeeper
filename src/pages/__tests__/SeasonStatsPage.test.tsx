import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SeasonStatsPage } from '../SeasonStatsPage'
import { db } from '../../db/database'

function renderPage() {
  return render(
    <MemoryRouter>
      <SeasonStatsPage />
    </MemoryRouter>
  )
}

describe('SeasonStatsPage', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  afterEach(async () => {
    await db.close()
  })

  it('should show empty state when team has no games', async () => {
    await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/no games played yet/i)).toBeInTheDocument()
    })
  })

  it('should show player stats after one game', async () => {
    // Mudcats (home) vs Tigers (away) — Mudcats bat bottom
    const mudcatsId = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
    const tigersId = await db.teams.add({ name: 'Tigers', createdAt: new Date() })
    const aliceId = await db.players.add({
      teamId: mudcatsId, name: 'Alice', jerseyNumber: 7, defaultPosition: 'P', createdAt: new Date(),
    })
    const gameId = await db.games.add({
      team1Id: mudcatsId, team2Id: tigersId, homeTeamId: mudcatsId,
      code: 'TEST01', date: new Date(),
      status: 'completed', createdAt: new Date(), updatedAt: new Date(),
    })
    await db.lineups.add({
      gameId, side: 'home',
      battingOrder: [
        { orderPosition: 1, playerId: aliceId, playerName: 'Alice', jerseyNumber: 7, position: 'P', substitutions: [] },
      ],
    })
    await db.lineups.add({
      gameId, side: 'away',
      battingOrder: [
        { orderPosition: 1, playerId: 9999, playerName: 'Opp', jerseyNumber: 1, position: 'P', substitutions: [] },
      ],
    })
    // Alice bats bottom half (home team)
    await db.plays.add({
      gameId, sequenceNumber: 1, inning: 1, half: 'bottom', batterOrderPosition: 1,
      playType: '1B', notation: '1B', fieldersInvolved: [], basesReached: [1],
      runsScoredOnPlay: 0, rbis: 0, pitches: [], isAtBat: true, timestamp: new Date(),
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.getByRole('columnheader', { name: 'AB' })).toBeInTheDocument()
      // Alice had one at-bat
      const rows = screen.getAllByRole('row')
      const aliceRow = rows.find(r => r.textContent?.includes('Alice'))!
      const cells = within(aliceRow).getAllByRole('cell')
      expect(cells[2].textContent).toBe('1') // AB column (index 2)
    })
  })

  it('should aggregate stats across two games (H: 2 total)', async () => {
    const mudcatsId = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
    const tigersId = await db.teams.add({ name: 'Tigers', createdAt: new Date() })
    const aliceId = await db.players.add({
      teamId: mudcatsId, name: 'Alice', jerseyNumber: 7, defaultPosition: 'P', createdAt: new Date(),
    })

    // Game 1: Alice hits a single
    const game1Id = await db.games.add({
      team1Id: mudcatsId, team2Id: tigersId, homeTeamId: mudcatsId,
      code: 'G1', date: new Date(), status: 'completed', createdAt: new Date(), updatedAt: new Date(),
    })
    await db.lineups.add({
      gameId: game1Id, side: 'home',
      battingOrder: [
        { orderPosition: 1, playerId: aliceId, playerName: 'Alice', jerseyNumber: 7, position: 'P', substitutions: [] },
      ],
    })
    await db.lineups.add({
      gameId: game1Id, side: 'away',
      battingOrder: [
        { orderPosition: 1, playerId: 9999, playerName: 'Opp', jerseyNumber: 1, position: 'P', substitutions: [] },
      ],
    })
    await db.plays.add({
      gameId: game1Id, sequenceNumber: 1, inning: 1, half: 'bottom', batterOrderPosition: 1,
      playType: '1B', notation: '1B', fieldersInvolved: [], basesReached: [1],
      runsScoredOnPlay: 0, rbis: 0, pitches: [], isAtBat: true, timestamp: new Date(),
    })

    // Game 2: Alice hits another single
    const game2Id = await db.games.add({
      team1Id: mudcatsId, team2Id: tigersId, homeTeamId: mudcatsId,
      code: 'G2', date: new Date(), status: 'completed', createdAt: new Date(), updatedAt: new Date(),
    })
    await db.lineups.add({
      gameId: game2Id, side: 'home',
      battingOrder: [
        { orderPosition: 1, playerId: aliceId, playerName: 'Alice', jerseyNumber: 7, position: 'P', substitutions: [] },
      ],
    })
    await db.lineups.add({
      gameId: game2Id, side: 'away',
      battingOrder: [
        { orderPosition: 1, playerId: 9999, playerName: 'Opp', jerseyNumber: 1, position: 'P', substitutions: [] },
      ],
    })
    await db.plays.add({
      gameId: game2Id, sequenceNumber: 1, inning: 1, half: 'bottom', batterOrderPosition: 1,
      playType: '1B', notation: '1B', fieldersInvolved: [], basesReached: [1],
      runsScoredOnPlay: 0, rbis: 0, pitches: [], isAtBat: true, timestamp: new Date(),
    })

    renderPage()

    await waitFor(() => {
      const rows = screen.getAllByRole('row')
      const aliceRow = rows.find(r => r.textContent?.includes('Alice'))!
      expect(aliceRow).toBeDefined()
      // Column order: Player(0) | G(1) | AB(2) | R(3) | H(4) | 2B | 3B | HR | RBI | BB | K | AVG | OBP | SLG
      const cells = within(aliceRow).getAllByRole('cell')
      expect(cells[1].textContent).toBe('2') // G column (2 games)
      expect(cells[4].textContent).toBe('2') // H column (2 hits)
    })
  })

  it('should show team selector when multiple teams exist', async () => {
    await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
    await db.teams.add({ name: 'Tigers', createdAt: new Date() })
    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Mudcats' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Tigers' })).toBeInTheDocument()
    })
    // Wait for loadStats to finish (no games → shows empty state) before cleanup
    await waitFor(() => {
      expect(screen.getByText(/no games played yet/i)).toBeInTheDocument()
    })
  })
})
