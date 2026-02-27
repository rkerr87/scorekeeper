import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('should disable Record Play when game is over', async () => {
    const gameId = await seedFullGame()
    // Add 18 outs worth of plays (3 outs × 6 innings × 2 halves) to end the game
    const plays = []
    let seq = 1
    for (let inning = 1; inning <= 6; inning++) {
      for (const half of ['top', 'bottom'] as const) {
        for (let out = 0; out < 3; out++) {
          plays.push({
            gameId, sequenceNumber: seq++, inning, half,
            batterOrderPosition: ((seq - 1) % 9) + 1,
            playType: 'K' as const, notation: 'K',
            fieldersInvolved: [], basesReached: [], runsScoredOnPlay: 0,
            rbis: 0, pitches: [], isAtBat: true, timestamp: new Date(),
          })
        }
      }
    }
    await db.plays.bulkAdd(plays)

    renderGame(gameId)

    await waitFor(() => {
      const recordBtn = screen.getByRole('button', { name: /record play/i })
      expect(recordBtn).toBeDisabled()
    })
  })

  it('should show actual batting team batter in play entry panel, not the viewed tab batter', async () => {
    const user = userEvent.setup()
    const gameId = await seedFullGame()
    renderGame(gameId)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /record play/i })).toBeInTheDocument()
    })

    // Game starts with top half (opponents batting, game is 'home')
    // Switch to "Us" tab (viewing our scoresheet)
    await user.click(screen.getByRole('button', { name: /us/i }))

    // Open play entry panel — should show the actual current batter (Opp1, opponent batting top)
    await user.click(screen.getByRole('button', { name: /record play/i }))

    await waitFor(() => {
      // Opp1 is the actual current batter (top half = opponent bats when we're home)
      expect(screen.getByText('Opp1')).toBeInTheDocument()
    })
  })

  it('should show beginner guide card after a play is recorded', async () => {
    const user = userEvent.setup()
    const gameId = await seedFullGame()
    renderGame(gameId)
    await waitFor(() => expect(screen.queryByText('Loading game...')).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /record play/i }))
    await user.click(screen.getByRole('button', { name: /^K$/i }))
    expect(screen.getByText(/strikeout/i)).toBeInTheDocument()
  })

  it('should show game-over overlay when snapshot.isGameOver is true', async () => {
    const gameId = await seedFullGame()
    // Add 18 outs worth of plays (3 outs × 6 innings × 2 halves) to end the game
    const plays = []
    let seq = 1
    for (let inning = 1; inning <= 6; inning++) {
      for (const half of ['top', 'bottom'] as const) {
        for (let out = 0; out < 3; out++) {
          plays.push({
            gameId, sequenceNumber: seq++, inning, half,
            batterOrderPosition: ((seq - 1) % 9) + 1,
            playType: 'K' as const, notation: 'K',
            fieldersInvolved: [], basesReached: [], runsScoredOnPlay: 0,
            rbis: 0, pitches: [], isAtBat: true, timestamp: new Date(),
          })
        }
      }
    }
    await db.plays.bulkAdd(plays)

    renderGame(gameId)

    await waitFor(() => {
      expect(screen.getByText('Game Over')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /view stats/i })).toBeInTheDocument()
    })
  })

  it('should dismiss game-over overlay when Back to scoresheet is clicked', async () => {
    const user = userEvent.setup()
    const gameId = await seedFullGame()
    // Add 18 outs worth of plays to end the game
    const plays = []
    let seq = 1
    for (let inning = 1; inning <= 6; inning++) {
      for (const half of ['top', 'bottom'] as const) {
        for (let out = 0; out < 3; out++) {
          plays.push({
            gameId, sequenceNumber: seq++, inning, half,
            batterOrderPosition: ((seq - 1) % 9) + 1,
            playType: 'K' as const, notation: 'K',
            fieldersInvolved: [], basesReached: [], runsScoredOnPlay: 0,
            rbis: 0, pitches: [], isAtBat: true, timestamp: new Date(),
          })
        }
      }
    }
    await db.plays.bulkAdd(plays)

    renderGame(gameId)

    await waitFor(() => {
      expect(screen.getByText('Game Over')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /back to scoresheet/i }))

    await waitFor(() => {
      expect(screen.queryByText('Game Over')).not.toBeInTheDocument()
    })
  })

  it('should show toast and auto-switch tab to Us after top half ends (home game)', async () => {
    const user = userEvent.setup()
    const gameId = await seedFullGame()

    // Seed 2 outs already in top half (them batting — game is 'home')
    await db.plays.bulkAdd([
      {
        gameId, sequenceNumber: 1, inning: 1, half: 'top',
        batterOrderPosition: 1,
        playType: 'K', notation: 'K',
        fieldersInvolved: [], basesReached: [], runsScoredOnPlay: 0,
        rbis: 0, pitches: [], isAtBat: true, timestamp: new Date(),
      },
      {
        gameId, sequenceNumber: 2, inning: 1, half: 'top',
        batterOrderPosition: 2,
        playType: 'K', notation: 'K',
        fieldersInvolved: [], basesReached: [], runsScoredOnPlay: 0,
        rbis: 0, pitches: [], isAtBat: true, timestamp: new Date(),
      },
    ])

    renderGame(gameId)

    // Wait for game to load (2 outs showing)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /record play/i })).toBeInTheDocument()
    })

    // Record the 3rd out (K) via the play entry panel — no runners on base so no confirmation step
    await user.click(screen.getByRole('button', { name: /record play/i }))
    await waitFor(() => {
      // Panel is open — K button visible
      expect(screen.getByRole('button', { name: 'K' })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: 'K' }))

    // After 3rd out: top half ends, game moves to Bot 1 (us bats — home team)
    // Toast should appear (text includes both "Side retired" and "Bot 1")
    await waitFor(() => {
      expect(screen.getByText(/side retired — bot 1/i)).toBeInTheDocument()
    })
  })
})
