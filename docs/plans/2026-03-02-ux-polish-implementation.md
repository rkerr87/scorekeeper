# UX Polish & Phone-First Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Polish the app for phone-first use with toast notifications, empty states, form validation, team management, dead UI cleanup, loading states, phone-first layouts, and visual refinements.

**Architecture:** A new ToastContext provides app-wide `showToast()`. A reusable Spinner component replaces loading text. Dialogs become bottom sheets on mobile via a shared BottomSheet wrapper. PlayEntryPanel gets tabbed layout. Existing component APIs stay stable — changes are additive or internal.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Vitest, @testing-library/react

**Design doc:** `docs/plans/2026-03-02-ux-polish-design.md`

---

## Phase 1: Foundation Components

### Task 1: Toast Notification System

**Files:**
- Create: `src/contexts/ToastContext.tsx`
- Create: `src/components/Toast.tsx`
- Create: `src/components/__tests__/Toast.test.tsx`
- Modify: `src/App.tsx`

**Step 1: Write the failing test**

Create `src/components/__tests__/Toast.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ToastProvider, useToast } from '../../contexts/ToastContext'

function TestComponent() {
  const { showToast } = useToast()
  return <button onClick={() => showToast('Player added', 'success')}>Trigger</button>
}

describe('Toast', () => {
  it('shows toast message when triggered', async () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )
    await act(async () => {
      screen.getByText('Trigger').click()
    })
    expect(screen.getByText('Player added')).toBeInTheDocument()
  })

  it('auto-dismisses after timeout', async () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )
    await act(async () => {
      screen.getByText('Trigger').click()
    })
    expect(screen.getByText('Player added')).toBeInTheDocument()
    await act(async () => {
      vi.advanceTimersByTime(3500)
    })
    expect(screen.queryByText('Player added')).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('supports success, error, and info variants', async () => {
    function MultiToast() {
      const { showToast } = useToast()
      return (
        <>
          <button onClick={() => showToast('Good', 'success')}>S</button>
          <button onClick={() => showToast('Bad', 'error')}>E</button>
          <button onClick={() => showToast('Info', 'info')}>I</button>
        </>
      )
    }
    render(
      <ToastProvider>
        <MultiToast />
      </ToastProvider>
    )
    await act(async () => { screen.getByText('S').click() })
    expect(screen.getByText('Good').closest('[data-variant]')?.getAttribute('data-variant')).toBe('success')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/__tests__/Toast.test.tsx`
Expected: FAIL — modules don't exist yet

**Step 3: Write ToastContext and Toast component**

Create `src/contexts/ToastContext.tsx`:

```tsx
import { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { Toast } from '../components/Toast'

type ToastVariant = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  message: string
  variant: ToastVariant
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = nextId++
    setToasts(prev => [...prev, { id, message, variant }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <Toast key={t.id} message={t.message} variant={t.variant} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
```

Create `src/components/Toast.tsx`:

```tsx
interface ToastProps {
  message: string
  variant: 'success' | 'error' | 'info'
  onDismiss: () => void
}

const variantStyles = {
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-slate-800 text-white',
}

export function Toast({ message, variant, onDismiss }: ToastProps) {
  return (
    <div
      data-variant={variant}
      onClick={onDismiss}
      className={`${variantStyles[variant]} px-5 py-2.5 rounded-full shadow-lg text-sm font-medium pointer-events-auto cursor-pointer`}
    >
      {message}
    </div>
  )
}
```

**Step 4: Wire ToastProvider into App.tsx**

In `src/App.tsx`, wrap the router with `<ToastProvider>` (outermost provider so toasts render above everything):

```tsx
import { ToastProvider } from './contexts/ToastContext'
// In the component return:
<ToastProvider>
  <PreferencesProvider>
    <GameProvider>
      <RouterProvider router={router} />
    </GameProvider>
  </PreferencesProvider>
</ToastProvider>
```

**Step 5: Run test to verify it passes**

Run: `npm run test -- src/components/__tests__/Toast.test.tsx`
Expected: PASS

**Step 6: Commit**

```bash
git add src/contexts/ToastContext.tsx src/components/Toast.tsx src/components/__tests__/Toast.test.tsx src/App.tsx
git commit -m "feat: add toast notification system"
```

---

### Task 2: Spinner Component

**Files:**
- Create: `src/components/Spinner.tsx`
- Create: `src/components/__tests__/Spinner.test.tsx`

**Step 1: Write the failing test**

Create `src/components/__tests__/Spinner.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Spinner } from '../Spinner'

describe('Spinner', () => {
  it('renders with default label', () => {
    render(<Spinner />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('renders with custom label', () => {
    render(<Spinner label="Fetching data…" />)
    expect(screen.getByText('Fetching data…')).toBeInTheDocument()
  })

  it('renders the spinning element', () => {
    render(<Spinner />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/__tests__/Spinner.test.tsx`
Expected: FAIL

**Step 3: Write Spinner component**

Create `src/components/Spinner.tsx`:

```tsx
export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
      <div role="status" className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
      <p className="mt-3 text-sm">{label}</p>
    </div>
  )
}
```

Add to `src/index.css`:

```css
@keyframes spin {
  to { transform: rotate(360deg); }
}
```

Note: Tailwind's `animate-spin` handles this natively, so the CSS keyframe addition is only needed if `animate-spin` isn't working. Check first — it should work with Tailwind v4.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/__tests__/Spinner.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/Spinner.tsx src/components/__tests__/Spinner.test.tsx
git commit -m "feat: add Spinner loading component"
```

---

## Phase 2: Empty States & Loading

### Task 3: Replace Loading Text with Spinner

**Files:**
- Modify: `src/pages/TeamDetailPage.tsx`
- Modify: `src/pages/GamePage.tsx`
- Modify: `src/pages/GameStatsPage.tsx`
- Modify: `src/pages/SeasonStatsPage.tsx`
- Modify: `src/pages/GameSetupPage.tsx`

**Step 1: Replace all `Loading...` returns**

In each file, replace the loading return statement:

```tsx
// Before:
if (loading) return <div className="p-6">Loading...</div>

// After:
import { Spinner } from '../components/Spinner'
// ...
if (loading) return <Spinner />
```

Do this in all 5 files listed above.

**Step 2: Run full test suite**

Run: `npm run test`
Expected: PASS (no tests depend on "Loading..." text)

**Step 3: Commit**

```bash
git add src/pages/TeamDetailPage.tsx src/pages/GamePage.tsx src/pages/GameStatsPage.tsx src/pages/SeasonStatsPage.tsx src/pages/GameSetupPage.tsx
git commit -m "feat: replace loading text with Spinner component"
```

---

### Task 4: Empty States

**Files:**
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/pages/TeamsPage.tsx`
- Modify: `src/pages/TeamDetailPage.tsx`
- Modify: `src/pages/SeasonStatsPage.tsx`

**Step 1: Write tests for empty states**

Add tests to existing test files (or create new ones) that verify empty state messages render:

For HomePage — test that when no games exist, "No games yet" appears. For TeamsPage — "No teams yet. Create your first team to get started." For TeamDetailPage — "No players on the roster yet." For SeasonStatsPage — "No completed games yet for this team."

**Step 2: Implement empty states**

**HomePage.tsx** — After the in-progress games section, if no in-progress games:
```tsx
{inProgressGames.length === 0 && (
  <p className="text-center text-slate-400 py-6">No games yet</p>
)}
```

Similarly for completed games section.

**TeamsPage.tsx** — The existing "No teams yet" message may already exist. Ensure it says:
```tsx
<p className="text-center text-slate-400 py-6">No teams yet. Create your first team to get started.</p>
```

**TeamDetailPage.tsx** — Before the roster table, if no players:
```tsx
{players.length === 0 && (
  <p className="text-center text-slate-400 py-6">No players on the roster yet. Add your first player above.</p>
)}
```

**SeasonStatsPage.tsx** — Replace current empty message or add:
```tsx
<p className="text-center text-slate-400 py-6">No completed games yet for this team.</p>
```

**Step 3: Run tests**

Run: `npm run test`
Expected: PASS

**Step 4: Commit**

```bash
git add src/pages/HomePage.tsx src/pages/TeamsPage.tsx src/pages/TeamDetailPage.tsx src/pages/SeasonStatsPage.tsx
git commit -m "feat: add empty state messages across all list views"
```

---

## Phase 3: Form Validation & Confirmations

### Task 5: Form Validation

**Files:**
- Modify: `src/pages/TeamDetailPage.tsx`
- Modify: `src/pages/TeamsPage.tsx`
- Create: `src/pages/__tests__/TeamDetailPage.test.tsx` (if doesn't exist)

**Step 1: Write failing tests for validation**

```tsx
// TeamDetailPage validation tests
it('shows error when jersey number is not numeric', async () => {
  // Fill name, type "abc" in jersey, click Add
  // Expect "Jersey # must be a number"
})

it('shows error when player name is empty on submit', async () => {
  // Leave name empty, fill jersey, click Add
  // Expect "Name is required"
})
```

For TeamsPage:
```tsx
it('shows error for duplicate team name', async () => {
  // Create "Tigers", try to create "Tigers" again
  // Expect "A team with this name already exists"
})
```

**Step 2: Run tests to verify failure**

**Step 3: Implement validation**

**TeamDetailPage.tsx** — Add validation state and display:
```tsx
const [errors, setErrors] = useState<{ name?: string; jersey?: string }>({})

const handleAddPlayer = async () => {
  const newErrors: typeof errors = {}
  if (!playerName.trim()) newErrors.name = 'Name is required'
  if (!jerseyNumber.trim() || isNaN(Number(jerseyNumber))) newErrors.jersey = 'Jersey # must be a number'
  if (Object.keys(newErrors).length > 0) {
    setErrors(newErrors)
    return
  }
  setErrors({})
  // ... existing add logic
}
```

Show error text below each input:
```tsx
{errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
{errors.jersey && <p className="text-red-500 text-xs mt-1">{errors.jersey}</p>}
```

Also add red border to invalid inputs: `border-red-400` when error exists.

**TeamsPage.tsx** — Check for duplicate on submit:
```tsx
const handleCreateTeam = async () => {
  if (!teamName.trim()) return
  if (teams.some(t => t.name.toLowerCase() === teamName.trim().toLowerCase())) {
    setError('A team with this name already exists')
    return
  }
  setError('')
  // ... existing create logic
}
```

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git commit -m "feat: add form validation for player and team creation"
```

---

### Task 6: Confirmation Dialogs

**Files:**
- Modify: `src/pages/TeamDetailPage.tsx`
- Modify: `src/components/PitchTracker.tsx`

**Step 1: Write failing tests**

```tsx
// TeamDetailPage
it('shows confirmation before deleting a player', async () => {
  // Click delete on a player
  // Expect "Delete [name] from the roster?" text
  // Click Cancel — player still exists
  // Click Delete button in confirm — player removed
})
```

**Step 2: Implement player delete confirmation**

In TeamDetailPage, add a `confirmDeleteId` state. When Delete is clicked, set it. Show inline confirmation (same pattern as game delete on HomePage):

```tsx
const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

// In table row:
{confirmDeleteId === p.id ? (
  <div className="flex items-center gap-2">
    <span className="text-xs text-red-600">Delete {p.name}?</span>
    <button onClick={() => handleDeletePlayer(p.id!)} className="text-red-600 font-bold text-xs">Yes</button>
    <button onClick={() => setConfirmDeleteId(null)} className="text-slate-500 text-xs">No</button>
  </div>
) : (
  <button onClick={() => setConfirmDeleteId(p.id!)} className="text-red-500 hover:text-red-700 text-sm">Delete</button>
)}
```

**Step 3: Simplify PitchTracker clear confirmation**

In PitchTracker.tsx, change the clear button to a single inline confirm (not a dialog):

```tsx
// Replace the two-step confirm dialog with:
{showClearConfirm ? (
  <div className="flex items-center gap-2 mt-2">
    <span className="text-xs text-slate-600">Clear {pitches.length} pitches?</span>
    <button onClick={() => { onClear(); setShowClearConfirm(false) }} className="text-red-600 font-bold text-xs">Clear</button>
    <button onClick={() => setShowClearConfirm(false)} className="text-slate-500 text-xs">Cancel</button>
  </div>
) : (
  pitches.length > 0 && <button onClick={() => setShowClearConfirm(true)} className="mt-2 text-xs text-slate-500 hover:text-slate-700">Clear pitches</button>
)}
```

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git commit -m "feat: add delete confirmation and simplify pitch clear"
```

---

## Phase 4: Team Management

### Task 7: Team Deletion

**Files:**
- Create: `src/db/gameService.ts` (add `deleteTeam`, `getGamesForTeam` already exists)
- Modify: `src/pages/TeamDetailPage.tsx`

**Step 1: Write failing tests**

Test that:
- "Delete Team" button appears on TeamDetailPage
- Clicking it shows confirmation dialog
- If team has games, shows blocking message
- If no games, deletes and redirects to /teams

**Step 2: Add `deleteTeam` to gameService**

```tsx
export async function deleteTeam(teamId: number): Promise<void> {
  await db.transaction('rw', [db.players, db.teams], async () => {
    await db.players.where('teamId').equals(teamId).delete()
    await db.teams.delete(teamId)
  })
}
```

**Step 3: Add Delete Team UI to TeamDetailPage**

At the bottom of the page, add a red outlined button. On click, check `getGamesForTeam(tId)` — if any non-deleted games exist, show blocking message. Otherwise show confirmation, then call `deleteTeam` and `navigate('/teams')`.

```tsx
const [showDeleteTeam, setShowDeleteTeam] = useState(false)
const [deleteTeamBlocked, setDeleteTeamBlocked] = useState(false)

const handleDeleteTeam = async () => {
  const games = await getGamesForTeam(tId)
  if (games.length > 0) {
    setDeleteTeamBlocked(true)
    return
  }
  setShowDeleteTeam(true)
}

const confirmDeleteTeam = async () => {
  await deleteTeam(tId)
  navigate('/teams')
}
```

UI at bottom:
```tsx
<div className="mt-8 pt-6 border-t border-slate-200">
  {deleteTeamBlocked && (
    <p className="text-sm text-red-600 mb-2">Can't delete — this team has games. Delete those games first.</p>
  )}
  {showDeleteTeam ? (
    <div className="flex items-center gap-3">
      <span className="text-sm text-red-600 font-medium">Delete {team.name}? This cannot be undone.</span>
      <button onClick={confirmDeleteTeam} className="text-red-600 font-bold text-sm">Delete</button>
      <button onClick={() => setShowDeleteTeam(false)} className="text-slate-500 text-sm">Cancel</button>
    </div>
  ) : (
    <button onClick={handleDeleteTeam} className="text-red-500 hover:text-red-700 text-sm border border-red-300 rounded-lg px-4 py-2">
      Delete Team
    </button>
  )}
</div>
```

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git commit -m "feat: add team deletion with game-dependency check"
```

---

### Task 8: Team Rename

**Files:**
- Modify: `src/db/gameService.ts` (add `updateTeamName`)
- Modify: `src/pages/TeamDetailPage.tsx`

**Step 1: Write failing test**

```tsx
it('allows renaming the team by clicking the name', async () => {
  // Click the team name heading
  // Input appears with current name
  // Change to "New Name", blur
  // Heading now shows "New Name"
})
```

**Step 2: Add `updateTeamName` to gameService**

```tsx
export async function updateTeamName(teamId: number, name: string): Promise<void> {
  await db.teams.update(teamId, { name })
}
```

**Step 3: Implement inline rename**

Add `isEditingName` state. When heading is clicked, switch to input. On blur or Enter, save.

```tsx
const [isEditingName, setIsEditingName] = useState(false)
const [editName, setEditName] = useState('')

const handleStartRename = () => {
  setEditName(team!.name)
  setIsEditingName(true)
}

const handleSaveRename = async () => {
  const trimmed = editName.trim()
  if (trimmed && trimmed !== team!.name) {
    await updateTeamName(tId, trimmed)
    setTeam({ ...team!, name: trimmed })
  }
  setIsEditingName(false)
}
```

In the JSX, replace the `<h1>` with:
```tsx
{isEditingName ? (
  <input
    autoFocus
    value={editName}
    onChange={e => setEditName(e.target.value)}
    onBlur={handleSaveRename}
    onKeyDown={e => e.key === 'Enter' && handleSaveRename()}
    className="text-2xl font-bold text-slate-900 mt-4 mb-2 border-b-2 border-blue-500 outline-none bg-transparent w-full"
  />
) : (
  <h1 onClick={handleStartRename} className="text-2xl font-bold text-slate-900 mt-4 mb-2 cursor-pointer hover:text-blue-600 group">
    {team.name} <span className="text-slate-300 text-sm group-hover:text-blue-400">✎</span>
  </h1>
)}
```

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git commit -m "feat: add inline team rename"
```

---

### Task 9: Player Editing

**Files:**
- Modify: `src/db/gameService.ts` (add `updatePlayer`)
- Modify: `src/pages/TeamDetailPage.tsx`

**Step 1: Write failing test**

```tsx
it('allows editing a player by clicking their row', async () => {
  // Click on a player row
  // Edit form appears with current values
  // Change name, click Save
  // Row shows updated name
})
```

**Step 2: Add `updatePlayer` to gameService**

```tsx
export async function updatePlayer(id: number, updates: { name?: string; jerseyNumber?: number; defaultPosition?: string }): Promise<void> {
  await db.players.update(id, updates)
}
```

**Step 3: Implement inline player editing**

Add `editingPlayerId` state. Clicking a row sets it. Show inline form in that row.

```tsx
const [editingPlayerId, setEditingPlayerId] = useState<number | null>(null)
const [editPlayerName, setEditPlayerName] = useState('')
const [editJersey, setEditJersey] = useState('')
const [editPosition, setEditPosition] = useState('')

const startEdit = (p: Player) => {
  setEditingPlayerId(p.id!)
  setEditPlayerName(p.name)
  setEditJersey(String(p.jerseyNumber))
  setEditPosition(p.defaultPosition)
}

const saveEdit = async () => {
  if (!editingPlayerId || !editPlayerName.trim() || !editJersey.trim()) return
  await updatePlayer(editingPlayerId, {
    name: editPlayerName.trim(),
    jerseyNumber: parseInt(editJersey),
    defaultPosition: editPosition || 'UT',
  })
  setPlayers(players.map(p => p.id === editingPlayerId
    ? { ...p, name: editPlayerName.trim(), jerseyNumber: parseInt(editJersey), defaultPosition: editPosition || 'UT' }
    : p
  ))
  setEditingPlayerId(null)
}
```

In the table body, for each player row:
```tsx
{editingPlayerId === p.id ? (
  <tr key={p.id} className="border-t border-slate-100 bg-blue-50">
    <td className="px-4 py-2" colSpan={4}>
      <div className="flex gap-2 items-center flex-wrap">
        <input value={editPlayerName} onChange={e => setEditPlayerName(e.target.value)}
          className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm min-w-0" />
        <input value={editJersey} onChange={e => setEditJersey(e.target.value)}
          className="w-16 border border-slate-300 rounded px-2 py-1 text-sm" inputMode="numeric" />
        <select value={editPosition} onChange={e => setEditPosition(e.target.value)}
          className="w-20 border border-slate-300 rounded px-1 py-1 text-sm bg-white">
          <option value="">UT</option>
          {['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'].map(pos => (
            <option key={pos} value={pos}
              disabled={pos !== p.defaultPosition && players.some(pl => pl.defaultPosition === pos)}>
              {pos}
            </option>
          ))}
        </select>
        <button onClick={saveEdit} className="bg-blue-600 text-white px-3 py-1 rounded text-sm font-semibold">Save</button>
        <button onClick={() => setEditingPlayerId(null)} className="text-slate-500 text-sm">Cancel</button>
      </div>
    </td>
  </tr>
) : (
  <tr key={p.id} className="border-t border-slate-100 cursor-pointer hover:bg-slate-50" onClick={() => startEdit(p)}>
    {/* existing cells */}
  </tr>
)}
```

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git commit -m "feat: add inline player editing"
```

---

## Phase 5: Dead UI & Dev Tools Cleanup

### Task 10: Remove Edit Button & Clean Up Dev Tools

**Files:**
- Modify: `src/components/PlayDetailPopover.tsx`
- Modify: `src/pages/HomePage.tsx`

**Step 1: Write failing tests**

```tsx
// PlayDetailPopover
it('does not show Edit button', () => {
  // Render popover
  // Expect no "Edit" button
})

// HomePage
it('hides dev tools by default', () => {
  // Render HomePage
  // Expect no "Seed Data" button visible
})

it('shows dev tools when dev link is clicked', () => {
  // Click "Dev" link
  // Expect "Seed Data" button visible
})
```

**Step 2: Remove Edit button from PlayDetailPopover**

Remove the Edit button and its `onEdit` prop entirely. The two-button flex layout becomes a single Undo button (full width).

**Step 3: Hide Dev Tools behind toggle on HomePage**

Replace the always-visible dev tools section with:
```tsx
const [showDevTools, setShowDevTools] = useState(false)

// At bottom of page:
{import.meta.env.DEV && (
  <>
    {showDevTools ? (
      <div className="border border-dashed border-slate-300 rounded-lg p-4 bg-slate-50">
        {/* existing seed/clear buttons */}
      </div>
    ) : (
      <button onClick={() => setShowDevTools(true)} className="text-xs text-slate-300 hover:text-slate-500">
        Dev
      </button>
    )}
  </>
)}
```

**Step 4: Disable Season Stats when no completed games**

In HomePage, check if any games have status `completed`. If not, disable the stats button:

```tsx
const hasCompletedGames = games.some(g => g.status === 'completed')

<Link to="/stats" className={hasCompletedGames ? 'bg-slate-200 ...' : 'bg-slate-100 text-slate-400 pointer-events-none ...'}>
  Season Stats
</Link>
{!hasCompletedGames && <p className="text-xs text-slate-400 text-center">Complete a game to see stats</p>}
```

**Step 5: Run tests, verify pass**

**Step 6: Commit**

```bash
git commit -m "fix: remove placeholder Edit button, hide dev tools, disable empty stats link"
```

---

## Phase 6: Wire Toasts Into Existing Flows

### Task 11: Add Toast Notifications Across the App

**Files:**
- Modify: `src/pages/TeamDetailPage.tsx`
- Modify: `src/pages/TeamsPage.tsx`
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/pages/GamePage.tsx`
- Modify: `src/components/PlayEntryPanel.tsx`

**Step 1: Add toasts to team/player CRUD**

In each file, import `useToast` and call `showToast` after successful actions:

**TeamDetailPage.tsx:**
```tsx
const { showToast } = useToast()
// After addPlayer: showToast('Player added', 'success')
// After deletePlayer: showToast('Player deleted', 'success')
// After rename: showToast('Team renamed', 'success')
// After deleteTeam: showToast('Team deleted', 'success') // before navigate
```

**TeamsPage.tsx:**
```tsx
// After createTeam: showToast('Team created', 'success')
```

**HomePage.tsx:**
```tsx
// After deleteGame: showToast('Game deleted', 'success')
```

**GamePage.tsx:**
Replace the existing inline toast mechanism (the `pendingToast` / `fixed top-20` element) with the ToastContext:
```tsx
const { showToast } = useToast()
// Replace pendingToast usage with: showToast('Side retired', 'info')
// After undo: showToast('Play undone', 'info')
// After position change: showToast('Position change saved', 'success')
```

**Step 2: Add toast to play recording**

In GamePage's `finalizePlay` or after `handleRunnerConfirm`:
```tsx
showToast(`Play recorded — ${data.playType}`, 'success')
```

**Step 3: Improve shorthand error in PlayEntryPanel**

Replace the current error message with a more helpful one:
```tsx
setShorthandError('Unrecognized notation. Try: 6-3 (groundout), 1B7 (single to left), F8 (flyout to center)')
```

**Step 4: Run full test suite**

Run: `npm run test`
Expected: PASS (update any tests that were checking for the old toast div or pendingToast text)

**Step 5: Commit**

```bash
git commit -m "feat: wire toast notifications into all CRUD and game actions"
```

---

## Phase 7: Phone-First Touch Targets

### Task 12: FieldDiagram Touch Targets & Responsive Size

**Files:**
- Modify: `src/components/FieldDiagram.tsx`
- Modify: `src/components/__tests__/FieldDiagram.test.tsx`

**Step 1: Write tests for larger buttons**

Update existing tests to verify buttons still render at 9 positions. Add test that the container is responsive (no fixed width class like `w-72`).

**Step 2: Make FieldDiagram responsive**

Replace `w-72 h-72` with `w-full max-w-72 aspect-square mx-auto`:

```tsx
// Container:
<div className="relative w-full max-w-72 aspect-square mx-auto">
```

Increase button size from `w-10 h-10` to `w-12 h-12` (48px — above 44px minimum):

```tsx
<button className={`absolute w-12 h-12 rounded-full ... text-xs font-bold ...`}>
```

Increase label text from `text-[9px]` to `text-[11px]` for readability.

**Step 3: Run tests, verify pass**

**Step 4: Commit**

```bash
git commit -m "feat: increase FieldDiagram touch targets and make responsive"
```

---

### Task 13: Play Entry Panel Tabbed Layout

**Files:**
- Modify: `src/components/PlayEntryPanel.tsx`
- Modify: `src/components/__tests__/PlayEntryPanel.test.tsx`

**Step 1: Write failing test for tabs**

```tsx
it('shows tabbed layout with Hit, Out, Special, Shorthand tabs', () => {
  render(<PlayEntryPanel ... />)
  expect(screen.getByText('Hit')).toBeInTheDocument()
  expect(screen.getByText('Out')).toBeInTheDocument()
  expect(screen.getByText('Special')).toBeInTheDocument()
  expect(screen.getByText('Shorthand')).toBeInTheDocument()
})

it('only shows Hit buttons when Hit tab is active', () => {
  render(<PlayEntryPanel ... />)
  // Hit tab active by default
  expect(screen.getByText('1B')).toBeInTheDocument()
  expect(screen.queryByText('Ground Out')).not.toBeInTheDocument()
})

it('switches to Out tab and shows fielding buttons', async () => {
  render(<PlayEntryPanel ... />)
  fireEvent.click(screen.getByText('Out'))
  expect(screen.getByText('Ground Out')).toBeInTheDocument()
  expect(screen.queryByText('1B')).not.toBeInTheDocument()
})
```

**Step 2: Implement tabbed layout**

Add a `tab` state: `'hit' | 'out' | 'special' | 'shorthand'`:

```tsx
const [tab, setTab] = useState<'hit' | 'out' | 'special' | 'shorthand'>('hit')
```

Tab bar (below pitch tracker):
```tsx
<div className="flex gap-1 mb-3">
  {(['hit', 'out', 'special', 'shorthand'] as const).map(t => (
    <button key={t} onClick={() => setTab(t)}
      className={`flex-1 py-2.5 rounded-lg text-sm font-bold capitalize ${
        tab === t ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
      }`}>
      {t === 'shorthand' ? '⌨ Shorthand' : t.charAt(0).toUpperCase() + t.slice(1)}
    </button>
  ))}
</div>
```

Then conditionally render only the active tab's content:
- **Hit tab:** HBP, 1B, 2B, 3B, HR buttons
- **Out tab:** Ground Out, Fly Out, Line Out, Pop Out buttons + FieldDiagram (when in fielding mode)
- **Special tab:** FC, E, DP, SAC, SB, WP, PB, BK buttons
- **Shorthand tab:** Text input + format hints

Increase all play buttons to `py-3` (from `py-2`) for 44px+ height.

**Step 3: Run tests, verify pass**

**Step 4: Commit**

```bash
git commit -m "feat: tabbed layout for PlayEntryPanel with larger touch targets"
```

---

### Task 14: Larger Touch Targets on PitchTracker & Play Buttons

**Files:**
- Modify: `src/components/PitchTracker.tsx`
- Modify: `src/pages/GameSetupPage.tsx`

**Step 1: PitchTracker improvements**

- Increase pitch dot size from `w-5 h-5` to `w-7 h-7` (28px)
- Remove tap-to-delete on dots (rely on Undo/Clear buttons)
- Increase B/S/F buttons: `py-3` (from `py-2`) for 48px+ height

**Step 2: GameSetupPage position dropdowns**

Increase position dropdown height: add `py-2.5` or `h-11` (44px) to the position select elements in the lineup builder.

**Step 3: Run tests, verify pass**

**Step 4: Commit**

```bash
git commit -m "feat: increase touch targets on PitchTracker and GameSetup"
```

---

## Phase 8: Bottom Sheets for Mobile Dialogs

### Task 15: Bottom Sheet Wrapper Component

**Files:**
- Create: `src/components/BottomSheet.tsx`
- Create: `src/components/__tests__/BottomSheet.test.tsx`

**Step 1: Write failing test**

```tsx
describe('BottomSheet', () => {
  it('renders children in a bottom-anchored container', () => {
    render(<BottomSheet onClose={() => {}}><div>Content</div></BottomSheet>)
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('calls onClose when backdrop is clicked', async () => {
    const onClose = vi.fn()
    render(<BottomSheet onClose={onClose}><div>Content</div></BottomSheet>)
    fireEvent.click(screen.getByTestId('bottom-sheet-backdrop'))
    expect(onClose).toHaveBeenCalled()
  })
})
```

**Step 2: Implement BottomSheet**

```tsx
import type { ReactNode } from 'react'

interface BottomSheetProps {
  children: ReactNode
  onClose: () => void
  title?: string
}

export function BottomSheet({ children, onClose, title }: BottomSheetProps) {
  return (
    <div className="fixed inset-0 z-50">
      <div data-testid="bottom-sheet-backdrop" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-2xl max-h-[85vh] overflow-y-auto animate-[slideUp_0.2s_ease-out]">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>
        {title && <h2 className="text-lg font-bold text-slate-900 px-5 pb-3">{title}</h2>}
        <div className="px-5 pb-6">
          {children}
        </div>
      </div>
    </div>
  )
}
```

**Step 3: Run tests, verify pass**

**Step 4: Commit**

```bash
git commit -m "feat: add BottomSheet wrapper component"
```

---

### Task 16: Convert Dialogs to Bottom Sheets

**Files:**
- Modify: `src/components/PlayDetailPopover.tsx`
- Modify: `src/components/RunnerConfirmation.tsx`
- Modify: `src/components/PositionChangeDialog.tsx`
- Modify: `src/components/SubstitutionDialog.tsx`

**Step 1: Convert each dialog**

For each component, replace the centered modal wrapper:

```tsx
// Before:
<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
  <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4">

// After:
<BottomSheet onClose={onCancel} title="Runner Confirmation">
```

Move the content (buttons, forms) into the BottomSheet's children. Remove the inner wrapper div since BottomSheet provides padding.

Do this for all 4 dialog components.

**Step 2: Update tests**

Any tests that check for specific modal structure may need updating. The backdrop selector changes to `data-testid="bottom-sheet-backdrop"`.

**Step 3: Run full test suite**

Run: `npm run test`
Expected: PASS

**Step 4: Commit**

```bash
git commit -m "feat: convert all dialogs to bottom sheets on mobile"
```

---

## Phase 9: Scoresheet Phone Optimization

### Task 17: Narrower Sticky Column & Larger Cells

**Files:**
- Modify: `src/components/Scoresheet.tsx`
- Modify: `src/components/AtBatCell.tsx`

**Step 1: Narrow the sticky batter column**

Change the sticky column from full names to abbreviated format. In Scoresheet.tsx, create a helper:

```tsx
function abbreviateName(name: string, jerseyNumber: number): string {
  const parts = name.split(' ')
  if (parts.length >= 2) {
    return `${jerseyNumber} ${parts[0][0]}.${parts[parts.length - 1]}`
  }
  return `${jerseyNumber} ${name}`
}
```

Reduce `min-w-[140px]` to `min-w-[100px]` on the sticky column header and cells. Use `text-xs` for the name.

**Step 2: Add scroll indicator**

Add a gradient fade on the right edge of the scrollable area:

```tsx
<div className="overflow-x-auto relative">
  {/* Table here */}
  <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-slate-50 to-transparent pointer-events-none" />
</div>
```

**Step 3: Increase AtBatCell tap target**

In AtBatCell.tsx, increase `min-h-[72px] min-w-[72px]` to `min-h-[76px] min-w-[76px]`.

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git commit -m "feat: optimize scoresheet for phone (narrower names, scroll indicator, larger cells)"
```

---

## Phase 10: Visual Polish

### Task 18: ScoreSummary Improvements

**Files:**
- Modify: `src/components/ScoreSummary.tsx`
- Modify: `src/components/__tests__/ScoreSummary.test.tsx`

**Step 1: Write failing test**

```tsx
it('shows TOP/BOT instead of triangle symbols', () => {
  render(<ScoreSummary half="top" ... />)
  expect(screen.getByText('TOP')).toBeInTheDocument()
  expect(screen.queryByText('▲')).not.toBeInTheDocument()
})

it('shows team names in score display', () => {
  render(<ScoreSummary awayTeamName="Tigers" homeTeamName="Lions" ... />)
  expect(screen.getByText('Tigers')).toBeInTheDocument()
  expect(screen.getByText('Lions')).toBeInTheDocument()
})
```

**Step 2: Implement changes**

Replace `▲` / `▼` with `TOP` / `BOT`:
```tsx
<span className="text-xs font-bold text-amber-400">{half === 'top' ? 'TOP' : 'BOT'}</span>
```

Team names should already be shown (they were added in multi-team work). Verify they're visible and truncate properly.

**Step 3: Run tests, verify pass**

**Step 4: Commit**

```bash
git commit -m "feat: replace half-inning symbols with TOP/BOT text"
```

---

### Task 19: GamePage Navigation & Game-Over Overlay

**Files:**
- Modify: `src/pages/GamePage.tsx`

**Step 1: Add Home button**

In the existing header bar (dark bg-slate-800 area), add a Home link:

```tsx
<Link to="/" className="text-slate-400 hover:text-white text-sm font-medium">
  ← Home
</Link>
```

This goes in the top-left area of GamePage, replacing or alongside the existing back element.

**Step 2: Simplify game-over overlay**

Remove "Back to scoresheet" button. Keep:
- Final score display (already exists)
- "View Stats" button → links to `/game/${gameId}/stats`
- "Home" button → links to `/`

```tsx
<div className="flex gap-3 mt-6">
  <Link to={`/game/${game.id}/stats`} className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold text-center">
    View Stats
  </Link>
  <Link to="/" className="flex-1 bg-slate-200 text-slate-700 py-3 rounded-lg font-bold text-center">
    Home
  </Link>
</div>
```

Keep the dismiss (clicking backdrop) so users can still view the scoresheet.

**Step 3: Run tests, verify pass**

**Step 4: Commit**

```bash
git commit -m "feat: add Home button to GamePage, simplify game-over overlay"
```

---

### Task 20: Beginner Guide Persistence

**Files:**
- Modify: `src/components/BeginnerGuide.tsx`
- Modify: `src/pages/GamePage.tsx`

**Step 1: Write failing test**

```tsx
it('stays visible until manually dismissed', () => {
  render(<BeginnerGuide playType="K" notation="K" onDismiss={onDismiss} />)
  expect(screen.getByText(/Strikeout/)).toBeInTheDocument()
  // Should NOT auto-dismiss
})

it('calls onDismiss when X button is clicked', () => {
  const onDismiss = vi.fn()
  render(<BeginnerGuide playType="K" notation="K" onDismiss={onDismiss} />)
  fireEvent.click(screen.getByLabelText('Dismiss'))
  expect(onDismiss).toHaveBeenCalled()
})
```

**Step 2: Make BeginnerGuide persistent**

Remove the `setTimeout` auto-dismiss from GamePage. Add an `onDismiss` prop to BeginnerGuide and render a close button:

```tsx
<button onClick={onDismiss} aria-label="Dismiss" className="absolute top-2 right-2 text-blue-400 hover:text-blue-600 text-lg">
  ✕
</button>
```

In GamePage, track dismiss count in localStorage:
```tsx
const dismissCount = parseInt(localStorage.getItem('beginnerGuideDismisses') ?? '0')
const showBeginnerGuide = dismissCount < 3 && lastPlayType !== null

const handleDismissGuide = () => {
  const count = parseInt(localStorage.getItem('beginnerGuideDismisses') ?? '0') + 1
  localStorage.setItem('beginnerGuideDismisses', String(count))
  setLastPlayType(null) // or whatever state controls guide visibility
}
```

**Step 3: Run tests, verify pass**

**Step 4: Commit**

```bash
git commit -m "feat: make BeginnerGuide persistent with manual dismiss and auto-hide after 3 dismissals"
```

---

### Task 21: Final Integration Test & Cleanup

**Step 1: Run full test suite**

Run: `npm run test`
Fix any failing tests.

**Step 2: Run build**

Run: `npm run build`
Fix any TypeScript errors.

**Step 3: Run lint**

Run: `npm run lint`
Fix any lint errors.

**Step 4: Manual smoke test**

Run: `npm run dev`
Walk through:
- Create team → toast appears
- Add players → validation works, toast appears
- Rename team → inline edit works
- Delete player → confirmation shows
- Start game → spinners during load
- Record plays → toast, tabbed panel works
- Check dialogs → bottom sheets
- Game over → simplified overlay
- Beginner guide → persists, dismisses

**Step 5: Commit any fixes**

```bash
git commit -m "fix: integration test fixes and cleanup"
```
