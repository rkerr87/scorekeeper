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

    // Home game defaults to "Them" tab (top 1 = visitors batting)
    await waitFor(() => {
      expect(screen.getByText('Opp1')).toBeInTheDocument()
      expect(screen.getByText('Opp9')).toBeInTheDocument()
    })
  })

  it('should render score summary bar', async () => {
    const gameId = await seedFullGame()
    renderGame(gameId)

    await waitFor(() => {
      expect(screen.getByText(/top 1/i)).toBeInTheDocument()
    })
  })

  it('should default to batting team tab on initial load (them for top of 1st in home game)', async () => {
    const gameId = await seedFullGame() // homeOrAway: 'home', so top 1 = them batting
    renderGame(gameId)

    await waitFor(() => {
      // "Them" tab should be active — opponent players visible in scoresheet
      expect(screen.getByText('Opp1')).toBeInTheDocument()
    })

    // "Us" tab should NOT be active — our players should not be in the scoresheet
    // (Player1 may appear in ScoreSummary as pitcher, so check Player2 which is unique)
    expect(screen.queryByText('Player2')).not.toBeInTheDocument()
  })

  it('should show record play and undo buttons', async () => {
    const gameId = await seedFullGame()
    renderGame(gameId)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /record play/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument()
    })
  })

  it('should show home/away tabs with away on left and home on right', async () => {
    const gameId = await seedFullGame() // homeOrAway: 'home', opponent: 'Tigers'
    renderGame(gameId)

    await waitFor(() => {
      // Away tab (opponent) on left, home tab (us) on right
      const awayBtn = screen.getByRole('button', { name: /tigers \(away\)/i })
      const homeBtn = screen.getByRole('button', { name: /us \(home\)/i })
      expect(awayBtn).toBeInTheDocument()
      expect(homeBtn).toBeInTheDocument()
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
    // Switch to "Us (Home)" tab (viewing our scoresheet)
    await user.click(screen.getByRole('button', { name: /us \(home\)/i }))

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
    // Use shorthand to record a strikeout (K button removed from outcome grid)
    await user.type(screen.getByPlaceholderText(/shorthand/i), 'K')
    await user.click(screen.getByRole('button', { name: /^enter$/i }))
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

  it('should show a persistent back-to-home link in the header', async () => {
    const gameId = await seedFullGame()
    renderGame(gameId)

    await waitFor(() => {
      const backLink = screen.getByRole('button', { name: /back to home/i })
      expect(backLink).toBeInTheDocument()
      expect(backLink).toHaveTextContent('← Home')
    })
  })

  it('should show a Home button on the game-over overlay', async () => {
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
      // Home button should exist between View Stats and Back to scoresheet
      expect(screen.getByRole('button', { name: /^home$/i })).toBeInTheDocument()
    })
  })

  it('should preserve pitch tracking when play entry panel is closed and reopened', async () => {
    const user = userEvent.setup()
    const gameId = await seedFullGame()
    renderGame(gameId)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /record play/i })).toBeInTheDocument()
    })

    // Open play entry panel and add a ball
    await user.click(screen.getByRole('button', { name: /record play/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ball/i })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /ball/i }))

    // Verify count shows 1-0
    expect(screen.getByText('1-0')).toBeInTheDocument()
    expect(screen.getByText('1 pitches')).toBeInTheDocument()

    // Close the panel
    await user.click(screen.getByText('\u00D7'))

    // Panel should be gone
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /ball/i })).not.toBeInTheDocument()
    })

    // Reopen the panel
    await user.click(screen.getByRole('button', { name: /record play/i }))

    // Pitch count should be preserved
    await waitFor(() => {
      expect(screen.getByText('1-0')).toBeInTheDocument()
      expect(screen.getByText('1 pitches')).toBeInTheDocument()
    })
  })

  it('auto-records walk after 4th ball', async () => {
    const user = userEvent.setup()
    const gameId = await seedFullGame()
    renderGame(gameId)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /record play/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /record play/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^ball$/i })).toBeInTheDocument()
    })

    // Click Ball 4 times
    for (let i = 0; i < 4; i++) {
      await user.click(screen.getByRole('button', { name: /^ball$/i }))
    }

    // Panel should close (play auto-recorded as BB)
    await waitFor(() => {
      expect(screen.queryByText('At bat:')).not.toBeInTheDocument()
    })

    // Beginner guide should show walk info
    await waitFor(() => {
      expect(screen.getByText(/walk/i)).toBeInTheDocument()
    })
  })

  it('shows K vs KL confirmation after 3rd strike', async () => {
    const user = userEvent.setup()
    const gameId = await seedFullGame()
    renderGame(gameId)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /record play/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /record play/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^strike$/i })).toBeInTheDocument()
    })

    // Click Strike 3 times
    for (let i = 0; i < 3; i++) {
      await user.click(screen.getByRole('button', { name: /^strike$/i }))
    }

    // Should show confirmation dialog
    await waitFor(() => {
      expect(screen.getByText(/swinging or looking/i)).toBeInTheDocument()
    })
  })

  it('does not auto-strikeout on foul with 2 strikes', async () => {
    const user = userEvent.setup()
    const gameId = await seedFullGame()
    renderGame(gameId)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /record play/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /record play/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^strike$/i })).toBeInTheDocument()
    })

    // 2 strikes then a foul
    await user.click(screen.getByRole('button', { name: /^strike$/i }))
    await user.click(screen.getByRole('button', { name: /^strike$/i }))
    await user.click(screen.getByRole('button', { name: /^foul$/i }))

    // Should NOT show confirmation (foul doesn't trigger it)
    expect(screen.queryByText(/swinging or looking/i)).not.toBeInTheDocument()
  })

  it('records swinging strikeout when K (Swinging) is clicked in confirmation', async () => {
    const user = userEvent.setup()
    const gameId = await seedFullGame()
    renderGame(gameId)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /record play/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /record play/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^strike$/i })).toBeInTheDocument()
    })

    // 3 strikes
    for (let i = 0; i < 3; i++) {
      await user.click(screen.getByRole('button', { name: /^strike$/i }))
    }

    // Wait for confirmation dialog
    await waitFor(() => {
      expect(screen.getByText(/swinging or looking/i)).toBeInTheDocument()
    })

    // Click K (Swinging)
    await user.click(screen.getByRole('button', { name: /swinging/i }))

    // Confirmation dialog should close, play entry should close
    await waitFor(() => {
      expect(screen.queryByText(/swinging or looking/i)).not.toBeInTheDocument()
      expect(screen.queryByText('At bat:')).not.toBeInTheDocument()
    })

    // Beginner guide should show strikeout info
    await waitFor(() => {
      expect(screen.getByText(/strikeout/i)).toBeInTheDocument()
    })
  })

  it('records looking strikeout when KL (Looking) is clicked in confirmation', async () => {
    const user = userEvent.setup()
    const gameId = await seedFullGame()
    renderGame(gameId)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /record play/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /record play/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^strike$/i })).toBeInTheDocument()
    })

    // 3 strikes
    for (let i = 0; i < 3; i++) {
      await user.click(screen.getByRole('button', { name: /^strike$/i }))
    }

    // Wait for confirmation dialog
    await waitFor(() => {
      expect(screen.getByText(/swinging or looking/i)).toBeInTheDocument()
    })

    // Click KL (Looking) - use exact text to avoid matching "Strikeout looking" aria-label
    await user.click(screen.getByRole('button', { name: /\(looking\)/i }))

    // Confirmation dialog should close, play entry should close
    await waitFor(() => {
      expect(screen.queryByText(/swinging or looking/i)).not.toBeInTheDocument()
      expect(screen.queryByText('At bat:')).not.toBeInTheDocument()
    })

    // Beginner guide should show strikeout info
    await waitFor(() => {
      expect(screen.getByText(/strikeout/i)).toBeInTheDocument()
    })
  })

  it('should show play detail popover when clicking a filled cell', async () => {
    const user = userEvent.setup()
    const gameId = await seedFullGame()

    // Seed one completed play (1B in top of 1st, batter position 1)
    // Using 1B instead of K to avoid text ambiguity with K stat header
    await db.plays.add({
      gameId, sequenceNumber: 1, inning: 1, half: 'top',
      batterOrderPosition: 1,
      playType: '1B', notation: '1B',
      fieldersInvolved: [7], basesReached: [1], runsScoredOnPlay: 0,
      rbis: 0, pitches: ['B', 'S', 'B'], isAtBat: true, timestamp: new Date(),
    })

    renderGame(gameId)

    // Wait for game to load — game is 'home', so top half = opponent batting
    // The tab auto-defaults to the batting team now, but click opponent tab to be explicit
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /tigers/i })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /tigers/i }))

    // Find cells with plays — the filled cell will contain the Diamond SVG
    await waitFor(() => {
      const cells = screen.getAllByTestId('atbat-cell')
      expect(cells.some(cell => cell.querySelector('svg'))).toBe(true)
    })

    // Click the filled cell (the one with an SVG diamond inside)
    const cells = screen.getAllByTestId('atbat-cell')
    const filledCell = cells.find(cell => cell.querySelector('svg'))!
    await user.click(filledCell)

    // Verify PlayDetailPopover appears with play notation and count text
    // PlayDetailPopover renders: notation as large text + "Count: B-S (N pitches)"
    // With pitches ['B', 'S', 'B']: balls=2, strikes=1 → "Count: 2-1 (3 pitches)"
    await waitFor(() => {
      expect(screen.getByText(/Count: 2-1 \(3 pitches\)/)).toBeInTheDocument()
    })

    // Also verify the Edit and Undo buttons from the popover are present
    // Note: "Undo" button also exists in the bottom action bar, so use getAllByRole
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /undo/i }).length).toBeGreaterThanOrEqual(2)
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

    // Record the 3rd out (K) via shorthand — K button removed from outcome grid
    await user.click(screen.getByRole('button', { name: /record play/i }))
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/shorthand/i)).toBeInTheDocument()
    })
    await user.type(screen.getByPlaceholderText(/shorthand/i), 'K')
    await user.click(screen.getByRole('button', { name: /^enter$/i }))

    // After 3rd out: top half ends, game moves to Bot 1 (us bats — home team)
    // Toast should appear (text includes both "Side retired" and "Bot 1")
    await waitFor(() => {
      expect(screen.getByText(/side retired — bot 1/i)).toBeInTheDocument()
    })
  })
})
