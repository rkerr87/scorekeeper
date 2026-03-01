# Game Deletion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add soft-delete for games from the home page list, with inline confirmation UI.

**Architecture:** Extend `GameStatus` with `'deleted'`, add `deleteGame()` to `gameService.ts`, filter deleted games out of `getGamesForTeam`, and restructure each game row in `HomePage` to show a `✕` button with inline confirm/cancel state.

**Tech Stack:** TypeScript, Dexie.js (IndexedDB), React, vitest + @testing-library/react

---

### Task 1: Extend GameStatus type

**Files:**
- Modify: `src/engine/types.ts`

**Step 1: Update the type**

In `src/engine/types.ts`, find line:
```ts
export type GameStatus = 'draft' | 'in_progress' | 'completed'
```
Change to:
```ts
export type GameStatus = 'draft' | 'in_progress' | 'completed' | 'deleted'
```

**Step 2: Verify no type errors**

Run: `npm run build`
Expected: Clean build. TypeScript will catch any exhaustive switch cases that need updating (there are none — `GameStatus` is not used in a switch in the engine).

**Step 3: Commit**

```bash
git add src/engine/types.ts
git commit -m "feat(types): add 'deleted' to GameStatus"
```

---

### Task 2: Add deleteGame service function and update getGamesForTeam

**Files:**
- Modify: `src/db/gameService.ts`
- Test: `src/db/__tests__/gameService.test.ts`

**Step 1: Write the failing tests**

Open `src/db/__tests__/gameService.test.ts`. Add `deleteGame` to the import list at the top:
```ts
import {
  createTeam,
  getTeam,
  getAllTeams,
  addPlayer,
  getPlayersForTeam,
  deletePlayer,
  createGame,
  getGame,
  getGamesForTeam,
  updateGameStatus,
  deleteGame,         // ← add this
  saveLineup,
  getLineupsForGame,
  addPlay,
  getPlaysForGame,
  deleteLastPlay,
  updatePlay,
} from '../gameService'
```

At the end of the `describe('games', ...)` block (after the `'should update game status'` test), add:

```ts
it('should soft-delete a game (status = deleted, record still exists)', async () => {
  const team = await createTeam('Mudcats')
  const game = await createGame(team.id!, 'Tigers', 'home')

  await deleteGame(game.id!)

  const fetched = await getGame(game.id!)
  expect(fetched?.status).toBe('deleted')
})

it('should exclude deleted games from getGamesForTeam', async () => {
  const team = await createTeam('Mudcats')
  await createGame(team.id!, 'Tigers', 'home')        // visible
  const gone = await createGame(team.id!, 'Bears', 'away')  // will be deleted
  await deleteGame(gone.id!)

  const games = await getGamesForTeam(team.id!)
  expect(games).toHaveLength(1)
  expect(games[0].opponentName).toBe('Tigers')
})
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/db/__tests__/gameService.test.ts`
Expected: 2 failures — `deleteGame is not a function` and the filter test fails.

**Step 3: Implement deleteGame in gameService.ts**

In `src/db/gameService.ts`, add after `updateGameStatus`:

```ts
export async function deleteGame(id: number): Promise<void> {
  await updateGameStatus(id, 'deleted')
}
```

Also update `getGamesForTeam` to filter out deleted games. Find:
```ts
export async function getGamesForTeam(teamId: number): Promise<Game[]> {
  return db.games.where('teamId').equals(teamId).toArray()
}
```
Change to:
```ts
export async function getGamesForTeam(teamId: number): Promise<Game[]> {
  return db.games
    .where('teamId')
    .equals(teamId)
    .filter(g => g.status !== 'deleted')
    .toArray()
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- src/db/__tests__/gameService.test.ts`
Expected: All tests pass (no regressions).

**Step 5: Commit**

```bash
git add src/db/gameService.ts src/db/__tests__/gameService.test.ts
git commit -m "feat(service): add deleteGame (soft delete via status='deleted')"
```

---

### Task 3: Update HomePage with delete button and inline confirm

**Files:**
- Modify: `src/pages/HomePage.tsx`
- Test: `src/pages/__tests__/HomePage.test.tsx`

**Step 1: Write the failing tests**

Open `src/pages/__tests__/HomePage.test.tsx`. Add a new `describe` block at the end of the top-level `describe('HomePage', ...)`:

```ts
describe('game deletion', () => {
  it('should show inline confirm when delete button is clicked', async () => {
    const user = userEvent.setup()
    const teamId = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
    await db.games.add({
      teamId, code: 'ABC123', date: new Date(), opponentName: 'Tigers',
      homeOrAway: 'home', status: 'in_progress', createdAt: new Date(), updatedAt: new Date(),
    })

    renderHome()

    await waitFor(() => expect(screen.getByText(/tigers/i)).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /delete game vs tigers/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /yes, delete/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })
  })

  it('should restore normal state when cancel is clicked', async () => {
    const user = userEvent.setup()
    const teamId = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
    await db.games.add({
      teamId, code: 'ABC123', date: new Date(), opponentName: 'Tigers',
      homeOrAway: 'home', status: 'in_progress', createdAt: new Date(), updatedAt: new Date(),
    })

    renderHome()

    await waitFor(() => expect(screen.getByText(/tigers/i)).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /delete game vs tigers/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /yes, delete/i })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /yes, delete/i })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /delete game vs tigers/i })).toBeInTheDocument()
    })
  })

  it('should remove game from list after confirming delete', async () => {
    const user = userEvent.setup()
    const teamId = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
    await db.games.add({
      teamId, code: 'ABC123', date: new Date(), opponentName: 'Tigers',
      homeOrAway: 'home', status: 'in_progress', createdAt: new Date(), updatedAt: new Date(),
    })

    renderHome()

    await waitFor(() => expect(screen.getByText(/tigers/i)).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /delete game vs tigers/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /yes, delete/i })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /yes, delete/i }))

    await waitFor(() => {
      expect(screen.queryByText(/tigers/i)).not.toBeInTheDocument()
    })
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/pages/__tests__/HomePage.test.tsx`
Expected: 3 failures — delete button not found.

**Step 3: Implement the delete UI in HomePage.tsx**

Replace the entire contents of `src/pages/HomePage.tsx` with the following. The key changes are:
- Import `deleteGame`
- Add `confirmDeleteId` state
- Add `handleDeleteGame` function
- Extract `GameRow` rendering into a helper that handles both normal and confirming states

```tsx
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Game, Team } from '../engine/types'
import { getAllTeams, getGamesForTeam, createGame, deleteGame } from '../db/gameService'

export function HomePage() {
  const navigate = useNavigate()
  const [team, setTeam] = useState<Team | null>(null)
  const [games, setGames] = useState<Game[]>([])
  const [showNewGame, setShowNewGame] = useState(false)
  const [opponentName, setOpponentName] = useState('')
  const [homeOrAway, setHomeOrAway] = useState<'home' | 'away'>('home')
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  useEffect(() => {
    async function load() {
      const teams = await getAllTeams()
      if (teams.length > 0) {
        setTeam(teams[0])
        const g = await getGamesForTeam(teams[0].id!)
        setGames(g)
      }
    }
    load()
  }, [])

  const handleStartNewGame = () => {
    if (!team) {
      navigate('/team')
      return
    }
    setShowNewGame(true)
  }

  const handleCreateGame = async () => {
    if (!team?.id || !opponentName.trim()) return
    const game = await createGame(team.id, opponentName.trim(), homeOrAway)
    navigate(`/game/${game.id}/setup`)
  }

  const handleDeleteGame = async (id: number) => {
    await deleteGame(id)
    setGames(prev => prev.filter(g => g.id !== id))
    setConfirmDeleteId(null)
  }

  const inProgressGames = games.filter(g => g.status === 'in_progress')
  const completedGames = games.filter(g => g.status === 'completed')

  function GameRow({ game, linkTo }: { game: Game; linkTo: string }) {
    const isConfirming = confirmDeleteId === game.id
    const label = `${game.homeOrAway === 'home' ? 'Home' : 'Away'} \u00b7 ${game.code}`

    if (isConfirming) {
      return (
        <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-3">
          <div>
            <div className="font-semibold text-slate-900">vs {game.opponentName}</div>
            <div className="text-xs text-slate-500">{label}</div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmDeleteId(null)}
              className="text-sm px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={() => handleDeleteGame(game.id!)}
              className="text-sm px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold"
            >
              Yes, delete
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="flex items-stretch bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
        <Link to={linkTo} className="flex-1 px-4 py-3">
          <div className="font-semibold text-slate-900">vs {game.opponentName}</div>
          <div className="text-xs text-slate-500">{label}</div>
        </Link>
        <button
          onClick={() => setConfirmDeleteId(game.id!)}
          aria-label={`Delete game vs ${game.opponentName}`}
          className="px-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-r-lg transition-colors"
        >
          ✕
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Scorekeeper</h1>

      <div className="space-y-4 mb-8">
        <Link
          to="/team"
          className="block w-full text-center bg-slate-700 hover:bg-slate-800 text-white py-3 px-4 rounded-lg font-semibold"
        >
          Manage Team Roster
        </Link>
        <button
          onClick={handleStartNewGame}
          className="block w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg font-semibold"
        >
          Start New Game
        </button>
      </div>

      {/* New game dialog */}
      {showNewGame && (
        <div className="border border-slate-200 rounded-lg p-4 mb-6 bg-white">
          <h2 className="text-lg font-semibold mb-3">New Game</h2>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Opponent name"
              value={opponentName}
              onChange={e => setOpponentName(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setHomeOrAway('home')}
                className={`flex-1 py-2 rounded-lg font-semibold text-sm ${
                  homeOrAway === 'home' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                Home
              </button>
              <button
                onClick={() => setHomeOrAway('away')}
                className={`flex-1 py-2 rounded-lg font-semibold text-sm ${
                  homeOrAway === 'away' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                Away
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowNewGame(false)}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 py-2 rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGame}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold"
              >
                Create Game
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-progress games */}
      {inProgressGames.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">In Progress</h2>
          <div className="space-y-2">
            {inProgressGames.map(g => (
              <GameRow key={g.id} game={g} linkTo={`/game/${g.id}`} />
            ))}
          </div>
        </div>
      )}

      {/* Season stats link */}
      <div className="mb-6">
        <Link to="/stats" className="block w-full text-center bg-slate-500 hover:bg-slate-600 text-white py-3 px-4 rounded-lg font-semibold">
          Season Stats
        </Link>
      </div>

      {/* Completed games */}
      {completedGames.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Completed</h2>
          <div className="space-y-2">
            {completedGames.map(g => (
              <GameRow key={g.id} game={g} linkTo={`/game/${g.id}/stats`} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- src/pages/__tests__/HomePage.test.tsx`
Expected: All tests pass.

**Step 5: Run the full test suite**

Run: `npm test`
Expected: All 138 tests pass (135 existing + 3 new + 2 new service tests = 140 total).

**Step 6: Commit**

```bash
git add src/pages/HomePage.tsx src/pages/__tests__/HomePage.test.tsx
git commit -m "feat(home): add inline soft-delete for games with confirmation"
```
