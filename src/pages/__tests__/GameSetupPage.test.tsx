import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { GameProvider } from '../../contexts/GameContext'
import { GameSetupPage } from '../GameSetupPage'
import { db } from '../../db/database'

async function seedTeamAndGame() {
  const teamId = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
  await db.players.bulkAdd([
    { teamId, name: 'Alice', jerseyNumber: 1, defaultPosition: 'P', createdAt: new Date() },
    { teamId, name: 'Bob', jerseyNumber: 2, defaultPosition: 'C', createdAt: new Date() },
    { teamId, name: 'Charlie', jerseyNumber: 3, defaultPosition: '1B', createdAt: new Date() },
  ])
  const gameId = await db.games.add({
    teamId,
    code: 'TEST01',
    date: new Date(),
    opponentName: 'Tigers',
    homeOrAway: 'home',
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

  it('should display team players for lineup selection', async () => {
    const gameId = await seedTeamAndGame()
    renderSetup(gameId)

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.getByText('Bob')).toBeInTheDocument()
      expect(screen.getByText('Charlie')).toBeInTheDocument()
    })
  })

  it('should show opponent lineup entry', async () => {
    const gameId = await seedTeamAndGame()
    renderSetup(gameId)

    await waitFor(() => {
      expect(screen.getByText(/opponent lineup/i)).toBeInTheDocument()
    })
  })

  it('should enable Start Game button when batting order exists but no opponents entered', async () => {
    const gameId = await seedTeamAndGame()
    renderSetup(gameId)
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument())
    const startBtn = screen.getByRole('button', { name: /start game/i })
    expect(startBtn).not.toBeDisabled()
  })

  it('should allow adding an opponent player', async () => {
    const user = userEvent.setup()
    const gameId = await seedTeamAndGame()
    renderSetup(gameId)

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/opponent name/i)).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText(/opponent name/i), 'Smith')
    await user.type(screen.getByPlaceholderText(/opp #/i), '15')
    await user.type(screen.getByPlaceholderText(/opp pos/i), 'SS')
    await user.click(screen.getByRole('button', { name: /add opponent/i }))

    await waitFor(() => {
      expect(screen.getByText('Smith')).toBeInTheDocument()
    })
  })

  it('should render drag handles for each player in the batting order', async () => {
    const gameId = await seedTeamAndGame()
    renderSetup(gameId)
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument())
    const handles = screen.getAllByRole('button', { name: /drag to reorder/i })
    expect(handles.length).toBeGreaterThan(0)
  })

  it('should not render up/down arrow buttons', async () => {
    const gameId = await seedTeamAndGame()
    renderSetup(gameId)
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /move up/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /move down/i })).not.toBeInTheDocument()
  })
})
