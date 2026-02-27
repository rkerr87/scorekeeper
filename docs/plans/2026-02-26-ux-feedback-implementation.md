# UX Feedback Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 17 user-reported issues covering runner tracking, pitch management, play recording, position changes, and game flow.

**Architecture:** All fixes follow the existing pure engine + event log pattern. Engine changes are pure functions tested without DOM. Component changes use @testing-library/react. State management changes stay in React Context or GamePage-level state.

**Tech Stack:** React 19, TypeScript, Vitest, @testing-library/react, Tailwind CSS v4, Dexie.js

**Design doc:** `docs/plans/2026-02-26-ux-feedback-design.md`

---

### Task 1: KL Backwards K on PlayEntryPanel Button

**Files:**
- Modify: `src/components/PlayEntryPanel.tsx:26-35` (COMMON_PLAYS array rendering)
- Test: `src/components/__tests__/PlayEntryPanel.test.tsx`

**Step 1: Write the failing test**

In `src/components/__tests__/PlayEntryPanel.test.tsx`, add:

```typescript
it('renders KL button with backwards K visual', () => {
  render(<PlayEntryPanel batterName="Test" onPlayRecorded={vi.fn()} onClose={vi.fn()} />)
  const klButton = screen.getByRole('button', { name: /strikeout looking/i })
  expect(klButton).toBeInTheDocument()
  expect(klButton.querySelector('[data-testid="backwards-k-button"]')).toBeTruthy()
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/components/__tests__/PlayEntryPanel.test.tsx`
Expected: FAIL — no button with name "strikeout looking", current button text is "KL"

**Step 3: Implement**

In `src/components/PlayEntryPanel.tsx`, change the `COMMON_PLAYS` button rendering (inside the `.map()` at line 180-188). Replace the button content for the KL entry:

```tsx
<button
  key={play.label}
  onClick={() => recordSimplePlay(play.playType, play.basesReached)}
  aria-label={play.playType === 'KL' ? 'Strikeout looking' : undefined}
  className="bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-bold text-sm transition-all duration-150 ease-in-out active:scale-95"
>
  {play.playType === 'KL' ? (
    <span data-testid="backwards-k-button" style={{ display: 'inline-block', transform: 'scaleX(-1)' }}>K</span>
  ) : (
    play.label
  )}
</button>
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/components/__tests__/PlayEntryPanel.test.tsx`
Expected: PASS

**Step 5: Commit**

```
feat(play-entry): render KL button as backwards K
```

---

### Task 2: Navigation After Game Over

**Files:**
- Modify: `src/pages/GamePage.tsx:321-350` (game-over overlay)
- Test: `src/pages/__tests__/GamePage.test.tsx`

**Step 1: Write the failing test**

In `src/pages/__tests__/GamePage.test.tsx`, add a test:

```typescript
it('game-over overlay has Home button that navigates to /', async () => {
  // Seed a completed game (18 outs for 6 innings)
  // ... (use existing seedFullGame pattern, seed enough outs)
  const { user } = renderGame(gId)
  await waitFor(() => expect(screen.getByText('Game Over')).toBeInTheDocument())
  const homeButton = screen.getByRole('button', { name: /home/i })
  expect(homeButton).toBeInTheDocument()
  await user.click(homeButton)
  // Verify navigation to '/'
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/pages/__tests__/GamePage.test.tsx`
Expected: FAIL — no button with name "home"

**Step 3: Implement**

In `src/pages/GamePage.tsx`, add a "Home" button to the game-over overlay (between "View Stats" and "Back to scoresheet", around line 341):

```tsx
<button
  onClick={() => navigate('/')}
  className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 py-3 rounded-xl font-bold mb-3 transition-all duration-150 active:scale-95"
>
  Home
</button>
```

Also add a persistent back button in the header. Add to the top of the component JSX (inside the `h-screen flex flex-col` div, before ScoreSummary):

```tsx
<div className="bg-slate-800 px-3 pt-2 flex items-center">
  <button
    onClick={() => navigate('/')}
    aria-label="Back to home"
    className="text-slate-400 hover:text-white text-sm font-semibold transition-colors"
  >
    ← Home
  </button>
</div>
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/pages/__tests__/GamePage.test.tsx`
Expected: PASS

**Step 5: Commit**

```
feat(game): add Home navigation to game-over overlay and header
```

---

### Task 3: RunnerConfirmation — Prevent Backward Movement

**Files:**
- Modify: `src/components/RunnerConfirmation.tsx:102-120` (destination buttons)
- Test: `src/components/__tests__/RunnerConfirmation.test.tsx`

**Step 1: Write the failing test**

In `src/components/__tests__/RunnerConfirmation.test.tsx`, add:

```typescript
it('disables base destinations behind the runner current position', () => {
  const runners = {
    first: null,
    second: { playerName: 'Smith', orderPosition: 3 },
    third: null,
  }
  render(<RunnerConfirmation runners={runners} onConfirm={vi.fn()} onCancel={vi.fn()} />)
  // Runner on 2nd should NOT be able to go to 1st (backward)
  const buttons = screen.getAllByRole('button')
  const firstBaseBtn = buttons.find(b => b.textContent === '1st' && !b.textContent?.includes('Cancel'))
  expect(firstBaseBtn).toBeDisabled()
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/components/__tests__/RunnerConfirmation.test.tsx`
Expected: FAIL — 1st button is not disabled

**Step 3: Implement**

In `src/components/RunnerConfirmation.tsx`, add a helper to determine valid destinations based on origin base, then disable invalid buttons.

Add after the `BASE_LABELS` constant (around line 26):

```typescript
const BASE_ORDER: Record<OrigBase, number> = { first: 1, second: 2, third: 3 }
const DEST_ORDER: Record<RunnerDest, number> = { first: 1, second: 2, third: 3, scored: 4, out: 0 }

function isValidDest(orig: OrigBase, dest: RunnerDest): boolean {
  if (dest === 'out') return true
  if (dest === 'scored') return true
  return DEST_ORDER[dest] > BASE_ORDER[orig]
}
```

Then in the destination button rendering (line 103-119), add `disabled` and styling:

```tsx
{DEST_LABELS.map(({ dest, label }) => {
  const valid = isValidDest(orig, dest)
  return (
    <button
      key={dest}
      onClick={() => setDest(orig, dest)}
      disabled={!valid}
      className={`px-2.5 py-1.5 rounded text-xs font-bold transition-all duration-150 active:scale-95 ${
        !valid
          ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
          : currentDest === dest
            ? dest === 'scored'
              ? 'bg-green-600 text-white ring-2 ring-green-800'
              : dest === 'out'
                ? 'bg-red-500 text-white ring-2 ring-red-700'
                : 'bg-blue-600 text-white ring-2 ring-blue-800'
            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
      }`}
    >
      {label}
    </button>
  )
})}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/components/__tests__/RunnerConfirmation.test.tsx`
Expected: PASS

**Step 5: Commit**

```
fix(runner-confirm): prevent backward base movement
```

---

### Task 4: RunnerConfirmation — Fix Initial Position Display

The current bug: `RunnerConfirmation` receives `tempSnapshot.baseRunners` (post-play state) but labels them as "was on X", which is wrong. The runners' ACTUAL positions before the play come from `snapshot.baseRunners`.

**Files:**
- Modify: `src/components/RunnerConfirmation.tsx` (add `prePlayRunners` prop, use for labels)
- Modify: `src/pages/GamePage.tsx:141-145,305-311` (pass pre-play runners)
- Test: `src/components/__tests__/RunnerConfirmation.test.tsx`

**Step 1: Write the failing test**

```typescript
it('shows runner original base positions (pre-play) in labels', () => {
  // Pre-play: runner on 1st. Post-play (engine default): runner now on 2nd
  const prePlayRunners = {
    first: { playerName: 'Smith', orderPosition: 3 },
    second: null,
    third: null,
  }
  const postPlayRunners = {
    first: null,
    second: { playerName: 'Smith', orderPosition: 3 },
    third: null,
  }
  render(
    <RunnerConfirmation
      prePlayRunners={prePlayRunners}
      runners={postPlayRunners}
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
    />
  )
  // Should show "was on 1st" not "was on 2nd"
  expect(screen.getByText(/was on 1st/)).toBeInTheDocument()
  // Default selection should be 2nd (from post-play)
  const secondBtn = screen.getByRole('button', { name: '2nd' })
  // It should be the selected one (blue bg)
  expect(secondBtn.className).toContain('bg-blue-600')
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/components/__tests__/RunnerConfirmation.test.tsx`
Expected: FAIL — `prePlayRunners` prop doesn't exist

**Step 3: Implement**

In `src/components/RunnerConfirmation.tsx`:

1. Add `prePlayRunners` to props interface (optional for backward compat):
```typescript
interface RunnerConfirmationProps {
  prePlayRunners?: BaseRunners
  runners: BaseRunners     // post-play runners (engine default)
  onConfirm: (result: { runners: BaseRunners; runsScored: number }) => void
  onCancel: () => void
  initialRunsScored?: number
}
```

2. Compute `occupiedBases` from `prePlayRunners` (where runners actually were):
```typescript
const actualPre = prePlayRunners ?? runners
const occupiedBases: OrigBase[] = (['third', 'second', 'first'] as OrigBase[]).filter(b => actualPre[b] !== null)
```

3. Update `initAssignments` to map from pre-play base to post-play destination:
```typescript
function initAssignments(preRunners: BaseRunners, postRunners: BaseRunners): Map<OrigBase, RunnerDest> {
  const m = new Map<OrigBase, RunnerDest>()
  for (const orig of ['first', 'second', 'third'] as OrigBase[]) {
    const runner = preRunners[orig]
    if (!runner) continue
    // Find where this runner ended up in post-play state
    let dest: RunnerDest = 'scored' // default: if not found on any base, they scored
    for (const base of ['first', 'second', 'third'] as OrigBase[]) {
      if (postRunners[base]?.orderPosition === runner.orderPosition) {
        dest = base
        break
      }
    }
    m.set(orig, dest)
  }
  return m
}
```

4. Update `computeResult` to use `prePlayRunners` for runner identity:
```typescript
function computeResult(
  runners: BaseRunners,  // pre-play runners (for identity)
  assignments: Map<OrigBase, RunnerDest>,
  initialRunsScored: number,
): { runners: BaseRunners; runsScored: number } {
  // ... (same logic, using pre-play runners for identity)
```

5. Update labels to use pre-play bases (already correct via `occupiedBases` from pre-play).

6. In `src/pages/GamePage.tsx`, pass `prePlayRunners`:

At line 142, add: `setPendingPrePlayRunners(snapshot.baseRunners)` (new state)

At line 306, add prop: `prePlayRunners={pendingPrePlayRunners}`

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/components/__tests__/RunnerConfirmation.test.tsx`
Expected: PASS

**Step 5: Run all tests**

Run: `npm run test -- --run`
Expected: All tests pass (update any existing RunnerConfirmation tests that need the new prop)

**Step 6: Commit**

```
fix(runner-confirm): show correct pre-play base positions and default post-play assignments
```

---

### Task 5: Engine — Walk-Off / Skip Bottom of Last Inning

**Files:**
- Modify: `src/engine/engine.ts:45-54,296-302` (advanceHalfInning, game-over check)
- Test: `src/engine/__tests__/engine.test.ts`

**Step 1: Write the failing tests**

In `src/engine/__tests__/engine.test.ts`, add:

```typescript
describe('walk-off and skip bottom of last inning', () => {
  it('skips bottom of 6th when home team already leads after top of 6th', () => {
    // Home team = us, away = them
    // Score: us 5, them 3 going into bottom of 6th
    // After 3rd out in top of 6th, game should end immediately
    const plays = [
      // ... create plays that result in us leading 5-3 after top 6 ends
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem, 'home')
    expect(snapshot.isGameOver).toBe(true)
    expect(snapshot.scoreUs).toBeGreaterThan(snapshot.scoreThem)
  })

  it('ends game immediately on walk-off hit in bottom of last inning', () => {
    // Home team = us, tied 3-3 going into bottom of 6th
    // Us scores a run in bottom of 6th → game over immediately
    const plays = [
      // ... create plays through top 6 with score tied
      // ... then a play in bottom 6 that scores a run
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem, 'home')
    expect(snapshot.isGameOver).toBe(true)
    expect(snapshot.scoreUs).toBe(4)
    expect(snapshot.scoreThem).toBe(3)
  })

  it('plays bottom of 6th when away team leads (home team needs to bat)', () => {
    // Away = them, them leads 5-3 after top of 6th
    // Home team (us) needs to bat — game NOT over yet
    const plays = [
      // ... create plays through top 6 with them leading
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem, 'home')
    expect(snapshot.isGameOver).toBe(false)
    expect(snapshot.half).toBe('bottom')
    expect(snapshot.inning).toBe(6)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npm run test -- --run src/engine/__tests__/engine.test.ts`
Expected: FAIL — walk-off tests fail because engine doesn't check for these conditions

**Step 3: Implement**

In `src/engine/engine.ts`, modify the game-over check at lines 296-302:

```typescript
// Check for inning change and game-over conditions
if (snapshot.outs >= 3) {
  advanceHalfInning(snapshot)

  // Standard game over: completed all innings
  if (snapshot.inning > 6) {
    snapshot.isGameOver = true
  }
  // Skip bottom of last inning: home team already leads
  else if (snapshot.inning === 6 && snapshot.half === 'bottom') {
    const homeScore = homeOrAway === 'home' ? snapshot.scoreUs : snapshot.scoreThem
    const awayScore = homeOrAway === 'home' ? snapshot.scoreThem : snapshot.scoreUs
    if (homeScore > awayScore) {
      snapshot.isGameOver = true
    }
  }
}

// Walk-off: home team takes lead in bottom of 6th or later
if (!snapshot.isGameOver && snapshot.inning >= 6 && snapshot.half === 'bottom') {
  const homeScore = homeOrAway === 'home' ? snapshot.scoreUs : snapshot.scoreThem
  const awayScore = homeOrAway === 'home' ? snapshot.scoreThem : snapshot.scoreUs
  if (homeScore > awayScore && runsScored > 0) {
    snapshot.isGameOver = true
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run test -- --run src/engine/__tests__/engine.test.ts`
Expected: PASS

**Step 5: Run all tests**

Run: `npm run test -- --run`
Expected: All pass

**Step 6: Commit**

```
feat(engine): add walk-off logic and skip bottom of last inning when home team leads
```

---

### Task 6: Pitch Tracking — Lift State to GamePage

This is the biggest behavioral change. Pitch state moves from PlayEntryPanel (local) to GamePage (persistent).

**Files:**
- Modify: `src/pages/GamePage.tsx` (add `currentAtBatPitches` state, pass to PlayEntryPanel)
- Modify: `src/components/PlayEntryPanel.tsx` (accept pitches as props instead of local state)
- Test: `src/pages/__tests__/GamePage.test.tsx`
- Test: `src/components/__tests__/PlayEntryPanel.test.tsx`

**Step 1: Write the failing test**

In `src/pages/__tests__/GamePage.test.tsx`, add:

```typescript
it('preserves pitch tracking when play entry panel is closed and reopened', async () => {
  const { user } = renderGame(gId)
  // Open play entry
  await user.click(screen.getByRole('button', { name: /record play/i }))
  // Add a ball
  await user.click(screen.getByRole('button', { name: /ball/i }))
  expect(screen.getByText('1-0')).toBeInTheDocument()
  // Close the panel
  await user.click(screen.getByText('×'))
  // Reopen
  await user.click(screen.getByRole('button', { name: /record play/i }))
  // Count should still be 1-0
  expect(screen.getByText('1-0')).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/pages/__tests__/GamePage.test.tsx`
Expected: FAIL — after reopen, count resets to 0-0

**Step 3: Implement**

In `src/pages/GamePage.tsx`, add state after line 45:

```typescript
const [currentAtBatPitches, setCurrentAtBatPitches] = useState<PitchResult[]>([])
```

Add pitch handlers:

```typescript
const handleAddPitch = (p: PitchResult) => setCurrentAtBatPitches(prev => [...prev, p])
const handleRemovePitch = () => setCurrentAtBatPitches(prev => prev.slice(0, -1))
```

Clear pitches when play is recorded — in `finalizePlay` after `recordPlay(...)`:

```typescript
setCurrentAtBatPitches([])
```

Also clear pitches when the batter changes (half-inning advance). In the auto-switch block (line 81-86), add:

```typescript
setCurrentAtBatPitches([])
```

Pass pitch props to PlayEntryPanel:

```tsx
<PlayEntryPanel
  batterName={currentBatterSlot?.playerName ?? 'Unknown'}
  baseRunners={snapshot.baseRunners}
  pitches={currentAtBatPitches}
  onAddPitch={handleAddPitch}
  onRemovePitch={handleRemovePitch}
  onPlayRecorded={handlePlayRecorded}
  onClose={() => setShowPlayEntry(false)}
/>
```

In `src/components/PlayEntryPanel.tsx`, change the interface and remove local pitch state:

```typescript
interface PlayEntryPanelProps {
  batterName: string
  baseRunners?: BaseRunners
  pitches: PitchResult[]
  onAddPitch: (pitch: PitchResult) => void
  onRemovePitch: () => void
  onPlayRecorded: (data: PlayRecordedData) => void
  onClose: () => void
}
```

Remove lines 56 (local pitches state), 63-64 (local handlers). Use the props instead.

Update destructuring:
```typescript
export function PlayEntryPanel({ batterName, baseRunners, pitches, onAddPitch, onRemovePitch, onPlayRecorded, onClose }: PlayEntryPanelProps) {
```

Update PitchTracker usage:
```tsx
<PitchTracker pitches={pitches} onAddPitch={onAddPitch} onRemovePitch={onRemovePitch} />
```

**Step 4: Run tests to verify they pass**

Run: `npm run test -- --run`
Expected: PASS (update any PlayEntryPanel tests that render it standalone to pass pitch props)

**Step 5: Commit**

```
refactor(pitch): lift pitch tracking state from PlayEntryPanel to GamePage for persistence
```

---

### Task 7: Pitch Tracking — Auto-Walk on 4th Ball + Auto-Strikeout on 3rd Strike

**Files:**
- Modify: `src/pages/GamePage.tsx` (auto-complete logic in handleAddPitch)
- Test: `src/pages/__tests__/GamePage.test.tsx`

**Step 1: Write the failing tests**

```typescript
it('auto-records walk after 4th ball', async () => {
  const { user } = renderGame(gId)
  await user.click(screen.getByRole('button', { name: /record play/i }))
  // Click Ball 4 times
  for (let i = 0; i < 4; i++) {
    await user.click(screen.getByRole('button', { name: /ball/i }))
  }
  // Panel should close and play should be recorded as BB
  await waitFor(() => {
    expect(screen.queryByText('At bat:')).not.toBeInTheDocument()
  })
  // Verify BB was recorded (batter advanced)
})

it('shows K vs KL confirmation after 3rd strike', async () => {
  const { user } = renderGame(gId)
  await user.click(screen.getByRole('button', { name: /record play/i }))
  // Click Strike 3 times
  for (let i = 0; i < 3; i++) {
    await user.click(screen.getByRole('button', { name: /^strike$/i }))
  }
  // Should show confirmation dialog
  await waitFor(() => {
    expect(screen.getByText(/swinging or looking/i)).toBeInTheDocument()
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npm run test -- --run src/pages/__tests__/GamePage.test.tsx`

**Step 3: Implement**

In `src/pages/GamePage.tsx`, replace the simple `handleAddPitch` with:

```typescript
const handleAddPitch = (p: PitchResult) => {
  const newPitches = [...currentAtBatPitches, p]
  setCurrentAtBatPitches(newPitches)

  // Count balls and strikes
  let balls = 0, strikes = 0
  for (const pitch of newPitches) {
    if (pitch === 'B') balls++
    else if (pitch === 'S') strikes++
    else if (pitch === 'F') strikes = Math.min(strikes + 1, 2)
  }

  // Auto-walk on 4th ball
  if (balls >= 4) {
    const walkPlay: PendingPlay = {
      playType: 'BB',
      notation: 'BB',
      fieldersInvolved: [],
      basesReached: [1],
      pitches: newPitches,
      isAtBat: true,
    }
    setShowPlayEntry(false)
    handlePlayRecorded(walkPlay)
    return
  }

  // Auto-strikeout on 3rd strike (only triggered by 'S', not 'F')
  if (p === 'S' && strikes >= 3) {
    setShowStrikeoutConfirm(true)
  }
}
```

Add state for the strikeout confirmation dialog:

```typescript
const [showStrikeoutConfirm, setShowStrikeoutConfirm] = useState(false)
```

Add the confirmation handler:

```typescript
const handleStrikeoutConfirm = (type: 'K' | 'KL') => {
  const play: PendingPlay = {
    playType: type,
    notation: type === 'KL' ? 'KL' : 'K',
    fieldersInvolved: [],
    basesReached: [],
    pitches: currentAtBatPitches,
    isAtBat: true,
  }
  setShowStrikeoutConfirm(false)
  setShowPlayEntry(false)
  handlePlayRecorded(play)
}
```

Add the confirmation UI (render near other modals):

```tsx
{showStrikeoutConfirm && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-xl p-6 max-w-xs w-full mx-4 text-center">
      <h3 className="text-lg font-bold text-slate-900 mb-4">Swinging or looking?</h3>
      <div className="flex gap-3">
        <button
          onClick={() => handleStrikeoutConfirm('K')}
          className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-bold"
        >
          K (Swinging)
        </button>
        <button
          onClick={() => handleStrikeoutConfirm('KL')}
          className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-bold"
        >
          <span style={{ display: 'inline-block', transform: 'scaleX(-1)' }}>K</span> (Looking)
        </button>
      </div>
    </div>
  </div>
)}
```

**Step 4: Run tests**

Run: `npm run test -- --run`
Expected: PASS

**Step 5: Commit**

```
feat(pitch): auto-record walk on 4th ball, confirm K/KL on 3rd strike
```

---

### Task 8: Pitch Tracking — Clear Count + Editable Pitches

**Files:**
- Modify: `src/components/PitchTracker.tsx` (add clear button, tap-to-remove dots, edit mode)
- Test: `src/components/__tests__/PitchTracker.test.tsx`

**Step 1: Write the failing tests**

```typescript
it('shows clear count button when pitches exist', () => {
  render(<PitchTracker pitches={['B', 'S']} onAddPitch={vi.fn()} onRemovePitch={vi.fn()} onClear={vi.fn()} onReplace={vi.fn()} />)
  expect(screen.getByRole('button', { name: /clear count/i })).toBeInTheDocument()
})

it('calls onClear when clear count is confirmed', async () => {
  const onClear = vi.fn()
  const user = userEvent.setup()
  render(<PitchTracker pitches={['B', 'S']} onAddPitch={vi.fn()} onRemovePitch={vi.fn()} onClear={onClear} onReplace={vi.fn()} />)
  await user.click(screen.getByRole('button', { name: /clear count/i }))
  // Confirm dialog
  await user.click(screen.getByRole('button', { name: /confirm/i }))
  expect(onClear).toHaveBeenCalled()
})

it('tapping a pitch dot removes it', async () => {
  const onReplace = vi.fn()
  const user = userEvent.setup()
  render(<PitchTracker pitches={['B', 'S', 'F']} onAddPitch={vi.fn()} onRemovePitch={vi.fn()} onClear={vi.fn()} onReplace={onReplace} />)
  const dots = screen.getAllByTestId('pitch-dot')
  await user.click(dots[1]) // click the 'S' dot
  // Should show a mini menu to change or remove
  await user.click(screen.getByRole('button', { name: /remove/i }))
  expect(onReplace).toHaveBeenCalledWith(['B', 'F'])
})
```

**Step 2: Run tests to verify they fail**

Run: `npm run test -- --run src/components/__tests__/PitchTracker.test.tsx`

**Step 3: Implement**

Add new props to PitchTracker:

```typescript
interface PitchTrackerProps {
  pitches: PitchResult[]
  onAddPitch: (pitch: PitchResult) => void
  onRemovePitch: () => void
  onClear: () => void
  onReplace: (newPitches: PitchResult[]) => void
}
```

Add clear count button (with confirmation state), and make pitch dots interactive (tap to remove or cycle type). Add a small "x" icon on each dot and a confirm dialog for clear.

In GamePage, add handlers:

```typescript
const handleClearPitches = () => setCurrentAtBatPitches([])
const handleReplacePitches = (newPitches: PitchResult[]) => setCurrentAtBatPitches(newPitches)
```

**Step 4: Run tests**

Run: `npm run test -- --run`
Expected: PASS

**Step 5: Commit**

```
feat(pitch): add clear count, tap-to-edit pitch dots
```

---

### Task 9: Contextual Play Options — Disable Impossible Plays

**Files:**
- Modify: `src/components/PlayEntryPanel.tsx:208-222` (disable buttons based on game state)
- Test: `src/components/__tests__/PlayEntryPanel.test.tsx`

**Step 1: Write the failing tests**

```typescript
it('disables FC, SAC, DP, SB, WP, PB, BK when bases empty', () => {
  render(
    <PlayEntryPanel
      batterName="Test"
      baseRunners={{ first: null, second: null, third: null }}
      pitches={[]}
      onAddPitch={vi.fn()} onRemovePitch={vi.fn()}
      onPlayRecorded={vi.fn()} onClose={vi.fn()}
    />
  )
  expect(screen.getByRole('button', { name: 'FC' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'SB' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'WP' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'PB' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'BK' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'DP' })).toBeDisabled()
})

it('disables SAC when there are 2 outs', () => {
  render(
    <PlayEntryPanel
      batterName="Test"
      baseRunners={{ first: { playerName: 'A', orderPosition: 1 }, second: null, third: null }}
      outs={2}
      pitches={[]}
      onAddPitch={vi.fn()} onRemovePitch={vi.fn()}
      onPlayRecorded={vi.fn()} onClose={vi.fn()}
    />
  )
  expect(screen.getByRole('button', { name: 'SAC' })).toBeDisabled()
})

it('enables special plays when runners are on base', () => {
  render(
    <PlayEntryPanel
      batterName="Test"
      baseRunners={{ first: { playerName: 'A', orderPosition: 1 }, second: null, third: null }}
      pitches={[]}
      onAddPitch={vi.fn()} onRemovePitch={vi.fn()}
      onPlayRecorded={vi.fn()} onClose={vi.fn()}
    />
  )
  expect(screen.getByRole('button', { name: 'FC' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'SB' })).toBeEnabled()
})
```

**Step 2: Run tests to verify they fail**

Run: `npm run test -- --run src/components/__tests__/PlayEntryPanel.test.tsx`

**Step 3: Implement**

Add `outs` prop to PlayEntryPanel:

```typescript
interface PlayEntryPanelProps {
  batterName: string
  baseRunners?: BaseRunners
  outs?: number
  pitches: PitchResult[]
  onAddPitch: (pitch: PitchResult) => void
  onRemovePitch: () => void
  onPlayRecorded: (data: PlayRecordedData) => void
  onClose: () => void
}
```

Add computed flags:

```typescript
const hasRunners = !!(baseRunners?.first || baseRunners?.second || baseRunners?.third)
const RUNNER_REQUIRED_PLAYS: PlayType[] = ['FC', 'DP', 'SAC', 'SB', 'WP', 'PB', 'BK']
```

In the SPECIAL_PLAYS button rendering, add disabled logic:

```tsx
{SPECIAL_PLAYS.map(play => {
  const needsRunners = RUNNER_REQUIRED_PLAYS.includes(play.playType)
  const isSacWith2Outs = play.playType === 'SAC' && (outs ?? 0) >= 2
  const disabled = (needsRunners && !hasRunners) || isSacWith2Outs
  return (
    <button
      key={play.label}
      onClick={() => ...}
      disabled={disabled}
      className={`py-2 rounded font-bold text-sm transition-all duration-150 ease-in-out active:scale-95 ${
        disabled
          ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
          : 'bg-amber-600 hover:bg-amber-700 text-white'
      }`}
    >
      {play.label}
    </button>
  )
})}
```

Pass `outs` from GamePage:

```tsx
<PlayEntryPanel
  ...
  outs={snapshot.outs}
/>
```

**Step 4: Run tests**

Run: `npm run test -- --run`
Expected: PASS

**Step 5: Commit**

```
feat(play-entry): disable impossible plays based on game state
```

---

### Task 10: Error Asks for Position (E → FieldDiagram)

**Files:**
- Modify: `src/components/PlayEntryPanel.tsx` (E button enters fielding mode for single position)
- Test: `src/components/__tests__/PlayEntryPanel.test.tsx`

**Step 1: Write the failing test**

```typescript
it('E button opens field diagram for position selection', async () => {
  const user = userEvent.setup()
  const onPlayRecorded = vi.fn()
  render(
    <PlayEntryPanel
      batterName="Test"
      pitches={[]}
      onAddPitch={vi.fn()} onRemovePitch={vi.fn()}
      onPlayRecorded={onPlayRecorded} onClose={vi.fn()}
    />
  )
  await user.click(screen.getByRole('button', { name: 'E' }))
  // Should show field diagram
  expect(screen.getByText(/tap fielder/i)).toBeInTheDocument()
  // Select SS (position 6)
  await user.click(screen.getByRole('button', { name: /6.*SS/i }))
  await user.click(screen.getByRole('button', { name: /confirm/i }))
  expect(onPlayRecorded).toHaveBeenCalledWith(
    expect.objectContaining({
      playType: 'E',
      notation: 'E6',
      fieldersInvolved: [6],
      basesReached: [1],
    })
  )
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/components/__tests__/PlayEntryPanel.test.tsx`

**Step 3: Implement**

In `src/components/PlayEntryPanel.tsx`, change the E button handler. Remove E from SPECIAL_PLAYS simple handler. In the click handler for E, enter fielding mode with a special `fieldingPlayType`:

```typescript
// In the SPECIAL_PLAYS onClick, add special handling for E
onClick={() => {
  if (play.playType === 'E') {
    setFieldingPlayType('E')
    setSelectedPositions([])
    setMode('fielding')
  } else if (play.playType === 'SB') {
    handleSbClick()
  } else {
    recordSimplePlay(play.playType, play.basesReached, play.isAtBat)
  }
}}
```

Update `handleConfirmFielding` to handle E:

```typescript
const handleConfirmFielding = () => {
  if (fieldingPlayType === 'E') {
    const notation = generateNotation('E', selectedPositions)
    onPlayRecorded({
      playType: 'E',
      notation,
      fieldersInvolved: selectedPositions,
      basesReached: [1],
      pitches,
      isAtBat: true,
    })
  } else {
    // existing fielding logic
  }
}
```

For E, limit to single position selection (first click confirms):

In the fielding mode UI, if `fieldingPlayType === 'E'`, show "Tap the fielder who made the error" and auto-confirm on first position click, OR use the existing confirm flow but limit to 1 position.

**Step 4: Run tests**

Run: `npm run test -- --run`
Expected: PASS

**Step 5: Commit**

```
feat(play-entry): E button opens field diagram for position selection (E6, E4, etc.)
```

---

### Task 11: Engine — Runner Journey Computation

**Files:**
- Create: `src/engine/journeys.ts` (pure function to compute runner journeys)
- Test: `src/engine/__tests__/journeys.test.ts`

**Step 1: Write the failing tests**

```typescript
import { describe, it, expect } from 'vitest'
import { computeRunnerJourneys } from '../journeys'
import type { Play, Lineup } from '../types'

// Helper to make test lineup and plays
// ...

describe('computeRunnerJourneys', () => {
  it('returns batter bases when no subsequent advancement', () => {
    // Player A singles in inning 1 (basesReached: [1])
    // No subsequent plays that advance Player A
    const journeys = computeRunnerJourneys(plays, lineupUs, lineupThem, 'home')
    expect(journeys.get(play1.id!)).toEqual([1])
  })

  it('extends journey when runner advances on subsequent play', () => {
    // Inning 1: Player A singles (reaches 1st)
    // Inning 1: Player B singles (Player A advances to 2nd)
    const journeys = computeRunnerJourneys(plays, lineupUs, lineupThem, 'home')
    expect(journeys.get(playA.id!)).toEqual([1, 2]) // A's full journey
    expect(journeys.get(playB.id!)).toEqual([1])     // B's journey (just 1st)
  })

  it('tracks runner all the way home when they score', () => {
    // Player A singles, then advances on subsequent plays to score
    const journeys = computeRunnerJourneys(plays, lineupUs, lineupThem, 'home')
    expect(journeys.get(playA.id!)).toEqual([1, 2, 3, 4]) // full journey home
  })

  it('returns empty array for strikeouts and outs', () => {
    const journeys = computeRunnerJourneys(plays, lineupUs, lineupThem, 'home')
    expect(journeys.get(strikeoutPlay.id!)).toEqual([])
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npm run test -- --run src/engine/__tests__/journeys.test.ts`

**Step 3: Implement**

Create `src/engine/journeys.ts`:

```typescript
import type { Play, Lineup, HomeOrAway, BaseRunners } from './types'
import { replayGame } from './engine'

/**
 * Compute the full base journey for each at-bat play.
 * Returns Map<playId, number[]> where the array tracks every base
 * the batter reached through their own hit AND subsequent advancement.
 */
export function computeRunnerJourneys(
  plays: Play[],
  lineupUs: Lineup,
  lineupThem: Lineup,
  homeOrAway: HomeOrAway,
): Map<number, number[]> {
  const journeys = new Map<number, number[]>()
  const sorted = [...plays].sort((a, b) => a.sequenceNumber - b.sequenceNumber)

  // For each play, track: which orderPosition reached which base
  // We replay the game incrementally, checking runner positions after each play
  type RunnerTracker = { playId: number; currentBase: number }
  // Map: orderPosition+half → tracker (a runner can only be on base from one play at a time)
  const activeRunners = new Map<string, RunnerTracker>()

  // Replay incrementally
  for (let i = 0; i < sorted.length; i++) {
    const currentPlays = sorted.slice(0, i + 1)
    const snapshot = replayGame(currentPlays, lineupUs, lineupThem, homeOrAway)
    const play = sorted[i]

    if (!play.id) continue

    // Initialize journey for this play's batter
    if (play.isAtBat) {
      journeys.set(play.id, [...play.basesReached])

      // If batter reached base, track them
      if (play.basesReached.length > 0) {
        const maxBase = Math.max(...play.basesReached)
        if (maxBase < 4) { // didn't score (HR scores immediately)
          const key = `${play.batterOrderPosition}-${play.half}`
          activeRunners.set(key, { playId: play.id, currentBase: maxBase })
        }
      }
    } else {
      journeys.set(play.id, [])
    }

    // After this play, check where all active runners are now
    const bases: [string, number | null][] = [
      ['first', snapshot.baseRunners.first?.orderPosition ?? null],
      ['second', snapshot.baseRunners.second?.orderPosition ?? null],
      ['third', snapshot.baseRunners.third?.orderPosition ?? null],
    ]

    // For each active runner, update their journey based on current position
    for (const [key, tracker] of activeRunners) {
      const [orderPos, half] = key.split('-')
      const pos = parseInt(orderPos)

      // Find where this runner is now
      let newBase = 0
      for (const [baseName, runnerPos] of bases) {
        if (runnerPos === pos) {
          newBase = baseName === 'first' ? 1 : baseName === 'second' ? 2 : 3
          break
        }
      }

      if (newBase === 0 && tracker.currentBase > 0) {
        // Runner is no longer on any base — they either scored or got out
        // Check if runs scored on this play for this runner's team
        const journey = journeys.get(tracker.playId) ?? []
        // Add bases up to home
        for (let b = tracker.currentBase + 1; b <= 4; b++) {
          if (!journey.includes(b)) journey.push(b)
        }
        journeys.set(tracker.playId, journey)
        activeRunners.delete(key)
      } else if (newBase > tracker.currentBase) {
        // Runner advanced
        const journey = journeys.get(tracker.playId) ?? []
        for (let b = tracker.currentBase + 1; b <= newBase; b++) {
          if (!journey.includes(b)) journey.push(b)
        }
        journeys.set(tracker.playId, journey)
        tracker.currentBase = newBase
      }
    }
  }

  return journeys
}
```

Note: This replays the game for each play which is O(n²). For a 60-80 play game this is still fast (<10ms). If needed, optimize later by tracking state incrementally.

**Step 4: Run tests**

Run: `npm run test -- --run src/engine/__tests__/journeys.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(engine): add computeRunnerJourneys for Glover's continuation lines
```

---

### Task 12: Diamond Continuation Lines + Scoresheet Integration

**Files:**
- Modify: `src/components/Diamond.tsx` (add `continuationBases` prop, draw dashed lines)
- Modify: `src/components/AtBatCell.tsx` (add `continuationBases` to CellPlayData)
- Modify: `src/components/Scoresheet.tsx` (compute journeys, pass to cells)
- Modify: `src/pages/GamePage.tsx` (pass lineups to Scoresheet for journey computation)
- Test: `src/components/__tests__/Diamond.test.tsx`

**Step 1: Write the failing test**

```typescript
it('renders dashed continuation lines for runner advancement', () => {
  const { container } = render(
    <Diamond basesReached={[1]} continuationBases={[2, 3]} />
  )
  // Original path: solid line to 1st
  const paths = container.querySelectorAll('[data-testid="base-path"]')
  expect(paths.length).toBe(1) // home→1st solid

  // Continuation paths: dashed lines 1st→2nd, 2nd→3rd
  const contPaths = container.querySelectorAll('[data-testid="continuation-path"]')
  expect(contPaths.length).toBe(2)
  expect(contPaths[0].getAttribute('stroke-dasharray')).toBeTruthy()
})

it('fills diamond when runner eventually scores via continuation', () => {
  const { container } = render(
    <Diamond basesReached={[1]} continuationBases={[2, 3, 4]} runScored={true} />
  )
  expect(container.querySelector('[data-testid="run-scored"]')).toBeTruthy()
})
```

**Step 2: Run test to verify it fails**

**Step 3: Implement**

In `src/components/Diamond.tsx`, add `continuationBases` prop:

```typescript
interface DiamondProps {
  basesReached: number[]
  continuationBases?: number[]  // bases reached via subsequent advancement
  runScored?: boolean
  notation?: string
  pitches?: PitchResult[]
  size?: number
}
```

Build continuation path segments (dashed lines):

```typescript
const contSegments: string[] = []
if (continuationBases && continuationBases.length > 0) {
  const allBases = [...basesReached, ...continuationBases]
  // Draw from last batter-reached base through continuation bases
  for (let i = 0; i < continuationBases.length; i++) {
    const fromBase = i === 0 ? (basesReached.length > 0 ? Math.max(...basesReached) : 0) : continuationBases[i - 1]
    const toBase = continuationBases[i]
    const from = baseCoord(fromBase)
    const to = baseCoord(toBase)
    if (from && to) {
      contSegments.push(`M ${from.x} ${from.y} L ${to.x} ${to.y}`)
    }
  }
}
```

Render continuation paths with dashed stroke:

```tsx
{contSegments.map((d, i) => (
  <path
    key={`cont-${i}`}
    data-testid="continuation-path"
    d={d}
    fill="none"
    stroke="#1e40af"
    strokeWidth="2"
    strokeLinecap="round"
    strokeDasharray="4 3"
    opacity="0.6"
  />
))}
```

In `src/components/AtBatCell.tsx`, add `continuationBases` to `CellPlayData`:

```typescript
interface CellPlayData {
  playType: string
  notation: string
  basesReached: number[]
  continuationBases?: number[]
  runsScoredOnPlay: number
  pitches: PitchResult[]
}
```

Pass to Diamond:

```tsx
<Diamond
  basesReached={play.basesReached}
  continuationBases={play.continuationBases}
  runScored={play.runsScoredOnPlay > 0 || (play.continuationBases?.includes(4) ?? false)}
  notation={play.notation}
  pitches={play.pitches}
  size={56}
/>
```

In `src/components/Scoresheet.tsx`, import and use `computeRunnerJourneys`. Add `lineupUs`, `lineupThem`, `homeOrAway`, and `allPlays` (unfiltered) props to compute journeys:

```typescript
interface ScoresheetProps {
  lineup: LineupSlot[]
  plays: Play[]
  allPlays?: Play[]         // all plays (both teams) for journey computation
  lineupUs?: Lineup
  lineupThem?: Lineup
  homeOrAway?: HomeOrAway
  currentInning: number
  currentBatterPosition: number
  maxInnings: number
  onCellClick: (batterPosition: number, inning: number) => void
  runsMap?: Map<number, number>
}
```

Compute journeys and pass to cells:

```typescript
const journeys = allPlays && lineupUs && lineupThem && homeOrAway
  ? computeRunnerJourneys(allPlays, lineupUs, lineupThem, homeOrAway)
  : new Map()

// In cell rendering:
const journey = play?.id ? journeys.get(play.id) : undefined
const continuationBases = journey && play
  ? journey.filter(b => !play.basesReached.includes(b))
  : undefined
```

Pass from GamePage:

```tsx
<Scoresheet
  lineup={activeLineup.battingOrder}
  plays={activePlays}
  allPlays={plays}
  lineupUs={lineupUs}
  lineupThem={lineupThem}
  homeOrAway={game.homeOrAway}
  ...
/>
```

**Step 4: Run tests**

Run: `npm run test -- --run`
Expected: PASS

**Step 5: Commit**

```
feat(scoresheet): Glover's continuation lines showing runner advancement in cells
```

---

### Task 13: Score Matching Fix — Diamond runScored vs Score Total

The score total comes from `snapshot.scoreUs/scoreThem` which sums `runsScored` from `applyBaseRunning()`. The diamond fills yellow when `runsScoredOnPlay > 0` on the BATTER's play. With continuation lines (Task 12), the RUNNER's cell now also fills yellow when `continuationBases.includes(4)`. This should resolve the visual mismatch.

**Files:**
- Test: `src/engine/__tests__/engine.test.ts` (verify score matches)
- Test: integration test with Scoresheet

**Step 1: Write the test**

```typescript
it('total score equals count of plays where runner scored (including continuation)', () => {
  // Set up a game with several runs scored
  // Verify snapshot.scoreUs matches the number of plays where a runner eventually scores
  const snapshot = replayGame(plays, lineupUs, lineupThem, 'home')
  const journeys = computeRunnerJourneys(plays, lineupUs, lineupThem, 'home')

  let visualRuns = 0
  for (const [, journey] of journeys) {
    if (journey.includes(4)) visualRuns++
  }

  expect(visualRuns).toBe(snapshot.scoreUs + snapshot.scoreThem)
})
```

**Step 2: Run test**

If it passes, the continuation lines fix resolves the score mismatch. If it fails, investigate and fix the discrepancy.

**Step 3: Commit**

```
test(engine): verify score total matches visual diamond fills
```

---

### Task 14: Cell Interaction — Play Detail Popover

**Files:**
- Create: `src/components/PlayDetailPopover.tsx`
- Modify: `src/components/Scoresheet.tsx` (different click behavior per cell state)
- Modify: `src/pages/GamePage.tsx` (manage popover state, handle edit/undo from popover)
- Test: `src/components/__tests__/PlayDetailPopover.test.tsx`
- Test: `src/pages/__tests__/GamePage.test.tsx`

**Step 1: Write the failing tests**

For PlayDetailPopover:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlayDetailPopover } from '../PlayDetailPopover'

describe('PlayDetailPopover', () => {
  const play = {
    id: 1,
    playType: '1B' as const,
    notation: '1B',
    basesReached: [1],
    pitches: ['B', 'S', 'F', 'B'] as const,
    runsScoredOnPlay: 0,
  }

  it('shows play notation and pitch summary', () => {
    render(<PlayDetailPopover play={play} onEdit={vi.fn()} onUndo={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('1B')).toBeInTheDocument()
    expect(screen.getByText(/2-1/)).toBeInTheDocument() // ball-strike count
    expect(screen.getByText(/4 pitches/)).toBeInTheDocument()
  })

  it('calls onEdit when Edit button clicked', async () => {
    const onEdit = vi.fn()
    const user = userEvent.setup()
    render(<PlayDetailPopover play={play} onEdit={onEdit} onUndo={vi.fn()} onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /edit/i }))
    expect(onEdit).toHaveBeenCalledWith(play.id)
  })

  it('shows confirmation before undo', async () => {
    const onUndo = vi.fn()
    const user = userEvent.setup()
    render(<PlayDetailPopover play={play} onEdit={vi.fn()} onUndo={onUndo} onClose={vi.fn()} playsAfterCount={3} />)
    await user.click(screen.getByRole('button', { name: /undo/i }))
    expect(screen.getByText(/will also remove 3 subsequent plays/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /confirm/i }))
    expect(onUndo).toHaveBeenCalledWith(play.id)
  })
})
```

**Step 2: Run tests to verify they fail**

**Step 3: Implement PlayDetailPopover**

Create `src/components/PlayDetailPopover.tsx`:

```tsx
import { useState } from 'react'
import type { PitchResult } from '../engine/types'

interface PlayDetailPopoverProps {
  play: {
    id?: number
    playType: string
    notation: string
    basesReached: number[]
    pitches: PitchResult[]
    runsScoredOnPlay: number
  }
  playsAfterCount?: number
  onEdit: (playId: number) => void
  onUndo: (playId: number) => void
  onClose: () => void
}

export function PlayDetailPopover({ play, playsAfterCount = 0, onEdit, onUndo, onClose }: PlayDetailPopoverProps) {
  const [confirmUndo, setConfirmUndo] = useState(false)

  let b = 0, s = 0
  for (const p of play.pitches) {
    if (p === 'B') b++
    else if (p === 'S') s = Math.min(s + 1, 2)
    else if (p === 'F') s = Math.min(s + 1, 2)
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-5 max-w-xs w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="text-2xl font-bold text-slate-900 mb-1">{play.notation}</div>
        <div className="text-sm text-slate-500 mb-4">
          Count: {b}-{s} ({play.pitches.length} pitches)
        </div>

        {!confirmUndo ? (
          <div className="flex gap-2">
            <button
              onClick={() => play.id && onEdit(play.id)}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-bold text-sm"
            >
              Edit
            </button>
            <button
              onClick={() => playsAfterCount > 0 ? setConfirmUndo(true) : (play.id && onUndo(play.id))}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg font-bold text-sm"
            >
              Undo
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-red-600 font-semibold mb-3">
              This will also remove {playsAfterCount} subsequent plays.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmUndo(false)}
                className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg font-bold text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => play.id && onUndo(play.id)}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg font-bold text-sm"
              >
                Confirm
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

**Step 4: Integrate into Scoresheet and GamePage**

Update `Scoresheet` `onCellClick` to pass more context:

```typescript
onCellClick: (batterPosition: number, inning: number, play?: Play) => void
```

In cell rendering, pass the play:
```tsx
onClick={() => onCellClick(slot.orderPosition, col.inning, play)}
```

In GamePage, handle the three cell states:

```typescript
const handleCellClick = (batterPosition: number, inning: number, play?: Play) => {
  if (play) {
    // Past play: show popover
    setSelectedPlay(play)
  } else if (batterPosition === currentBatter && inning === snapshot.inning) {
    // Current batter: open record play
    setShowPlayEntry(true)
  }
  // Empty future cell: do nothing
}
```

Add state for selected play and render popover.

**Step 5: Run tests**

Run: `npm run test -- --run`
Expected: PASS

**Step 6: Commit**

```
feat(scoresheet): add play detail popover on cell tap with edit/undo actions
```

---

### Task 15: Position Change Dialog

**Files:**
- Create: `src/components/PositionChangeDialog.tsx`
- Modify: `src/pages/GamePage.tsx` (add "Pos Change" button, dialog state, lineup update logic)
- Modify: `src/contexts/GameContext.tsx` (add `updateLineupPositions` method)
- Test: `src/components/__tests__/PositionChangeDialog.test.tsx`
- Test: `src/pages/__tests__/GamePage.test.tsx`

**Step 1: Write the failing tests**

For PositionChangeDialog:

```typescript
describe('PositionChangeDialog', () => {
  const lineup = [
    { orderPosition: 1, playerId: 1, playerName: 'Smith', jerseyNumber: 12, position: 'P', substitutions: [] },
    { orderPosition: 2, playerId: 2, playerName: 'Jones', jerseyNumber: 7, position: 'SS', substitutions: [] },
  ]

  it('shows player list and field diagram for new position', async () => {
    const user = userEvent.setup()
    render(<PositionChangeDialog lineup={lineup} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    // Select Smith
    await user.click(screen.getByText('Smith'))
    // Should show field diagram
    expect(screen.getByRole('button', { name: /6.*SS/i })).toBeInTheDocument()
  })

  it('shows swap confirmation when position is occupied', async () => {
    const user = userEvent.setup()
    render(<PositionChangeDialog lineup={lineup} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    await user.click(screen.getByText('Smith'))
    // Select SS position (occupied by Jones)
    await user.click(screen.getByRole('button', { name: /6.*SS/i }))
    // Should show swap confirmation
    expect(screen.getByText(/Smith.*P → SS/i)).toBeInTheDocument()
    expect(screen.getByText(/Jones.*SS → P/i)).toBeInTheDocument()
  })

  it('calls onConfirm with both position changes', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<PositionChangeDialog lineup={lineup} onConfirm={onConfirm} onCancel={vi.fn()} />)
    await user.click(screen.getByText('Smith'))
    await user.click(screen.getByRole('button', { name: /6.*SS/i }))
    await user.click(screen.getByRole('button', { name: /confirm/i }))
    expect(onConfirm).toHaveBeenCalledWith([
      { orderPosition: 1, newPosition: 'SS' },
      { orderPosition: 2, newPosition: 'P' },
    ])
  })
})
```

**Step 2: Run tests to verify they fail**

**Step 3: Implement**

Create `src/components/PositionChangeDialog.tsx`:

```tsx
import { useState } from 'react'
import type { LineupSlot } from '../engine/types'
import { FieldDiagram } from './FieldDiagram'

interface PositionChange {
  orderPosition: number
  newPosition: string
}

interface PositionChangeDialogProps {
  lineup: LineupSlot[]
  onConfirm: (changes: PositionChange[]) => void
  onCancel: () => void
}

const POSITION_MAP: Record<number, string> = {
  1: 'P', 2: 'C', 3: '1B', 4: '2B', 5: '3B', 6: 'SS', 7: 'LF', 8: 'CF', 9: 'RF',
}

export function PositionChangeDialog({ lineup, onConfirm, onCancel }: PositionChangeDialogProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<LineupSlot | null>(null)
  const [swapTarget, setSwapTarget] = useState<{ player: LineupSlot; newPos: string; targetPlayer: LineupSlot; targetNewPos: string } | null>(null)

  const handlePositionClick = (posNum: number) => {
    if (!selectedPlayer) return
    const newPos = POSITION_MAP[posNum]
    const occupant = lineup.find(s => s.position === newPos)

    if (occupant && occupant.orderPosition !== selectedPlayer.orderPosition) {
      // Swap needed
      setSwapTarget({
        player: selectedPlayer,
        newPos,
        targetPlayer: occupant,
        targetNewPos: selectedPlayer.position,
      })
    } else {
      // No swap needed — just change position
      onConfirm([{ orderPosition: selectedPlayer.orderPosition, newPosition: newPos }])
    }
  }

  const handleConfirmSwap = () => {
    if (!swapTarget) return
    onConfirm([
      { orderPosition: swapTarget.player.orderPosition, newPosition: swapTarget.newPos },
      { orderPosition: swapTarget.targetPlayer.orderPosition, newPosition: swapTarget.targetNewPos },
    ])
  }

  // Render: player list → field diagram → swap confirmation
  // ... (full JSX implementation)
}
```

In GameContext, add `updateLineupPositions`:

```typescript
const updateLineupPositions = useCallback(async (
  side: 'us' | 'them',
  changes: { orderPosition: number; newPosition: string }[],
  inning: number,
  half: HalfInning,
) => {
  const lineup = side === 'us' ? lineupUs : lineupThem
  if (!lineup || !game?.id) return

  const updatedOrder = lineup.battingOrder.map(slot => {
    const change = changes.find(c => c.orderPosition === slot.orderPosition)
    if (change) {
      return {
        ...slot,
        position: change.newPosition,
        substitutions: [...slot.substitutions, {
          inning,
          half,
          newPlayerName: slot.playerName,
          newJerseyNumber: slot.jerseyNumber,
          newPosition: change.newPosition,
        }],
      }
    }
    return slot
  })

  await saveLineup(game.id, side, updatedOrder)
  // Reload to pick up changes
  const lineups = await getLineupsForGame(game.id)
  const lus = lineups.find(l => l.side === 'us') ?? null
  const lth = lineups.find(l => l.side === 'them') ?? null
  setLineupUs(lus)
  setLineupThem(lth)
  recompute(plays, lus, lth, game.homeOrAway)
}, [game, lineupUs, lineupThem, plays, recompute])
```

In GamePage, add "Pos Change" button in the action bar and dialog state.

**Step 4: Run tests**

Run: `npm run test -- --run`
Expected: PASS

**Step 5: Commit**

```
feat(game): add position change dialog with auto-swap for defensive changes
```

---

## Execution Notes

**Test command:** `npm run test -- --run` (all tests) or `npm run test -- --run <file>` (single file)

**Build check:** `npm run build` after each task to verify no type errors

**Lint check:** `npm run lint` before committing

**Key patterns to remember:**
- Always `import { vi } from 'vitest'` explicitly
- Always pass `homeOrAway` as 4th arg to `replayGame()`
- Use `import type { ... }` for type-only imports
- No enums — string union types only
- Batting order position renders as "1." (with period) in Scoresheet
- FieldDiagram buttons: `aria-label="{num} {label}"` (e.g., "6 SS")

**Task dependencies:**
- Tasks 1-5 are independent of each other
- Task 6 (lift pitch state) must complete before Tasks 7-8
- Task 11 (runner journeys) must complete before Task 12
- Task 12 should complete before Task 13
- Tasks 9, 10, 14, 15 are independent of most other tasks
