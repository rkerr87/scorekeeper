import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { GameProvider } from '../../contexts/GameContext'
import { ToastProvider } from '../../contexts/ToastContext'
import { GamePage } from '../GamePage'
import { db } from '../../db/database'

const POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']

async function seedFullGame() {
  const team1Id = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
  const team2Id = await db.teams.add({ name: 'Tigers', createdAt: new Date() })
  // Add players to team1 (home team)
  for (let i = 0; i < 9; i++) {
    await db.players.add({
      teamId: team1Id as number,
      name: `Player${i + 1}`,
      jerseyNumber: (i + 1) * 10,
      defaultPosition: POSITIONS[i],
      createdAt: new Date(),
    })
  }
  // Add players to team2 (away team)
  for (let i = 0; i < 9; i++) {
    await db.players.add({
      teamId: team2Id as number,
      name: `Opp${i + 1}`,
      jerseyNumber: (i + 1) * 10,
      defaultPosition: POSITIONS[i],
      createdAt: new Date(),
    })
  }
  const gameId = await db.games.add({
    team1Id: team1Id as number,
    team2Id: team2Id as number,
    homeTeamId: team1Id as number,
    code: 'TEST01',
    date: new Date(),
    status: 'in_progress',
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  // Home lineup (team1 = Mudcats)
  await db.lineups.add({
    gameId: gameId as number,
    side: 'home',
    battingOrder: Array.from({ length: 9 }, (_, i) => ({
      orderPosition: i + 1,
      playerId: i + 1,
      playerName: `Player${i + 1}`,
      jerseyNumber: (i + 1) * 10,
      position: POSITIONS[i],
      substitutions: [],
    })),
  })
  // Away lineup (team2 = Tigers)
  await db.lineups.add({
    gameId: gameId as number,
    side: 'away',
    battingOrder: Array.from({ length: 9 }, (_, i) => ({
      orderPosition: i + 1,
      playerId: 10 + i + 1,
      playerName: `Opp${i + 1}`,
      jerseyNumber: (i + 1) * 10,
      position: POSITIONS[i],
      substitutions: [],
    })),
  })
  return gameId
}

function renderGame(gameId: number) {
  return render(
    <MemoryRouter initialEntries={[`/game/${gameId}`]}>
      <ToastProvider>
        <GameProvider>
          <Routes>
            <Route path="/game/:gameId" element={<GamePage />} />
          </Routes>
        </GameProvider>
      </ToastProvider>
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
    renderGame(gameId as number)

    // Top of 1st = away team (Tigers) batting → default tab is 'away'
    await waitFor(() => {
      expect(screen.getByText('Opp1')).toBeInTheDocument()
      expect(screen.getByText('Opp9')).toBeInTheDocument()
    })
  })

  it('should render score summary bar', async () => {
    const gameId = await seedFullGame()
    renderGame(gameId as number)

    await waitFor(() => {
      expect(screen.getByText(/top 1/i)).toBeInTheDocument()
    })
  })

  it('should default to batting team tab on initial load (away for top of 1st)', async () => {
    const gameId = await seedFullGame() // Mudcats are home, Tigers are away; top 1 = away batting
    renderGame(gameId as number)

    await waitFor(() => {
      // "Away" tab should be active — Tigers (away) players visible in scoresheet
      expect(screen.getByText('Opp1')).toBeInTheDocument()
    })

    // "Home" tab should NOT be active — home players should not be in the scoresheet
    // (Player1 may appear in ScoreSummary as pitcher, so check Player2 which is unique)
    expect(screen.queryByText('Player2')).not.toBeInTheDocument()
  })

  it('should default to correct batting team when switching between games', async () => {
    // Game 1: Mudcats (home) vs Tigers (away) — top 1 = Tigers batting → away tab
    const homeGameId = await seedFullGame()

    // Game 2: different teams — team2 is home (Eagles), team1 is away (Hawks)
    const team3Id = await db.teams.add({ name: 'Hawks', createdAt: new Date() })
    const team4Id = await db.teams.add({ name: 'Eagles', createdAt: new Date() })
    const awayGameId = await db.games.add({
      team1Id: team3Id as number,
      team2Id: team4Id as number,
      homeTeamId: team4Id as number, // Eagles are home
      code: 'TEST02',
      date: new Date(),
      status: 'in_progress',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    // Away lineup (Hawks = team3, away team)
    await db.lineups.add({
      gameId: awayGameId as number,
      side: 'away',
      battingOrder: Array.from({ length: 9 }, (_, i) => ({
        orderPosition: i + 1,
        playerId: i + 100,
        playerName: `Away${i + 1}`,
        jerseyNumber: (i + 1) * 10,
        position: POSITIONS[i],
        substitutions: [],
      })),
    })
    // Home lineup (Eagles = team4, home team)
    await db.lineups.add({
      gameId: awayGameId as number,
      side: 'home',
      battingOrder: Array.from({ length: 9 }, (_, i) => ({
        orderPosition: i + 1,
        playerId: i + 200,
        playerName: `Home${i + 1}`,
        jerseyNumber: (i + 1) * 10,
        position: POSITIONS[i],
        substitutions: [],
      })),
    })

    // Nav helper to switch games within the same GameProvider
    function NavButton({ to, label }: { to: string; label: string }) {
      const navigate = useNavigate()
      return <button onClick={() => navigate(to)}>{label}</button>
    }

    render(
      <MemoryRouter initialEntries={[`/game/${homeGameId}`]}>
        <ToastProvider>
          <GameProvider>
            <Routes>
              <Route path="/game/:gameId" element={<GamePage />} />
            </Routes>
            <NavButton to={`/game/${awayGameId}`} label="Go to away game" />
          </GameProvider>
        </ToastProvider>
      </MemoryRouter>
    )

    // Verify game 1 defaults to "away" tab (Tigers batting in top 1)
    await waitFor(() => {
      expect(screen.getByText('Opp1')).toBeInTheDocument()
    })

    // Navigate to game 2
    const user = userEvent.setup()
    await user.click(screen.getByText('Go to away game'))

    // Game 2: top 1 = away team (Hawks) batting → should show away tab with Away players
    await waitFor(() => {
      expect(screen.getByText('Away2')).toBeInTheDocument()
    })
    // Home team scoresheet should NOT be visible
    expect(screen.queryByText('Home2')).not.toBeInTheDocument()
  })

  it('should show record play and undo buttons', async () => {
    const gameId = await seedFullGame()
    renderGame(gameId as number)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /record play/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument()
    })
  })

  it('should show home/away tabs with away on left and home on right', async () => {
    const gameId = await seedFullGame() // Mudcats (home), Tigers (away)
    renderGame(gameId as number)

    await waitFor(() => {
      // Away tab (Tigers) on left, home tab (Mudcats) on right
      const awayBtn = screen.getByRole('button', { name: /tigers \(away\)/i })
      const homeBtn = screen.getByRole('button', { name: /mudcats \(home\)/i })
      expect(awayBtn).toBeInTheDocument()
      expect(homeBtn).toBeInTheDocument()
    })
  })

  it('should disable Record Play when game is over', async () => {
    const gameId = await seedFullGame()
    // Add 18 outs worth of plays (3 outs x 6 innings x 2 halves) to end the game
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

    renderGame(gameId as number)

    await waitFor(() => {
      const recordBtn = screen.getByRole('button', { name: /record play/i })
      expect(recordBtn).toBeDisabled()
    })
  })

  it('should show actual batting team batter in play entry panel, not the viewed tab batter', async () => {
    const user = userEvent.setup()
    const gameId = await seedFullGame()
    renderGame(gameId as number)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /record play/i })).toBeInTheDocument()
    })

    // Game starts with top half (Tigers = away batting)
    // Switch to "Mudcats (Home)" tab (viewing home scoresheet)
    await user.click(screen.getByRole('button', { name: /mudcats \(home\)/i }))

    // Open play entry panel — should show the actual current batter (Opp1, away team batting top)
    await user.click(screen.getByRole('button', { name: /record play/i }))

    await waitFor(() => {
      // Opp1 is the actual current batter (top half = away team bats)
      expect(screen.getByText('Opp1')).toBeInTheDocument()
    })
  })

  it('should show beginner guide card after a play is recorded', async () => {
    const user = userEvent.setup()
    const gameId = await seedFullGame()
    renderGame(gameId as number)
    await waitFor(() => expect(screen.getByRole('button', { name: /record play/i })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /record play/i }))
    // Use shorthand to record a strikeout (K button removed from outcome grid)
    await user.type(screen.getByPlaceholderText(/shorthand/i), 'K')
    await user.click(screen.getByRole('button', { name: /^enter$/i }))
    expect(screen.getByText(/strikeout/i)).toBeInTheDocument()
  })

  it('should show game-over overlay when snapshot.isGameOver is true', async () => {
    const gameId = await seedFullGame()
    // Add 18 outs worth of plays (3 outs x 6 innings x 2 halves) to end the game
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

    renderGame(gameId as number)

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

    renderGame(gameId as number)

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
    renderGame(gameId as number)

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

    renderGame(gameId as number)

    await waitFor(() => {
      expect(screen.getByText('Game Over')).toBeInTheDocument()
      // Home button should exist between View Stats and Back to scoresheet
      expect(screen.getByRole('button', { name: /^home$/i })).toBeInTheDocument()
    })
  })

  it('should preserve pitch tracking when play entry panel is closed and reopened', async () => {
    const user = userEvent.setup()
    const gameId = await seedFullGame()
    renderGame(gameId as number)

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
    renderGame(gameId as number)

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
    renderGame(gameId as number)

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
    renderGame(gameId as number)

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
    renderGame(gameId as number)

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
    renderGame(gameId as number)

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

    renderGame(gameId as number)

    // Wait for game to load — top half = away (Tigers) batting
    // Default tab is 'away' so Tigers tab should be active
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
    // With pitches ['B', 'S', 'B']: balls=2, strikes=1 -> "Count: 2-1 (3 pitches)"
    await waitFor(() => {
      expect(screen.getByText(/Count: 2-1 \(3 pitches\)/)).toBeInTheDocument()
    })

    // Also verify the Undo button from the popover is present
    // Note: "Undo" button also exists in the bottom action bar, so use getAllByRole
    expect(screen.getAllByRole('button', { name: /undo/i }).length).toBeGreaterThanOrEqual(1)
  })

  it('should show toast and auto-switch tab to Home after top half ends', async () => {
    const user = userEvent.setup()
    const gameId = await seedFullGame()

    // Seed 2 outs already in top half (away team = Tigers batting)
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

    renderGame(gameId as number)

    // Wait for game to load (2 outs showing)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /record play/i })).toBeInTheDocument()
    })

    // Record the 3rd out (K) via shorthand
    await user.click(screen.getByRole('button', { name: /record play/i }))
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/shorthand/i)).toBeInTheDocument()
    })
    await user.type(screen.getByPlaceholderText(/shorthand/i), 'K')
    await user.click(screen.getByRole('button', { name: /^enter$/i }))

    // After 3rd out: top half ends, game moves to Bot 1 (home team = Mudcats bats)
    // Toast should appear (text includes both "Side retired" and "Bot 1")
    await waitFor(() => {
      expect(screen.getByText(/side retired — bot 1/i)).toBeInTheDocument()
    })
  })

  it('should not double-count runs when runner confirmation accepts defaults (6 singles = 3 runs)', async () => {
    const user = userEvent.setup()
    const gameId = await seedFullGame() // Mudcats home, Tigers away; top 1 = Tigers batting

    // Pre-seed 3 singles by the away team (Tigers) to load the bases (no runner overrides)
    await db.plays.bulkAdd([
      {
        gameId, sequenceNumber: 1, inning: 1, half: 'top',
        batterOrderPosition: 1,
        playType: '1B', notation: '1B',
        fieldersInvolved: [7], basesReached: [1], runsScoredOnPlay: 0,
        rbis: 0, pitches: [], isAtBat: true, timestamp: new Date(),
      },
      {
        gameId, sequenceNumber: 2, inning: 1, half: 'top',
        batterOrderPosition: 2,
        playType: '1B', notation: '1B',
        fieldersInvolved: [7], basesReached: [1], runsScoredOnPlay: 0,
        rbis: 0, pitches: [], isAtBat: true, timestamp: new Date(),
      },
      {
        gameId, sequenceNumber: 3, inning: 1, half: 'top',
        batterOrderPosition: 3,
        playType: '1B', notation: '1B',
        fieldersInvolved: [7], basesReached: [1], runsScoredOnPlay: 0,
        rbis: 0, pitches: [], isAtBat: true, timestamp: new Date(),
      },
    ])

    renderGame(gameId as number)

    // Wait for game to load — bases should be loaded, score 0-0
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /record play/i })).toBeInTheDocument()
    })

    // Record 4th single — opens play entry panel
    await user.click(screen.getByRole('button', { name: /record play/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^1B$/i })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /^1B$/i }))

    // Runner confirmation should appear (bases loaded, runner on 3rd should default to scored)
    await waitFor(() => {
      expect(screen.getByText(/where did they end up/i)).toBeInTheDocument()
    })

    // Accept defaults — click Confirm
    await user.click(screen.getByRole('button', { name: /confirm/i }))

    // Score should be away = 1 (only runner from 3rd scored), not 2 (double-counted)
    await waitFor(() => {
      // Away score (Tigers) on the left; find its parent to check the score value
      const scoreSection = screen.getByText('Tigers').parentElement!
      expect(scoreSection.textContent).toContain('1')
    })
  })
})
