import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { GameProvider } from '../../contexts/GameContext'
import { GameSetupPage } from '../GameSetupPage'
import { db } from '../../db/database'

async function seedTwoTeamsAndGame() {
  const homeTeamId = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
  const awayTeamId = await db.teams.add({ name: 'Tigers', createdAt: new Date() })

  await db.players.bulkAdd([
    { teamId: homeTeamId, name: 'Alice', jerseyNumber: 1, defaultPosition: 'P', createdAt: new Date() },
    { teamId: homeTeamId, name: 'Bob', jerseyNumber: 2, defaultPosition: 'C', createdAt: new Date() },
    { teamId: homeTeamId, name: 'Charlie', jerseyNumber: 3, defaultPosition: '1B', createdAt: new Date() },
  ])

  await db.players.bulkAdd([
    { teamId: awayTeamId, name: 'Dave', jerseyNumber: 10, defaultPosition: 'P', createdAt: new Date() },
    { teamId: awayTeamId, name: 'Eve', jerseyNumber: 11, defaultPosition: 'C', createdAt: new Date() },
    { teamId: awayTeamId, name: 'Frank', jerseyNumber: 12, defaultPosition: 'SS', createdAt: new Date() },
  ])

  const gameId = await db.games.add({
    team1Id: homeTeamId,
    team2Id: awayTeamId,
    homeTeamId: homeTeamId,
    code: 'TEST01',
    date: new Date(),
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  return gameId
}

function renderSetup(gameId: number) {
  return render(
    <MemoryRouter initialEntries={[`/game/${gameId}/setup`]}>
      <GameProvider>
        <Routes>
          <Route path="/game/:gameId/setup" element={<GameSetupPage />} />
          <Route path="/game/:gameId" element={<div>Game Page</div>} />
        </Routes>
      </GameProvider>
    </MemoryRouter>
  )
}

describe('GameSetupPage', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  afterEach(async () => {
    await db.close()
  })

  it('should display both teams players for lineup selection', async () => {
    const gameId = await seedTwoTeamsAndGame()
    renderSetup(gameId)

    await waitFor(() => {
      // Home team players
      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.getByText('Bob')).toBeInTheDocument()
      expect(screen.getByText('Charlie')).toBeInTheDocument()
      // Away team players
      expect(screen.getByText('Dave')).toBeInTheDocument()
      expect(screen.getByText('Eve')).toBeInTheDocument()
      expect(screen.getByText('Frank')).toBeInTheDocument()
    })
  })

  it('should show team names with home/away labels', async () => {
    const gameId = await seedTwoTeamsAndGame()
    renderSetup(gameId)

    await waitFor(() => {
      expect(screen.getByText(/Mudcats \(Home\) Batting Order/)).toBeInTheDocument()
      expect(screen.getByText(/Tigers \(Away\) Batting Order/)).toBeInTheDocument()
    })
  })

  it('should not have opponent inline entry form', async () => {
    const gameId = await seedTwoTeamsAndGame()
    renderSetup(gameId)

    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument())

    expect(screen.queryByPlaceholderText(/opponent name/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add opponent/i })).not.toBeInTheDocument()
  })

  it('should enable Start Game button when both batting orders have players', async () => {
    const gameId = await seedTwoTeamsAndGame()
    renderSetup(gameId)
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument())
    const startBtn = screen.getByRole('button', { name: /start game/i })
    expect(startBtn).not.toBeDisabled()
  })

  it('should render drag handles for each player in both batting orders', async () => {
    const gameId = await seedTwoTeamsAndGame()
    renderSetup(gameId)
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument())
    const handles = screen.getAllByRole('button', { name: /drag to reorder/i })
    // 3 home + 3 away = 6 drag handles
    expect(handles).toHaveLength(6)
  })

  it('should not render up/down arrow buttons', async () => {
    const gameId = await seedTwoTeamsAndGame()
    renderSetup(gameId)
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /move up/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /move down/i })).not.toBeInTheDocument()
  })

  it('should save both lineups and navigate to game page on Start Game', async () => {
    const user = userEvent.setup()
    const gameId = await seedTwoTeamsAndGame()
    renderSetup(gameId)

    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument())

    const startBtn = screen.getByRole('button', { name: /start game/i })
    await user.click(startBtn)

    await waitFor(() => {
      expect(screen.getByText('Game Page')).toBeInTheDocument()
    })

    // Verify both lineups were saved
    const lineups = await db.lineups.where('gameId').equals(gameId).toArray()
    expect(lineups).toHaveLength(2)

    const homeSide = lineups.find(l => l.side === 'home')
    const awaySide = lineups.find(l => l.side === 'away')
    expect(homeSide).toBeDefined()
    expect(awaySide).toBeDefined()
    expect(homeSide!.battingOrder).toHaveLength(3)
    expect(awaySide!.battingOrder).toHaveLength(3)

    // Verify home team players
    const homeNames = homeSide!.battingOrder.map(s => s.playerName)
    expect(homeNames).toContain('Alice')
    expect(homeNames).toContain('Bob')
    expect(homeNames).toContain('Charlie')

    // Verify away team players
    const awayNames = awaySide!.battingOrder.map(s => s.playerName)
    expect(awayNames).toContain('Dave')
    expect(awayNames).toContain('Eve')
    expect(awayNames).toContain('Frank')

    // Verify game status updated to in_progress
    const game = await db.games.get(gameId)
    expect(game?.status).toBe('in_progress')
  })

  it('should correctly identify home vs away when team2 is home', async () => {
    const team1Id = await db.teams.add({ name: 'Eagles', createdAt: new Date() })
    const team2Id = await db.teams.add({ name: 'Hawks', createdAt: new Date() })

    await db.players.bulkAdd([
      { teamId: team1Id, name: 'Player1', jerseyNumber: 1, defaultPosition: 'P', createdAt: new Date() },
    ])
    await db.players.bulkAdd([
      { teamId: team2Id, name: 'Player2', jerseyNumber: 2, defaultPosition: 'C', createdAt: new Date() },
    ])

    const gameId = await db.games.add({
      team1Id,
      team2Id,
      homeTeamId: team2Id, // team2 is home
      code: 'TEST02',
      date: new Date(),
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    renderSetup(gameId)

    await waitFor(() => {
      // Hawks is home (team2), Eagles is away (team1)
      expect(screen.getByText(/Hawks \(Home\) Batting Order/)).toBeInTheDocument()
      expect(screen.getByText(/Eagles \(Away\) Batting Order/)).toBeInTheDocument()
    })
  })
})
