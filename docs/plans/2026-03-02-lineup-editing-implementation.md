# Lineup Editing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let scorekeepers exclude absent players, change positions, and add guest/new players at game setup time.

**Architecture:** All changes are in `GameSetupPage` and its test file. No engine, service, or type changes. New state (bench, position overrides, guest players) is local to the page. The existing `SortablePlayerRow` component gains position editing and a remove button; new sections for bench and add-player form are added below.

**Tech Stack:** React 19, TypeScript, Tailwind v4, @dnd-kit, @testing-library/react, vitest

**Design doc:** `docs/plans/2026-03-02-lineup-editing-design.md`

---

### Task 1: Add remove-player and bench section

**Files:**
- Modify: `src/pages/GameSetupPage.tsx`
- Test: `src/pages/__tests__/GameSetupPage.test.tsx`

**Step 1: Write the failing tests**

Add tests to the existing `GameSetupPage.test.tsx` (create it if it doesn't exist). Use the existing test helper pattern with `db.delete()`/`db.open()` in beforeEach and a `seedTwoTeamsAndGame()` helper that creates two teams with 3 players each and a draft game.

```tsx
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { GameProvider } from '../../contexts/GameContext'
import { GameSetupPage } from '../GameSetupPage'
import { db } from '../../db/database'
import { createTeam, addPlayer, createGame } from '../../db/gameService'

async function seedTwoTeamsAndGame() {
  const home = await createTeam('Eagles')
  const away = await createTeam('Hawks')
  await addPlayer(home.id!, 'Alice', 1, 'P')
  await addPlayer(home.id!, 'Bob', 2, 'C')
  await addPlayer(home.id!, 'Carol', 3, '1B')
  await addPlayer(away.id!, 'Dan', 4, 'P')
  await addPlayer(away.id!, 'Eve', 5, 'C')
  await addPlayer(away.id!, 'Frank', 6, '1B')
  const game = await createGame(home.id!, away.id!, home.id!)
  return { home, away, game }
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

  it('shows a remove button for each player', async () => {
    const { game } = await seedTwoTeamsAndGame()
    renderSetup(game.id!)
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })
    const removeButtons = screen.getAllByLabelText('Remove from lineup')
    expect(removeButtons.length).toBe(6) // 3 per team
  })

  it('removes player to bench when remove button clicked', async () => {
    const { game } = await seedTwoTeamsAndGame()
    renderSetup(game.id!)
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })
    // Find Alice's remove button (first one in home section)
    const removeButtons = screen.getAllByLabelText('Remove from lineup')
    await userEvent.click(removeButtons[0]) // First away player (Dan)
    // Dan should now appear in the bench
    expect(screen.getByText('Not Playing (1)')).toBeInTheDocument()
  })

  it('adds player back from bench to batting order', async () => {
    const { game } = await seedTwoTeamsAndGame()
    renderSetup(game.id!)
    await waitFor(() => {
      expect(screen.getByText('Dan')).toBeInTheDocument()
    })
    // Remove Dan
    const removeButtons = screen.getAllByLabelText('Remove from lineup')
    await userEvent.click(removeButtons[0])
    expect(screen.getByText('Not Playing (1)')).toBeInTheDocument()
    // Add Dan back
    const addBackButton = screen.getByLabelText('Add Dan back to lineup')
    await userEvent.click(addBackButton)
    expect(screen.queryByText('Not Playing')).not.toBeInTheDocument()
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npm run test -- src/pages/__tests__/GameSetupPage.test.tsx`
Expected: FAIL — no remove buttons exist yet.

**Step 3: Implement remove button and bench section**

In `GameSetupPage.tsx`:

1. Add state for bench lists:
```tsx
const [homeBench, setHomeBench] = useState<number[]>([])
const [awayBench, setAwayBench] = useState<number[]>([])
```

2. Add `onRemove` prop to `SortablePlayerRow` and render an X button:
```tsx
interface SortablePlayerRowProps {
  playerId: number
  index: number
  player: Player
  position: string
  onRemove: () => void
}
```
The X button has `aria-label="Remove from lineup"`.

3. Remove handler moves player ID from batting order to bench:
```tsx
const handleRemovePlayer = (side: 'home' | 'away', playerId: number) => {
  if (side === 'home') {
    setHomeBattingOrder(prev => prev.filter(id => id !== playerId))
    setHomeBench(prev => [...prev, playerId])
  } else {
    setAwayBattingOrder(prev => prev.filter(id => id !== playerId))
    setAwayBench(prev => [...prev, playerId])
  }
}
```

4. Bench section renders below each team's batting order when bench is non-empty:
```tsx
{bench.length > 0 && (
  <div className="mt-3 border-t border-slate-200 pt-3">
    <h3 className="text-sm font-medium text-slate-500 mb-2">
      Not Playing ({bench.length})
    </h3>
    {bench.map(playerId => {
      const player = allPlayers.find(p => p.id === playerId)
      if (!player) return null
      return (
        <div key={playerId} className="flex items-center gap-2 px-3 py-1 text-slate-400">
          <span className="text-sm">{player.name}</span>
          <span className="text-xs">#{player.jerseyNumber}</span>
          <button
            onClick={() => handleAddBack(side, playerId)}
            aria-label={`Add ${player.name} back to lineup`}
            className="ml-auto text-green-600 hover:text-green-700 text-lg leading-none"
          >
            +
          </button>
        </div>
      )
    })}
  </div>
)}
```

5. Add-back handler moves player from bench to end of batting order:
```tsx
const handleAddBack = (side: 'home' | 'away', playerId: number) => {
  if (side === 'home') {
    setHomeBench(prev => prev.filter(id => id !== playerId))
    setHomeBattingOrder(prev => [...prev, playerId])
  } else {
    setAwayBench(prev => prev.filter(id => id !== playerId))
    setAwayBattingOrder(prev => [...prev, playerId])
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run test -- src/pages/__tests__/GameSetupPage.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/pages/GameSetupPage.tsx src/pages/__tests__/GameSetupPage.test.tsx
git commit -m "feat(GameSetup): add remove-player and bench section"
```

---

### Task 2: Add inline position editing

**Files:**
- Modify: `src/pages/GameSetupPage.tsx`
- Modify: `src/pages/__tests__/GameSetupPage.test.tsx`

**Step 1: Write the failing tests**

```tsx
it('shows position as tappable and opens dropdown on click', async () => {
  const { game } = await seedTwoTeamsAndGame()
  renderSetup(game.id!)
  await waitFor(() => {
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })
  // Alice's position is P — find and click it
  const positionButtons = screen.getAllByRole('button', { name: /position/i })
  expect(positionButtons.length).toBeGreaterThan(0)
  await userEvent.click(positionButtons[0])
  // Dropdown should show all 9 positions
  expect(screen.getByRole('option', { name: 'SS' })).toBeInTheDocument()
})

it('changes position when dropdown option selected', async () => {
  const { game } = await seedTwoTeamsAndGame()
  renderSetup(game.id!)
  await waitFor(() => {
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })
  // Click first position button (Dan's P in away section)
  const positionButtons = screen.getAllByRole('button', { name: /position/i })
  await userEvent.click(positionButtons[0])
  // Select SS
  await userEvent.click(screen.getByRole('option', { name: 'SS' }))
  // Position should now show SS
  expect(screen.getAllByRole('button', { name: /position/i })[0]).toHaveTextContent('SS')
})
```

**Step 2: Run tests to verify they fail**

Run: `npm run test -- src/pages/__tests__/GameSetupPage.test.tsx`
Expected: FAIL — no position buttons exist.

**Step 3: Implement inline position editing**

1. Add position override state:
```tsx
const [homePositions, setHomePositions] = useState<Map<number, string>>(new Map())
const [awayPositions, setAwayPositions] = useState<Map<number, string>>(new Map())
```

2. Helper to get effective position:
```tsx
const getPosition = (side: 'home' | 'away', player: Player): string => {
  const overrides = side === 'home' ? homePositions : awayPositions
  return overrides.get(player.id!) ?? player.defaultPosition
}
```

3. Add `onPositionChange` prop and `position` prop to `SortablePlayerRow`. Replace the static position span with a button that toggles a dropdown:

```tsx
const [editingPosition, setEditingPosition] = useState(false)
const POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']

// In JSX:
{editingPosition ? (
  <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded shadow-lg z-10">
    {POSITIONS.map(pos => (
      <button
        key={pos}
        role="option"
        aria-label={pos}
        onClick={() => { onPositionChange(pos); setEditingPosition(false) }}
        className="block w-full text-left px-3 py-1 text-sm hover:bg-slate-100"
      >
        {pos}
      </button>
    ))}
  </div>
) : null}
<button
  aria-label={`position: ${position}`}
  onClick={() => setEditingPosition(!editingPosition)}
  className="text-xs text-blue-600 hover:text-blue-800 w-8 text-right"
>
  {position}
</button>
```

4. Position change handler updates the override map:
```tsx
const handlePositionChange = (side: 'home' | 'away', playerId: number, newPosition: string) => {
  if (side === 'home') {
    setHomePositions(prev => new Map(prev).set(playerId, newPosition))
  } else {
    setAwayPositions(prev => new Map(prev).set(playerId, newPosition))
  }
}
```

5. Update `handleStartGame` to use position overrides:
```tsx
position: getPosition('home', player),  // instead of player.defaultPosition
```

**Step 4: Run tests to verify they pass**

Run: `npm run test -- src/pages/__tests__/GameSetupPage.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/pages/GameSetupPage.tsx src/pages/__tests__/GameSetupPage.test.tsx
git commit -m "feat(GameSetup): inline position editing with dropdown"
```

---

### Task 3: Add guest/new player form

**Files:**
- Modify: `src/pages/GameSetupPage.tsx`
- Modify: `src/pages/__tests__/GameSetupPage.test.tsx`

**Step 1: Write the failing tests**

```tsx
it('shows Add Player button for each team', async () => {
  const { game } = await seedTwoTeamsAndGame()
  renderSetup(game.id!)
  await waitFor(() => {
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })
  const addButtons = screen.getAllByRole('button', { name: /add player/i })
  expect(addButtons).toHaveLength(2)
})

it('opens inline form when Add Player clicked', async () => {
  const { game } = await seedTwoTeamsAndGame()
  renderSetup(game.id!)
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
  const { game } = await seedTwoTeamsAndGame()
  renderSetup(game.id!)
  await waitFor(() => {
    expect(screen.getByText('Dan')).toBeInTheDocument()
  })
  // Open add form for away team (first Add Player button)
  const addButtons = screen.getAllByRole('button', { name: /add player/i })
  await userEvent.click(addButtons[0])
  // Fill in form
  await userEvent.type(screen.getByPlaceholderText('Player name'), 'Gina')
  await userEvent.type(screen.getByPlaceholderText('Jersey #'), '99')
  // Uncheck "Add to team roster"
  await userEvent.click(screen.getByLabelText('Add to team roster'))
  // Select position and save
  // Use the position select in the form
  await userEvent.selectOptions(screen.getByLabelText('Position'), 'RF')
  await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
  // Gina should appear in the batting order
  expect(screen.getByText('Gina')).toBeInTheDocument()
})
```

**Step 2: Run tests to verify they fail**

Run: `npm run test -- src/pages/__tests__/GameSetupPage.test.tsx`
Expected: FAIL — no Add Player button.

**Step 3: Implement add player form**

1. Add state:
```tsx
const [addingPlayerSide, setAddingPlayerSide] = useState<'home' | 'away' | null>(null)
const [newPlayerName, setNewPlayerName] = useState('')
const [newPlayerJersey, setNewPlayerJersey] = useState('')
const [newPlayerPosition, setNewPlayerPosition] = useState('RF')
const [saveToRoster, setSaveToRoster] = useState(true)
const [homeGuestPlayers, setHomeGuestPlayers] = useState<Player[]>([])
const [awayGuestPlayers, setAwayGuestPlayers] = useState<Player[]>([])
```

2. "Add Player" button below bench section for each team:
```tsx
<button
  onClick={() => setAddingPlayerSide(side)}
  className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
>
  + Add Player
</button>
```

3. Inline form (shown when `addingPlayerSide === side`):
```tsx
{addingPlayerSide === side && (
  <div className="mt-3 border border-slate-200 rounded-lg p-3 bg-slate-50">
    <div className="flex flex-col gap-2">
      <input type="text" placeholder="Player name" value={newPlayerName}
        onChange={e => setNewPlayerName(e.target.value)}
        className="border border-slate-300 rounded px-3 py-2 text-sm" />
      <div className="flex gap-2">
        <input type="text" inputMode="numeric" placeholder="Jersey #" value={newPlayerJersey}
          onChange={e => setNewPlayerJersey(e.target.value)}
          className="w-20 border border-slate-300 rounded px-3 py-2 text-sm" />
        <select aria-label="Position" value={newPlayerPosition}
          onChange={e => setNewPlayerPosition(e.target.value)}
          className="border border-slate-300 rounded px-3 py-2 text-sm">
          {POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={saveToRoster}
          onChange={e => setSaveToRoster(e.target.checked)}
          aria-label="Add to team roster" />
        Add to team roster
      </label>
      <div className="flex gap-2">
        <button onClick={handleSaveNewPlayer}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-semibold">
          Save
        </button>
        <button onClick={() => { setAddingPlayerSide(null); resetForm() }}
          className="text-slate-500 hover:text-slate-700 px-4 py-2 rounded text-sm">
          Cancel
        </button>
      </div>
    </div>
  </div>
)}
```

4. Save handler:
```tsx
const handleSaveNewPlayer = () => {
  if (!newPlayerName.trim() || !newPlayerJersey.trim() || !addingPlayerSide) return
  const jerseyNum = parseInt(newPlayerJersey)
  if (isNaN(jerseyNum)) return

  const tempId = -Date.now()
  const guestPlayer: Player = {
    id: tempId,
    teamId: addingPlayerSide === 'home' ? homeTeamId : awayTeamId,
    name: newPlayerName.trim(),
    jerseyNumber: jerseyNum,
    defaultPosition: newPlayerPosition,
    createdAt: new Date(),
  }

  if (addingPlayerSide === 'home') {
    setHomeGuestPlayers(prev => [...prev, guestPlayer])
    setHomeBattingOrder(prev => [...prev, tempId])
  } else {
    setAwayGuestPlayers(prev => [...prev, guestPlayer])
    setAwayBattingOrder(prev => [...prev, tempId])
  }

  resetForm()
  setAddingPlayerSide(null)
}
```

5. Update player lookups to also check guest players. Create a helper:
```tsx
const findPlayer = (side: 'home' | 'away', playerId: number): Player | undefined => {
  const roster = side === 'home' ? homePlayers : awayPlayers
  const guests = side === 'home' ? homeGuestPlayers : awayGuestPlayers
  return roster.find(p => p.id === playerId) ?? guests.find(p => p.id === playerId)
}
```

6. Track which guest players should be saved to roster. Store `saveToRoster` per guest player — simplest: a `Set<number>` of temp IDs that should be saved:
```tsx
const [guestSaveToRoster, setGuestSaveToRoster] = useState<Set<number>>(new Set())
```
When `saveToRoster` is checked at add time, add the temp ID to the set.

7. Update `handleStartGame` to persist "save to roster" guests before building lineup:
```tsx
const handleStartGame = async () => {
  // Save guest players marked for roster
  const idMap = new Map<number, number>() // tempId → realId
  for (const guest of [...homeGuestPlayers, ...awayGuestPlayers]) {
    if (guestSaveToRoster.has(guest.id!)) {
      const saved = await addPlayer(guest.teamId, guest.name, guest.jerseyNumber, guest.defaultPosition)
      idMap.set(guest.id!, saved.id!)
    }
  }

  const resolveId = (tempId: number) => idMap.get(tempId) ?? tempId

  // Build slots using resolveId for playerIds...
  const homeSlots: LineupSlot[] = homeBattingOrder.map((playerId, i) => {
    const player = findPlayer('home', playerId)!
    return {
      orderPosition: i + 1,
      playerId: resolveId(player.id!),
      playerName: player.name,
      jerseyNumber: player.jerseyNumber,
      position: getPosition('home', player),
      substitutions: [],
    }
  })
  // Same for away...
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run test -- src/pages/__tests__/GameSetupPage.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/pages/GameSetupPage.tsx src/pages/__tests__/GameSetupPage.test.tsx
git commit -m "feat(GameSetup): add guest/new player inline form"
```

---

### Task 4: Add lineup warnings

**Files:**
- Modify: `src/pages/GameSetupPage.tsx`
- Modify: `src/pages/__tests__/GameSetupPage.test.tsx`

**Step 1: Write the failing tests**

```tsx
it('warns when no pitcher assigned for a team', async () => {
  const { game } = await seedTwoTeamsAndGame()
  renderSetup(game.id!)
  await waitFor(() => {
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })
  // Remove Alice (P) from home lineup
  // Change Alice's position from P to RF
  const positionButtons = screen.getAllByRole('button', { name: /position/i })
  // Find Alice's position button (home team, first player) and change to RF
  // Home team buttons come after away team buttons (3 away + 3 home)
  await userEvent.click(positionButtons[3]) // Alice (first home player)
  await userEvent.click(screen.getByRole('option', { name: 'RF' }))
  // Warning should appear
  expect(screen.getByText(/no pitcher assigned/i)).toBeInTheDocument()
})

it('warns when duplicate positions exist', async () => {
  const { game } = await seedTwoTeamsAndGame()
  renderSetup(game.id!)
  await waitFor(() => {
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })
  // Change Bob's position from C to P (duplicate with Alice)
  const positionButtons = screen.getAllByRole('button', { name: /position/i })
  await userEvent.click(positionButtons[4]) // Bob (second home player)
  await userEvent.click(screen.getByRole('option', { name: 'P' }))
  expect(screen.getByText(/duplicate position.*P/i)).toBeInTheDocument()
})

it('does not block Start Game when warnings present', async () => {
  const { game } = await seedTwoTeamsAndGame()
  renderSetup(game.id!)
  await waitFor(() => {
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })
  // Even with warnings, Start Game button should be enabled
  expect(screen.getByRole('button', { name: /start game/i })).toBeEnabled()
})
```

**Step 2: Run tests to verify they fail**

Run: `npm run test -- src/pages/__tests__/GameSetupPage.test.tsx`
Expected: FAIL — no warning elements.

**Step 3: Implement warnings**

1. Compute warnings from current state:
```tsx
function computeWarnings(
  battingOrder: number[],
  findPlayer: (id: number) => Player | undefined,
  getPosition: (player: Player) => string,
): string[] {
  const warnings: string[] = []
  const positions: string[] = []

  for (const playerId of battingOrder) {
    const player = findPlayer(playerId)
    if (!player) continue
    positions.push(getPosition(player))
  }

  if (!positions.includes('P')) {
    warnings.push('No pitcher assigned')
  }

  const counts = new Map<string, number>()
  for (const pos of positions) {
    counts.set(pos, (counts.get(pos) ?? 0) + 1)
  }
  for (const [pos, count] of counts) {
    if (count > 1) {
      warnings.push(`Duplicate position: ${pos}`)
    }
  }

  return warnings
}
```

2. Render warnings above Start Game button:
```tsx
const homeWarnings = computeWarnings(...)
const awayWarnings = computeWarnings(...)
const allWarnings = [
  ...homeWarnings.map(w => `${homeTeamName}: ${w}`),
  ...awayWarnings.map(w => `${awayTeamName}: ${w}`),
]

{allWarnings.length > 0 && (
  <div className="mb-4 space-y-1">
    {allWarnings.map((w, i) => (
      <div key={i} className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
        {w}
      </div>
    ))}
  </div>
)}
```

**Step 4: Run tests to verify they pass**

Run: `npm run test -- src/pages/__tests__/GameSetupPage.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/pages/GameSetupPage.tsx src/pages/__tests__/GameSetupPage.test.tsx
git commit -m "feat(GameSetup): lineup validation warnings"
```

---

### Task 5: Integration test — full setup flow with edits

**Files:**
- Modify: `src/pages/__tests__/GameSetupPage.test.tsx`

**Step 1: Write the integration test**

```tsx
it('starts game with edited lineup (removed player, changed position, guest player)', async () => {
  const { game } = await seedTwoTeamsAndGame()
  renderSetup(game.id!)
  await waitFor(() => {
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  // 1. Remove Dan from away lineup
  const removeButtons = screen.getAllByLabelText('Remove from lineup')
  await userEvent.click(removeButtons[0]) // Dan (first away player)

  // 2. Change Eve's position from C to P
  const positionButtons = screen.getAllByRole('button', { name: /position/i })
  await userEvent.click(positionButtons[0]) // Eve is now first away player
  await userEvent.click(screen.getByRole('option', { name: 'P' }))

  // 3. Add guest player to away team
  const addButtons = screen.getAllByRole('button', { name: /add player/i })
  await userEvent.click(addButtons[0])
  await userEvent.type(screen.getByPlaceholderText('Player name'), 'Gina')
  await userEvent.type(screen.getByPlaceholderText('Jersey #'), '99')
  await userEvent.selectOptions(screen.getByLabelText('Position'), 'LF')
  await userEvent.click(screen.getByLabelText('Add to team roster'))
  await userEvent.click(screen.getByRole('button', { name: /^save$/i }))

  // 4. Start game
  await userEvent.click(screen.getByRole('button', { name: /start game/i }))

  // Should navigate to game page
  await waitFor(() => {
    expect(screen.getByText('Game Page')).toBeInTheDocument()
  })

  // Verify lineups were saved correctly
  const lineups = await getLineupsForGame(game.id!)
  const awayLineup = lineups.find(l => l.side === 'away')!
  expect(awayLineup.battingOrder).toHaveLength(3) // Eve, Frank, Gina (Dan removed)
  expect(awayLineup.battingOrder[0].position).toBe('P') // Eve changed to P
  expect(awayLineup.battingOrder[2].playerName).toBe('Gina')
})
```

**Step 2: Run the test**

Run: `npm run test -- src/pages/__tests__/GameSetupPage.test.tsx`
Expected: PASS (if Tasks 1-4 are correctly implemented)

**Step 3: Run full test suite**

Run: `npm run test`
Expected: All tests pass (268 existing + new tests)

**Step 4: Run lint and build**

Run: `npm run lint && npm run build`
Expected: Clean

**Step 5: Commit**

```bash
git add src/pages/__tests__/GameSetupPage.test.tsx
git commit -m "test(GameSetup): integration test for full lineup editing flow"
```
