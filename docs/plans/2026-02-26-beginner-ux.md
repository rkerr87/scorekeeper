# Beginner UX Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove five key friction points for beginner scorekeepers: allow starting without an opponent lineup, surface play explanations after each play, add an end-of-game screen, improve RunnerConfirmation instructions, and enable drag-to-reorder for the batting order.

**Architecture:** All changes are UI-layer only. No schema changes, no new routes (except navigating to the existing `/game/:id/stats` route). Task 5 adds two new npm packages (`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`). All other tasks are wiring or text changes.

**Tech Stack:** React 19, TypeScript strict, Tailwind v4, Vitest + @testing-library/react, @dnd-kit/core + @dnd-kit/sortable

---

### Task 1: Start Game Without Opponent Lineup

**Design doc:** `docs/plans/2026-02-26-beginner-ux-design.md` — Item 1

**Files:**
- Modify: `src/pages/GameSetupPage.tsx`
- Test: `src/pages/__tests__/GameSetupPage.test.tsx`

**Context:** `GameSetupPage` currently disables the "Start Game" button when `opponents.length === 0`. The engine and database handle an empty opponent lineup without issues.

**Step 1: Write the failing test**

Open `src/pages/__tests__/GameSetupPage.test.tsx` and add this test inside the existing `describe` block:

```tsx
it('should enable Start Game button when batting order exists but no opponents entered', async () => {
  render(<GameSetupPage />)
  await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument())
  // No opponents added — button should now be enabled
  const startBtn = screen.getByRole('button', { name: /start game/i })
  expect(startBtn).not.toBeDisabled()
})
```

**Step 2: Run the test to verify it fails**

```bash
npm run test -- --run src/pages/__tests__/GameSetupPage.test.tsx
```

Expected: FAIL — button is currently disabled when no opponents are present.

**Step 3: Implement the fix**

In `src/pages/GameSetupPage.tsx`, find the Start Game button (around line 184) and remove `|| opponents.length === 0` from the disabled condition:

```tsx
// Before:
disabled={battingOrder.length === 0 || opponents.length === 0}

// After:
disabled={battingOrder.length === 0}
```

**Step 4: Run tests**

```bash
npm run test -- --run src/pages/__tests__/GameSetupPage.test.tsx
```

Expected: all tests pass.

**Step 5: Commit**

```bash
git add src/pages/GameSetupPage.tsx src/pages/__tests__/GameSetupPage.test.tsx
git commit -m "feat(setup): allow starting game without opponent lineup"
```

---

### Task 2: RunnerConfirmation — Clearer Instruction

**Design doc:** `docs/plans/2026-02-26-beginner-ux-design.md` — Item 4

**Files:**
- Modify: `src/components/RunnerConfirmation.tsx`
- Test: `src/components/__tests__/RunnerConfirmation.test.tsx`

**Context:** The modal title "Confirm Runners" gives beginners no guidance. Replace it with an action-oriented title and add a subtitle explaining why the modal appeared.

**Step 1: Write the failing test**

Add to `src/components/__tests__/RunnerConfirmation.test.tsx`:

```tsx
it('should display an instructional title and subtitle', () => {
  render(<RunnerConfirmation runners={runners} onConfirm={() => {}} onCancel={() => {}} />)
  expect(screen.getByText(/where did they end up/i)).toBeInTheDocument()
  expect(screen.getByText(/best guess/i)).toBeInTheDocument()
})
```

**Step 2: Run the test to verify it fails**

```bash
npm run test -- --run src/components/__tests__/RunnerConfirmation.test.tsx
```

Expected: FAIL — "where did they end up" and "best guess" not found.

**Step 3: Implement the change**

In `src/components/RunnerConfirmation.tsx`, replace the `<h3>` inside the modal card:

```tsx
// Before:
<h3 className="text-lg font-bold text-slate-900 mb-4">Confirm Runners</h3>

// After:
<div className="mb-4">
  <h3 className="text-lg font-bold text-slate-900">Where did they end up?</h3>
  <p className="text-xs text-slate-500 mt-0.5">The app made its best guess — tap to correct any runner.</p>
</div>
```

**Step 4: Run tests**

```bash
npm run test -- --run src/components/__tests__/RunnerConfirmation.test.tsx
```

Expected: all tests pass.

**Step 5: Commit**

```bash
git add src/components/RunnerConfirmation.tsx src/components/__tests__/RunnerConfirmation.test.tsx
git commit -m "feat(runners): improve RunnerConfirmation instruction text"
```

---

### Task 3: BeginnerGuide Post-Record Card

**Design doc:** `docs/plans/2026-02-26-beginner-ux-design.md` — Item 2

**Files:**
- Modify: `src/pages/GamePage.tsx`
- Test: `src/pages/__tests__/GamePage.test.tsx`

**Context:** `BeginnerGuide` already exists at `src/components/BeginnerGuide.tsx` and takes `playType` and `notation` props. It renders a Diamond diagram + plain-English explanation. After `finalizePlay` commits a play, store the play type and notation in state and render the guide as a card above the bottom action bar. Auto-dismiss after 5 seconds.

**Step 1: Write the failing test**

Open `src/pages/__tests__/GamePage.test.tsx`. Study the existing test setup — it mocks `useGame` and renders a game in the `in_progress` state with a lineup. Add this test:

```tsx
it('should show beginner guide card after a play is recorded', async () => {
  const user = userEvent.setup()
  render(<GamePage />)
  await waitFor(() => expect(screen.queryByText('Loading game...')).not.toBeInTheDocument())

  // Open play entry panel
  await user.click(screen.getByRole('button', { name: /record play/i }))

  // Record a strikeout — no runners on base so finalizePlay fires immediately
  await user.click(screen.getByRole('button', { name: /^K$/i }))

  // BeginnerGuide card should appear with the K explanation
  expect(screen.getByText(/strikeout/i)).toBeInTheDocument()
})
```

**Step 2: Run the test to verify it fails**

```bash
npm run test -- --run src/pages/__tests__/GamePage.test.tsx
```

Expected: FAIL — no "strikeout" text found after recording K.

**Step 3: Implement the feature**

In `src/pages/GamePage.tsx`:

**3a. Add the import** (BeginnerGuide is not currently imported):
```tsx
import { BeginnerGuide } from '../components/BeginnerGuide'
import type { BaseRunner, BaseRunners, HalfInning, PlayType, PitchResult } from '../engine/types'
```
(Replace the existing `import type { ... }` line — add `PlayType` if not already present.)

**3b. Add state** (after the existing `useState` declarations):
```tsx
const [lastRecordedPlay, setLastRecordedPlay] = useState<{ playType: PlayType; notation: string } | null>(null)
```

**3c. Add auto-dismiss effect** (alongside the existing toast auto-dismiss effect):
```tsx
useEffect(() => {
  if (!lastRecordedPlay) return
  const timer = setTimeout(() => setLastRecordedPlay(null), 5000)
  return () => clearTimeout(timer)
}, [lastRecordedPlay])
```

**3d. Set state in `finalizePlay`** — after the `recordPlay(...)` call and before `setShowPlayEntry(false)`:
```tsx
setLastRecordedPlay({ playType: data.playType, notation: data.notation })
```

**3e. Render the card** — between the `{/* Scoresheet */}` div and the `{/* Bottom action bar */}` div:
```tsx
{/* Beginner guide card — shown after each recorded play */}
{lastRecordedPlay && (
  <div className="px-3 pt-2 bg-white border-t border-slate-100 relative">
    <button
      onClick={() => setLastRecordedPlay(null)}
      aria-label="Dismiss guide"
      className="absolute top-2 right-3 text-blue-300 hover:text-blue-500 text-xl leading-none z-10"
    >
      ×
    </button>
    <BeginnerGuide playType={lastRecordedPlay.playType} notation={lastRecordedPlay.notation} />
  </div>
)}
```

**Step 4: Run tests**

```bash
npm run test -- --run
```

Expected: all 149+ tests pass.

**Step 5: Commit**

```bash
git add src/pages/GamePage.tsx src/pages/__tests__/GamePage.test.tsx
git commit -m "feat(game): show BeginnerGuide card after each recorded play"
```

---

### Task 4: End-of-Game Overlay

**Design doc:** `docs/plans/2026-02-26-beginner-ux-design.md` — Item 3

**Files:**
- Modify: `src/pages/GamePage.tsx`
- Test: `src/pages/__tests__/GamePage.test.tsx`

**Context:** When `snapshot.isGameOver` is true the "Record Play" button silently disables. Add a full-screen overlay showing the final score, a result line, and a "View Stats" button. A "Back to scoresheet" link dismisses it. `GamePage` needs `useNavigate` added (it currently only uses `useParams`).

**Step 1: Write the failing test**

Add to `src/pages/__tests__/GamePage.test.tsx`. You will need a mock snapshot variant where `isGameOver: true`. Check how the existing test sets up the `useGame` mock — create a helper that returns an `isGameOver: true` snapshot. Add:

```tsx
it('should show game-over overlay when the game ends', async () => {
  // Override the snapshot mock to have isGameOver: true
  // (see existing test file for how mockUseGame / mockSnapshot is structured)
  mockSnapshot.isGameOver = true

  render(<GamePage />)
  await waitFor(() => expect(screen.queryByText('Loading game...')).not.toBeInTheDocument())

  expect(screen.getByText(/game over/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /view stats/i })).toBeInTheDocument()
})

it('should dismiss game-over overlay when "Back to scoresheet" is clicked', async () => {
  const user = userEvent.setup()
  mockSnapshot.isGameOver = true

  render(<GamePage />)
  await waitFor(() => expect(screen.queryByText('Loading game...')).not.toBeInTheDocument())

  await user.click(screen.getByRole('button', { name: /back to scoresheet/i }))
  expect(screen.queryByText(/game over/i)).not.toBeInTheDocument()
})
```

> **Note:** Study the existing `GamePage.test.tsx` carefully before writing these tests — adapt the mock setup to match how `mockSnapshot` is already defined. Set `mockSnapshot.isGameOver = true` before rendering, and restore it in `afterEach` or use a local override.

**Step 2: Run the tests to verify they fail**

```bash
npm run test -- --run src/pages/__tests__/GamePage.test.tsx
```

Expected: FAIL — no "game over" text found.

**Step 3: Implement the overlay**

**3a. Add `useNavigate`** to the react-router-dom import in `src/pages/GamePage.tsx`:
```tsx
import { useParams, useNavigate } from 'react-router-dom'
```

**3b. Instantiate navigate** (after `useParams`):
```tsx
const navigate = useNavigate()
```

**3c. Add state** alongside the other `useState` declarations:
```tsx
const [gameOverDismissed, setGameOverDismissed] = useState(false)
```

**3d. Render the overlay** — as the LAST child inside the outermost `<div className="h-screen flex flex-col ...">`, after the toast notification div:

```tsx
{/* Game-over overlay */}
{snapshot.isGameOver && !gameOverDismissed && (
  <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-50">
    <div className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 text-center">
      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Game Over</div>
      <div className="text-5xl font-bold text-slate-900 mb-1">
        {snapshot.scoreUs} — {snapshot.scoreThem}
      </div>
      <div className="text-lg font-semibold text-slate-600 mb-8">
        {snapshot.scoreUs > snapshot.scoreThem
          ? 'We won!'
          : snapshot.scoreUs < snapshot.scoreThem
            ? 'They won.'
            : 'Tie game.'}
      </div>
      <button
        onClick={() => navigate(`/game/${gId}/stats`)}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold mb-3 transition-all duration-150 active:scale-95"
      >
        View Stats
      </button>
      <button
        onClick={() => setGameOverDismissed(true)}
        className="text-slate-500 hover:text-slate-700 text-sm font-semibold transition-colors"
      >
        Back to scoresheet
      </button>
    </div>
  </div>
)}
```

**Step 4: Run all tests**

```bash
npm run test -- --run
```

Expected: all tests pass.

**Step 5: Commit**

```bash
git add src/pages/GamePage.tsx src/pages/__tests__/GamePage.test.tsx
git commit -m "feat(game): add end-of-game overlay with final score and stats link"
```

---

### Task 5: Batting Order Drag-to-Reorder

**Design doc:** `docs/plans/2026-02-26-beginner-ux-design.md` — Item 5

**Files:**
- Modify: `src/pages/GameSetupPage.tsx`
- Test: `src/pages/__tests__/GameSetupPage.test.tsx`

**Context:** Replace the up/down arrow buttons with a drag-handle using `@dnd-kit/core` and `@dnd-kit/sortable`. Each player row gets a ≡ grip handle on the left. The `battingOrder: number[]` state (array of player IDs) is reordered via `arrayMove` on drag-end. Remove `handleMoveUp` and `handleMoveDown`.

**Step 1: Install dependencies**

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Step 2: Write failing tests**

Add to `src/pages/__tests__/GameSetupPage.test.tsx`:

```tsx
it('should render drag handles for each player in the batting order', async () => {
  render(<GameSetupPage />)
  await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument())

  // Each player row should have a drag handle button
  const handles = screen.getAllByRole('button', { name: /drag/i })
  expect(handles.length).toBeGreaterThan(0)
})

it('should not render up/down arrow buttons', async () => {
  render(<GameSetupPage />)
  await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument())

  // Old arrow buttons should be gone
  expect(screen.queryByRole('button', { name: /↑/i })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /↓/i })).not.toBeInTheDocument()
})
```

**Step 3: Run tests to verify they fail**

```bash
npm run test -- --run src/pages/__tests__/GameSetupPage.test.tsx
```

Expected: FAIL — arrow buttons still present, drag handles not found.

**Step 4: Implement drag-to-reorder**

Replace the contents of `src/pages/GameSetupPage.tsx` with the following. Key changes:
- Import dnd-kit hooks at the top
- Add a `SortablePlayerRow` component at module level (above `GameSetupPage`)
- Replace the batting order list JSX with `DndContext` + `SortableContext`
- Remove `handleMoveUp` and `handleMoveDown`

**4a. Add imports** (at the top of `GameSetupPage.tsx`, after existing imports):

```tsx
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
```

**4b. Add `SortablePlayerRow` component** — place this ABOVE the `GameSetupPage` function definition:

```tsx
interface SortablePlayerRowProps {
  playerId: number
  index: number
  player: Player
}

function SortablePlayerRow({ playerId, index, player }: SortablePlayerRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: playerId })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 bg-white border border-slate-200 rounded px-3 py-2">
      <button
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing px-1 text-lg leading-none"
      >
        ≡
      </button>
      <span className="text-sm font-mono text-slate-400 w-6">{index + 1}.</span>
      <span className="text-sm font-semibold flex-1">{player.name}</span>
      <span className="text-xs text-slate-500">#{player.jerseyNumber}</span>
      <span className="text-xs text-slate-500 w-8">{player.defaultPosition}</span>
    </div>
  )
}
```

**4c. Add sensors and drag handler** inside `GameSetupPage` (replace `handleMoveUp` and `handleMoveDown` with these):

```tsx
const sensors = useSensors(
  useSensor(PointerSensor),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
)

const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event
  if (over && active.id !== over.id) {
    setBattingOrder(prev => {
      const oldIndex = prev.indexOf(active.id as number)
      const newIndex = prev.indexOf(over.id as number)
      return arrayMove(prev, oldIndex, newIndex)
    })
  }
}
```

**4d. Replace the batting order list JSX** — find the `{/* Our batting order */}` section and replace the inner `<div className="space-y-1">` with:

```tsx
<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
  <SortableContext items={battingOrder} strategy={verticalListSortingStrategy}>
    <div className="space-y-1">
      {battingOrder.map((playerId, index) => {
        const player = players.find(p => p.id === playerId)
        if (!player) return null
        return (
          <SortablePlayerRow
            key={playerId}
            playerId={playerId}
            index={index}
            player={player}
          />
        )
      })}
    </div>
  </SortableContext>
</DndContext>
```

**Step 5: Run all tests**

```bash
npm run test -- --run
```

Expected: all tests pass.

**Step 6: Run lint and build**

```bash
npm run lint && npm run build
```

Expected: no errors.

**Step 7: Commit**

```bash
git add src/pages/GameSetupPage.tsx src/pages/__tests__/GameSetupPage.test.tsx package.json package-lock.json
git commit -m "feat(setup): drag-to-reorder batting order with dnd-kit"
```

---

## Verification

After all 5 tasks:

```bash
npm run test -- --run
npm run lint
npm run build
```

All should pass cleanly. Manually verify:
1. Game Setup: Start Game enabled with no opponents entered
2. Game Setup: Drag a player row up/down — order updates in real time
3. Game Page: Record a play → BeginnerGuide card appears above action bar, auto-dismisses in 5s
4. Game Page: Complete a 6-inning game → overlay appears with final score
5. Runner Confirmation: Modal now says "Where did they end up?"
