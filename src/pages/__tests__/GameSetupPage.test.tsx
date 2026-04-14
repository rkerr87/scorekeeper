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

    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())

    expect(screen.queryByPlaceholderText(/opponent name/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add opponent/i })).not.toBeInTheDocument()
  })

  it('should enable Start Game button when both batting orders have players', async () => {
    const gameId = await seedTwoTeamsAndGame()
    renderSetup(gameId)
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    const startBtn = screen.getByRole('button', { name: /start game/i })
    expect(startBtn).not.toBeDisabled()
  })

  it('should render up/down arrow buttons for each player in both batting orders', async () => {
    const gameId = await seedTwoTeamsAndGame()
    renderSetup(gameId)
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    // 3 home + 3 away = 6 players, each with a Move up and Move down button = 12 total
    const upButtons = screen.getAllByRole('button', { name: /move up/i })
    const downButtons = screen.getAllByRole('button', { name: /move down/i })
    expect(upButtons).toHaveLength(6)
    expect(downButtons).toHaveLength(6)
  })

  it('should not render drag-handle buttons', async () => {
    const gameId = await seedTwoTeamsAndGame()
    renderSetup(gameId)
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /drag to reorder/i })).not.toBeInTheDocument()
  })

  it('should save both lineups and navigate to game page on Start Game', async () => {
    const user = userEvent.setup()
    const gameId = await seedTwoTeamsAndGame()
    renderSetup(gameId)

    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())

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

  it('shows a remove button for each player in the batting order', async () => {
    const gameId = await seedTwoTeamsAndGame()
    renderSetup(gameId)
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })
    const removeButtons = screen.getAllByLabelText('Remove from lineup')
    expect(removeButtons).toHaveLength(6) // 3 per team
  })

  it('removes player to bench when remove button clicked', async () => {
    const user = userEvent.setup()
    const gameId = await seedTwoTeamsAndGame()
    renderSetup(gameId)
    await waitFor(() => {
      expect(screen.getByText('Dave')).toBeInTheDocument()
    })
    // Away team renders first; first remove button is for Dave
    const removeButtons = screen.getAllByLabelText('Remove from lineup')
    await user.click(removeButtons[0])
    expect(screen.getByText('Not Playing (1)')).toBeInTheDocument()
  })

  it('adds player back from bench to batting order', async () => {
    const user = userEvent.setup()
    const gameId = await seedTwoTeamsAndGame()
    renderSetup(gameId)
    await waitFor(() => {
      expect(screen.getByText('Dave')).toBeInTheDocument()
    })
    // Remove Dave
    const removeButtons = screen.getAllByLabelText('Remove from lineup')
    await user.click(removeButtons[0])
    expect(screen.getByText('Not Playing (1)')).toBeInTheDocument()
    // Add Dave back
    const addBackButton = screen.getByLabelText('Add Dave back to lineup')
    await user.click(addBackButton)
    expect(screen.queryByText(/Not Playing/)).not.toBeInTheDocument()
  })

  it('does not show bench section when no players are benched', async () => {
    const gameId = await seedTwoTeamsAndGame()
    renderSetup(gameId)
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })
    expect(screen.queryByText(/Not Playing/)).not.toBeInTheDocument()
  })

  it('excludes benched players from saved lineup on Start Game', async () => {
    const user = userEvent.setup()
    const gameId = await seedTwoTeamsAndGame()
    renderSetup(gameId)
    await waitFor(() => {
      expect(screen.getByText('Dave')).toBeInTheDocument()
    })
    // Remove Dave from away batting order
    const removeButtons = screen.getAllByLabelText('Remove from lineup')
    await user.click(removeButtons[0])
    expect(screen.getByText('Not Playing (1)')).toBeInTheDocument()

    // Start the game
    const startBtn = screen.getByRole('button', { name: /start game/i })
    await user.click(startBtn)

    await waitFor(() => {
      expect(screen.getByText('Game Page')).toBeInTheDocument()
    })

    // Verify away lineup only has 2 players (Dave excluded)
    const lineups = await db.lineups.where('gameId').equals(gameId).toArray()
    const awaySide = lineups.find(l => l.side === 'away')
    expect(awaySide!.battingOrder).toHaveLength(2)
    const awayNames = awaySide!.battingOrder.map(s => s.playerName)
    expect(awayNames).not.toContain('Dave')
    expect(awayNames).toContain('Eve')
    expect(awayNames).toContain('Frank')
  })

  it('shows position as tappable and opens dropdown on click', async () => {
    const gameId = await seedTwoTeamsAndGame()
    renderSetup(gameId)
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })
    const positionButtons = screen.getAllByRole('button', { name: /position/i })
    expect(positionButtons.length).toBeGreaterThan(0)
    await userEvent.click(positionButtons[0])
    expect(screen.getByRole('option', { name: 'SS' })).toBeInTheDocument()
  })

  it('changes position when dropdown option selected', async () => {
    const gameId = await seedTwoTeamsAndGame()
    renderSetup(gameId)
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })
    const positionButtons = screen.getAllByRole('button', { name: /position/i })
    // First position button is Dave (away) whose default is P
    await userEvent.click(positionButtons[0])
    await userEvent.click(screen.getByRole('option', { name: 'SS' }))
    expect(screen.getAllByRole('button', { name: /position/i })[0]).toHaveTextContent('SS')
  })

  it('saves position overrides in lineup on Start Game', async () => {
    const user = userEvent.setup()
    const gameId = await seedTwoTeamsAndGame()
    renderSetup(gameId)
    await waitFor(() => {
      expect(screen.getByText('Dave')).toBeInTheDocument()
    })
    // Change Dave's position from P to CF
    const positionButtons = screen.getAllByRole('button', { name: /position/i })
    await user.click(positionButtons[0])
    await user.click(screen.getByRole('option', { name: 'CF' }))
    expect(positionButtons[0]).toHaveTextContent('CF')

    // Start the game
    const startBtn = screen.getByRole('button', { name: /start game/i })
    await user.click(startBtn)

    await waitFor(() => {
      expect(screen.getByText('Game Page')).toBeInTheDocument()
    })

    // Verify Dave's position was saved as CF (not his default P)
    const lineups = await db.lineups.where('gameId').equals(gameId).toArray()
    const awaySide = lineups.find(l => l.side === 'away')
    const daveSlot = awaySide!.battingOrder.find(s => s.playerName === 'Dave')
    expect(daveSlot!.position).toBe('CF')
  })

  it('shows Add Player button for each team', async () => {
    const gameId = await seedTwoTeamsAndGame()
    renderSetup(gameId)
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })
    const addButtons = screen.getAllByRole('button', { name: /add player/i })
    expect(addButtons).toHaveLength(2)
  })

  it('opens inline form when Add Player clicked', async () => {
    const gameId = await seedTwoTeamsAndGame()
    renderSetup(gameId)
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })
    const addButtons = screen.getAllByRole('button', { name: /add player/i })
    await userEvent.click(addButtons[0])
    expect(screen.getByPlaceholderText('Player name')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Jersey #')).toBeInTheDocument()
    expect(screen.getByLabelText('Add to team roster')).toBeInTheDocument()
  })

  it('adds guest player to batting order', async () => {
    const gameId = await seedTwoTeamsAndGame()
    renderSetup(gameId)
    await waitFor(() => {
      expect(screen.getByText('Dave')).toBeInTheDocument()
    })
    const addButtons = screen.getAllByRole('button', { name: /add player/i })
    await userEvent.click(addButtons[0])
    await userEvent.type(screen.getByPlaceholderText('Player name'), 'Gina')
    await userEvent.type(screen.getByPlaceholderText('Jersey #'), '99')
    await userEvent.click(screen.getByLabelText('Add to team roster')) // uncheck
    await userEvent.selectOptions(screen.getByLabelText('Position'), 'RF')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(screen.getByText('Gina')).toBeInTheDocument()
  })

  it('saves guest player to roster when checkbox is checked on Start Game', async () => {
    const user = userEvent.setup()
    const gameId = await seedTwoTeamsAndGame()
    renderSetup(gameId)
    await waitFor(() => {
      expect(screen.getByText('Dave')).toBeInTheDocument()
    })
    // Add a guest player to away team (first Add Player button = away side)
    const addButtons = screen.getAllByRole('button', { name: /add player/i })
    await user.click(addButtons[0])
    await user.type(screen.getByPlaceholderText('Player name'), 'Gina')
    await user.type(screen.getByPlaceholderText('Jersey #'), '99')
    // saveToRoster checkbox is checked by default — leave it
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    expect(screen.getByText('Gina')).toBeInTheDocument()

    // Start the game
    const startBtn = screen.getByRole('button', { name: /start game/i })
    await user.click(startBtn)

    await waitFor(() => {
      expect(screen.getByText('Game Page')).toBeInTheDocument()
    })

    // Verify Gina was persisted to the team roster in DB
    const awayTeamId = (await db.games.get(gameId))!.team2Id
    const awayPlayers = await db.players.where('teamId').equals(awayTeamId).toArray()
    expect(awayPlayers.find(p => p.name === 'Gina')).toBeDefined()

    // Verify Gina appears in the away lineup with a real (positive) ID
    const lineups = await db.lineups.where('gameId').equals(gameId).toArray()
    const awaySide = lineups.find(l => l.side === 'away')
    const ginaSlot = awaySide!.battingOrder.find(s => s.playerName === 'Gina')
    expect(ginaSlot).toBeDefined()
    expect(ginaSlot!.playerId).toBeGreaterThan(0)
  })

  it('does not save guest player to roster when checkbox is unchecked', async () => {
    const user = userEvent.setup()
    const gameId = await seedTwoTeamsAndGame()
    renderSetup(gameId)
    await waitFor(() => {
      expect(screen.getByText('Dave')).toBeInTheDocument()
    })
    const addButtons = screen.getAllByRole('button', { name: /add player/i })
    await user.click(addButtons[0])
    await user.type(screen.getByPlaceholderText('Player name'), 'Hank')
    await user.type(screen.getByPlaceholderText('Jersey #'), '77')
    await user.click(screen.getByLabelText('Add to team roster')) // uncheck
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    expect(screen.getByText('Hank')).toBeInTheDocument()

    // Start the game
    const startBtn = screen.getByRole('button', { name: /start game/i })
    await user.click(startBtn)

    await waitFor(() => {
      expect(screen.getByText('Game Page')).toBeInTheDocument()
    })

    // Verify Hank was NOT persisted to team roster
    const awayTeamId = (await db.games.get(gameId))!.team2Id
    const awayPlayers = await db.players.where('teamId').equals(awayTeamId).toArray()
    expect(awayPlayers.find(p => p.name === 'Hank')).toBeUndefined()

    // Verify Hank is in lineup with negative (temp) ID
    const lineups = await db.lineups.where('gameId').equals(gameId).toArray()
    const awaySide = lineups.find(l => l.side === 'away')
    const hankSlot = awaySide!.battingOrder.find(s => s.playerName === 'Hank')
    expect(hankSlot).toBeDefined()
    expect(hankSlot!.playerId).toBeLessThan(0)
  })

  it('warns when no pitcher assigned for a team', async () => {
    const gameId = await seedTwoTeamsAndGame()
    renderSetup(gameId)
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })
    // Change Alice's position from P to RF (home team)
    // Position buttons are ordered: away (Dave, Eve, Frank) then home (Alice, Bob, Charlie)
    const positionButtons = screen.getAllByRole('button', { name: /position/i })
    await userEvent.click(positionButtons[3]) // Alice (first home player)
    await userEvent.click(screen.getByRole('option', { name: 'RF' }))
    expect(screen.getByText(/no pitcher assigned/i)).toBeInTheDocument()
  })

  it('warns when duplicate positions exist', async () => {
    const gameId = await seedTwoTeamsAndGame()
    renderSetup(gameId)
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })
    // Change Bob's position from C to P (duplicate with Alice in home team)
    const positionButtons = screen.getAllByRole('button', { name: /position/i })
    await userEvent.click(positionButtons[4]) // Bob (second home player)
    await userEvent.click(screen.getByRole('option', { name: 'P' }))
    expect(screen.getByText(/duplicate position.*P/i)).toBeInTheDocument()
  })

  it('does not block Start Game when warnings present', async () => {
    const gameId = await seedTwoTeamsAndGame()
    renderSetup(gameId)
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })
    // Change Alice's position to create a warning
    const positionButtons = screen.getAllByRole('button', { name: /position/i })
    await userEvent.click(positionButtons[3])
    await userEvent.click(screen.getByRole('option', { name: 'RF' }))
    // Warnings present but Start Game still enabled
    expect(screen.getByText(/no pitcher assigned/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start game/i })).toBeEnabled()
  })

  it('starts game with edited lineup (removed player, changed position, guest player)', async () => {
    const user = userEvent.setup()
    const gameId = await seedTwoTeamsAndGame()
    renderSetup(gameId)
    await waitFor(() => {
      expect(screen.getByText('Dave')).toBeInTheDocument()
    })

    // 1. Remove Dave from away lineup (first remove button = Dave, first away player)
    const removeButtons = screen.getAllByLabelText('Remove from lineup')
    await user.click(removeButtons[0])
    expect(screen.getByText('Not Playing (1)')).toBeInTheDocument()

    // 2. Change Eve's position from C to P
    //    After removing Dave, position buttons re-index: Eve=0, Frank=1, Alice=2, Bob=3, Charlie=4
    const positionButtons = screen.getAllByRole('button', { name: /position/i })
    await user.click(positionButtons[0]) // Eve is now first away player
    await user.click(screen.getByRole('option', { name: 'P' }))

    // 3. Add guest player Gina to away team (first Add Player = away side)
    const addButtons = screen.getAllByRole('button', { name: /add player/i })
    await user.click(addButtons[0])
    await user.type(screen.getByPlaceholderText('Player name'), 'Gina')
    await user.type(screen.getByPlaceholderText('Jersey #'), '99')
    await user.selectOptions(screen.getByLabelText('Position'), 'LF')
    await user.click(screen.getByLabelText('Add to team roster')) // uncheck save-to-roster
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    expect(screen.getByText('Gina')).toBeInTheDocument()

    // 4. Start game
    await user.click(screen.getByRole('button', { name: /start game/i }))

    // Should navigate to game page
    await waitFor(() => {
      expect(screen.getByText('Game Page')).toBeInTheDocument()
    })

    // Verify lineups were saved correctly
    const lineups = await db.lineups.where('gameId').equals(gameId).toArray()
    expect(lineups).toHaveLength(2)

    const awayLineup = lineups.find(l => l.side === 'away')!
    const homeLineup = lineups.find(l => l.side === 'home')!

    // Away lineup: Eve, Frank, Gina (Dave removed)
    expect(awayLineup.battingOrder).toHaveLength(3)
    const awayNames = awayLineup.battingOrder.map(s => s.playerName)
    expect(awayNames).toEqual(['Eve', 'Frank', 'Gina'])
    expect(awayLineup.battingOrder[0].position).toBe('P') // Eve changed from C to P
    expect(awayLineup.battingOrder[1].position).toBe('SS') // Frank kept default
    expect(awayLineup.battingOrder[2].playerName).toBe('Gina')
    expect(awayLineup.battingOrder[2].position).toBe('LF') // Gina's chosen position
    expect(awayLineup.battingOrder[2].playerId).toBeLessThan(0) // guest, not saved to roster

    // Home lineup: Alice, Bob, Charlie — unchanged
    expect(homeLineup.battingOrder).toHaveLength(3)
    const homeNames = homeLineup.battingOrder.map(s => s.playerName)
    expect(homeNames).toEqual(['Alice', 'Bob', 'Charlie'])

    // Verify Gina was NOT saved to team roster (checkbox was unchecked)
    const awayTeamId = (await db.games.get(gameId))!.team2Id
    const awayPlayers = await db.players.where('teamId').equals(awayTeamId).toArray()
    expect(awayPlayers.find(p => p.name === 'Gina')).toBeUndefined()

    // Verify game status updated
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
