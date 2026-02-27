# Feedback Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 8 UX issues and bugs reported after real-world app usage.

**Architecture:** All changes are UI-layer or thin engine-adjacent. No schema/DB changes. Tasks are independent unless noted. TDD throughout — write failing tests first.

**Tech Stack:** React 19, TypeScript (strict, erasableSyntaxOnly, verbatimModuleSyntax), Tailwind v4, Vitest + @testing-library/react

---

## Task 1: Backwards K for Strikeout Looking

**Files:**
- Modify: `src/components/Diamond.tsx`
- Test: `src/components/__tests__/Diamond.test.tsx`

**Step 1: Write the failing test**

Add to `src/components/__tests__/Diamond.test.tsx`:

```tsx
it('should render a mirrored K for KL notation', () => {
  const { container } = render(<Diamond basesReached={[]} notation="KL" />)
  // Should NOT contain the literal text "KL"
  expect(container.textContent).not.toContain('KL')
  // Should contain a K inside a mirrored span
  const mirror = container.querySelector('[data-testid="backwards-k"]')
  expect(mirror).toBeInTheDocument()
})
```

**Step 2: Run to verify it fails**

```bash
npm run test -- Diamond --reporter=verbose
```
Expected: FAIL — `backwards-k` element not found.

**Step 3: Implement**

In `src/components/Diamond.tsx`, replace the `{notation}` SVG text block (lines 97–107) with:

```tsx
{notation && (
  notation === 'KL' ? (
    <foreignObject x="30" y="40" width="40" height="20">
      <span
        xmlns="http://www.w3.org/1999/xhtml"
        data-testid="backwards-k"
        style={{ display: 'inline-block', transform: 'scaleX(-1)', fontSize: 11, fontWeight: 'bold', color: '#1e293b' }}
      >
        K
      </span>
    </foreignObject>
  ) : (
    <text
      x="50"
      y="54"
      textAnchor="middle"
      className="text-[10px] font-bold"
      fill="#1e293b"
    >
      {notation}
    </text>
  )
)}
```

**Step 4: Run tests**

```bash
npm run test -- Diamond --reporter=verbose
```
Expected: All Diamond tests pass.

**Step 5: Commit**

```bash
git add src/components/Diamond.tsx src/components/__tests__/Diamond.test.tsx
git commit -m "feat: render strikeout looking (KL) as mirrored K in Diamond"
```

---

## Task 2: Pitch Count "PC:" Label in ScoreSummary

**Files:**
- Modify: `src/components/ScoreSummary.tsx`
- Test: `src/components/__tests__/ScoreSummary.test.tsx`

**Step 1: Check the current ScoreSummary test**

Read `src/components/__tests__/ScoreSummary.test.tsx` and find any test that checks for pitch count rendering.

**Step 2: Write a failing test**

Add to `src/components/__tests__/ScoreSummary.test.tsx`:

```tsx
it('should display pitch count with PC: label', () => {
  render(
    <ScoreSummary
      inning={2} half="top" outs={1}
      scoreUs={3} scoreThem={1}
      pitchCount={47} pitcherName="Smith"
    />
  )
  expect(screen.getByText('PC: 47')).toBeInTheDocument()
})
```

**Step 3: Run to verify it fails**

```bash
npm run test -- ScoreSummary --reporter=verbose
```
Expected: FAIL — "PC: 47" not found.

**Step 4: Implement**

In `src/components/ScoreSummary.tsx`, find the pitcher/pitch count block (lines 59–63):

```tsx
{/* Pitcher + pitch count */}
<div className="text-right">
  <div className="text-xs text-slate-400">{pitcherName}</div>
  <div className="text-lg font-mono font-bold">{pitchCount}</div>
</div>
```

Replace with:

```tsx
{/* Pitcher + pitch count */}
<div className="text-right">
  <div className="text-xs text-slate-400">{pitcherName}</div>
  <div className="text-lg font-mono font-bold">PC: {pitchCount}</div>
</div>
```

**Step 5: Run tests**

```bash
npm run test -- ScoreSummary --reporter=verbose
```
Expected: All ScoreSummary tests pass.

**Step 6: Commit**

```bash
git add src/components/ScoreSummary.tsx src/components/__tests__/ScoreSummary.test.tsx
git commit -m "feat: label pitch count as 'PC: N' in status bar"
```

---

## Task 3: Button Transitions Sweep

No new tests — purely visual CSS changes. Add `transition-all duration-150 ease-in-out active:scale-95` to buttons throughout.

**Files:**
- Modify: `src/components/PlayEntryPanel.tsx`
- Modify: `src/components/RunnerConfirmation.tsx`
- Modify: `src/pages/GamePage.tsx`

**Step 1: PlayEntryPanel buttons**

In `src/components/PlayEntryPanel.tsx`, add transition classes to every `<button>`. Pattern to apply:

- OUTCOME buttons: add `transition-all duration-150 active:scale-95` to the `className`
- FIELDING buttons: same
- SPECIAL buttons: same
- Cancel/Confirm in fielding mode: same
- Close (×) button: add `transition-colors duration-150`

Also add `transition-transform duration-200` to the panel container div (the outermost `<div className="fixed inset-x-0 bottom-0 ...">`) to enable slide-up animation. Note: the slide animation itself requires the panel to be rendered with a transform and transitioned — since the panel currently conditionally renders, add `animate-in` via the `translate-y` trick:

Replace panel container opening tag:
```tsx
<div className="fixed inset-x-0 bottom-0 bg-white border-t-2 border-slate-300 shadow-2xl max-h-[80vh] overflow-y-auto z-50 transition-transform duration-200">
```

**Step 2: RunnerConfirmation buttons**

In `src/components/RunnerConfirmation.tsx`, add to Cancel button:
```
transition-all duration-150 active:scale-95
```
Add to Confirm button:
```
transition-all duration-150 active:scale-95
```
Add to each `clear` button:
```
transition-colors duration-150
```

**Step 3: GamePage bottom bar buttons**

In `src/pages/GamePage.tsx`, add to "Record Play" button:
```
transition-all duration-150 active:scale-95
```
Add to "Undo" button:
```
transition-all duration-150 active:scale-95
```
Add to each tab button:
```
transition-all duration-150
```

**Step 4: Run all tests to confirm nothing broken**

```bash
npm run test
```
Expected: All tests pass (no behavioral change).

**Step 5: Commit**

```bash
git add src/components/PlayEntryPanel.tsx src/components/RunnerConfirmation.tsx src/pages/GamePage.tsx
git commit -m "feat: add smooth button transition animations throughout"
```

---

## Task 4: Field Diagram Redesign — Proper Fan Shape

**Files:**
- Modify: `src/components/FieldDiagram.tsx`
- Test: `src/components/__tests__/FieldDiagram.test.tsx` (existing tests must still pass)

**Step 1: Verify existing tests pass before changing**

```bash
npm run test -- FieldDiagram --reporter=verbose
```
Expected: 3 passing tests.

**Step 2: Update position coordinates**

The new layout uses a 100×100 SVG viewBox with a proper 90° wedge:
- Home plate: bottom center (50, 95)
- Foul lines from home plate extend at 45° angles
- Infield diamond: lower portion of the wedge
- Outfield: upper arc area

Replace the `POSITIONS` array in `src/components/FieldDiagram.tsx`:

```tsx
const POSITIONS = [
  { num: 1, label: 'P',  x: 50, y: 58 },  // pitcher — center of infield
  { num: 2, label: 'C',  x: 50, y: 88 },  // catcher — below home plate
  { num: 3, label: '1B', x: 74, y: 68 },  // first base — right of diamond
  { num: 4, label: '2B', x: 60, y: 44 },  // second base — upper right infield
  { num: 5, label: '3B', x: 26, y: 68 },  // third base — left of diamond
  { num: 6, label: 'SS', x: 40, y: 50 },  // shortstop — upper left infield
  { num: 7, label: 'LF', x: 18, y: 28 },  // left field
  { num: 8, label: 'CF', x: 50, y: 12 },  // center field — top
  { num: 9, label: 'RF', x: 82, y: 28 },  // right field
]
```

**Step 3: Redesign the SVG background**

Replace the SVG background in `src/components/FieldDiagram.tsx`. Keep the container `<div>` dimensions and `POSITIONS.map(...)` logic unchanged. Only replace the `<svg>` element's interior paths.

```tsx
export function FieldDiagram({ selectedPositions, onPositionClick }: FieldDiagramProps) {
  return (
    <div className="relative w-72 h-72 mx-auto">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
        {/* Foul lines from home plate (50,95) extending to upper-left and upper-right */}
        <line x1="50" y1="95" x2="5" y2="5" stroke="#4ade80" strokeWidth="0.5" opacity="0.6" />
        <line x1="50" y1="95" x2="95" y2="5" stroke="#4ade80" strokeWidth="0.5" opacity="0.6" />

        {/* Outfield arc */}
        <path
          d="M 8 8 Q 50 2 92 8"
          fill="none"
          stroke="#16a34a"
          strokeWidth="1"
        />

        {/* Fair territory fill (90° wedge) */}
        <path
          d="M 50 95 L 5 5 Q 50 2 95 5 Z"
          fill="#86efac"
          fillOpacity="0.2"
          stroke="none"
        />

        {/* Outfield grass arc fill */}
        <path
          d="M 22 62 Q 50 18 78 62 Q 50 42 22 62 Z"
          fill="#bbf7d0"
          fillOpacity="0.3"
        />

        {/* Infield dirt circle */}
        <circle cx="50" cy="68" r="20" fill="#fde68a" fillOpacity="0.25" stroke="#ca8a04" strokeWidth="0.5" />

        {/* Infield diamond */}
        <polygon
          points="50,85 74,68 50,51 26,68"
          fill="#fef9c3"
          fillOpacity="0.4"
          stroke="#ca8a04"
          strokeWidth="0.8"
        />

        {/* Home plate */}
        <polygon points="50,95 53,92 53,89 47,89 47,92" fill="#fff" stroke="#94a3b8" strokeWidth="0.5" />
      </svg>

      {/* Position buttons */}
      {POSITIONS.map(pos => {
        const isSelected = selectedPositions.includes(pos.num)
        return (
          <button
            key={pos.num}
            data-selected={isSelected}
            onClick={() => onPositionClick(pos.num)}
            aria-label={`${pos.num} ${pos.label}`}
            className={`
              absolute w-10 h-10 rounded-full flex flex-col items-center justify-center
              text-xs font-bold transition-all duration-150 active:scale-95 transform -translate-x-1/2 -translate-y-1/2
              ${isSelected
                ? 'bg-amber-400 text-amber-900 ring-2 ring-amber-600 scale-110'
                : 'bg-slate-700 text-white hover:bg-slate-600'
              }
            `}
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          >
            <span className="text-[9px] leading-none">{pos.label}</span>
            <span className="text-xs leading-none">{pos.num}</span>
          </button>
        )
      })}
    </div>
  )
}
```

**Step 4: Run existing FieldDiagram tests**

```bash
npm run test -- FieldDiagram --reporter=verbose
```
Expected: All 3 tests still pass (tests are behavioral, not SVG-structure-specific).

**Step 5: Commit**

```bash
git add src/components/FieldDiagram.tsx
git commit -m "feat: redesign field diagram as proper 90-degree fan shape"
```

---

## Task 5: Runner Confirmation — Full Placement Grid + Show on Outs

This task has two sub-parts:
- A) Redesign `RunnerConfirmation` to allow moving runners (1st/2nd/3rd/Scored/Out)
- B) Update `GamePage` to trigger the confirmation on outs with runners

The `onConfirm` signature changes from `(runners: BaseRunners) => void` to `(result: { runners: BaseRunners; runsScored: number }) => void`. This is a **breaking change** that requires updating `GamePage` in the same commit.

**Files:**
- Modify: `src/components/RunnerConfirmation.tsx`
- Modify: `src/pages/GamePage.tsx`
- Test: `src/components/__tests__/RunnerConfirmation.test.tsx` (rewrite existing tests)
- Test: `src/pages/__tests__/GamePage.test.tsx` (add new test for outs triggering confirmation)

**Step 1: Rewrite RunnerConfirmation tests**

Replace all tests in `src/components/__tests__/RunnerConfirmation.test.tsx` with:

```tsx
import { describe, it, expect } from 'vitest'
import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RunnerConfirmation } from '../RunnerConfirmation'
import type { BaseRunners } from '../../engine/types'

describe('RunnerConfirmation', () => {
  const runners: BaseRunners = {
    first: { playerName: 'Alice', orderPosition: 1 },
    second: null,
    third: { playerName: 'Bob', orderPosition: 2 },
  }

  it('should display current base runners with their names', () => {
    render(<RunnerConfirmation runners={runners} onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.getByText(/alice/i)).toBeInTheDocument()
    expect(screen.getByText(/bob/i)).toBeInTheDocument()
  })

  it('should show confirm and cancel buttons', () => {
    render(<RunnerConfirmation runners={runners} onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('should call onConfirm with unchanged runners and 0 runs when confirmed without changes', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<RunnerConfirmation runners={runners} onConfirm={onConfirm} onCancel={() => {}} />)
    await user.click(screen.getByRole('button', { name: /confirm/i }))
    expect(onConfirm).toHaveBeenCalledWith({
      runners: { first: { playerName: 'Alice', orderPosition: 1 }, second: null, third: { playerName: 'Bob', orderPosition: 2 } },
      runsScored: 0,
    })
  })

  it('should allow moving a runner and count a score when set to Scored', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const singleRunner: BaseRunners = {
      first: null,
      second: null,
      third: { playerName: 'Bob', orderPosition: 2 },
    }
    render(<RunnerConfirmation runners={singleRunner} onConfirm={onConfirm} onCancel={() => {}} />)

    // Click the "Scored" destination for the runner on 3rd
    await user.click(screen.getByRole('button', { name: /scored/i }))
    await user.click(screen.getByRole('button', { name: /confirm/i }))

    expect(onConfirm).toHaveBeenCalledWith({
      runners: { first: null, second: null, third: null },
      runsScored: 1,
    })
  })

  it('should allow moving a runner to a different base', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const singleRunner: BaseRunners = {
      first: { playerName: 'Alice', orderPosition: 1 },
      second: null,
      third: null,
    }
    render(<RunnerConfirmation runners={singleRunner} onConfirm={onConfirm} onCancel={() => {}} />)

    // Move runner from 1st to 3rd
    await user.click(screen.getByRole('button', { name: /^3rd$/i }))
    await user.click(screen.getByRole('button', { name: /confirm/i }))

    expect(onConfirm).toHaveBeenCalledWith({
      runners: { first: null, second: null, third: { playerName: 'Alice', orderPosition: 1 } },
      runsScored: 0,
    })
  })

  it('should remove a runner marked as Out', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const singleRunner: BaseRunners = {
      first: { playerName: 'Alice', orderPosition: 1 },
      second: null,
      third: null,
    }
    render(<RunnerConfirmation runners={singleRunner} onConfirm={onConfirm} onCancel={() => {}} />)

    await user.click(screen.getByRole('button', { name: /^out$/i }))
    await user.click(screen.getByRole('button', { name: /confirm/i }))

    expect(onConfirm).toHaveBeenCalledWith({
      runners: { first: null, second: null, third: null },
      runsScored: 0,
    })
  })
})
```

**Step 2: Run to verify new tests fail**

```bash
npm run test -- RunnerConfirmation --reporter=verbose
```
Expected: Failures on the new tests (old API).

**Step 3: Rewrite RunnerConfirmation component**

Replace the entire content of `src/components/RunnerConfirmation.tsx`:

```tsx
import { useState } from 'react'
import type { BaseRunners, BaseRunner } from '../engine/types'

type OrigBase = 'first' | 'second' | 'third'
type RunnerDest = 'first' | 'second' | 'third' | 'scored' | 'out'

interface RunnerConfirmationProps {
  runners: BaseRunners
  onConfirm: (result: { runners: BaseRunners; runsScored: number }) => void
  onCancel: () => void
}

const DEST_LABELS: { dest: RunnerDest; label: string }[] = [
  { dest: 'first', label: '1st' },
  { dest: 'second', label: '2nd' },
  { dest: 'third', label: '3rd' },
  { dest: 'scored', label: 'Scored' },
  { dest: 'out', label: 'Out' },
]

const BASE_LABELS: Record<OrigBase, string> = {
  first: '1st',
  second: '2nd',
  third: '3rd',
}

function initAssignments(runners: BaseRunners): Map<OrigBase, RunnerDest> {
  const m = new Map<OrigBase, RunnerDest>()
  if (runners.first) m.set('first', 'first')
  if (runners.second) m.set('second', 'second')
  if (runners.third) m.set('third', 'third')
  return m
}

function computeResult(
  runners: BaseRunners,
  assignments: Map<OrigBase, RunnerDest>,
): { runners: BaseRunners; runsScored: number } {
  const result: BaseRunners = { first: null, second: null, third: null }
  let runsScored = 0

  const ORIG_BASES: OrigBase[] = ['third', 'second', 'first']
  for (const orig of ORIG_BASES) {
    const runner: BaseRunner | null = runners[orig]
    if (!runner) continue
    const dest = assignments.get(orig)
    if (!dest || dest === 'out') continue
    if (dest === 'scored') {
      runsScored++
    } else {
      result[dest] = runner
    }
  }

  return { runners: result, runsScored }
}

export function RunnerConfirmation({ runners, onConfirm, onCancel }: RunnerConfirmationProps) {
  const [assignments, setAssignments] = useState<Map<OrigBase, RunnerDest>>(() => initAssignments(runners))

  const setDest = (orig: OrigBase, dest: RunnerDest) => {
    setAssignments(prev => new Map(prev).set(orig, dest))
  }

  const handleConfirm = () => {
    onConfirm(computeResult(runners, assignments))
  }

  const occupiedBases: OrigBase[] = (['third', 'second', 'first'] as OrigBase[]).filter(b => runners[b] !== null)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Confirm Runners</h3>

        <div className="space-y-4 mb-6">
          {occupiedBases.map(orig => {
            const runner = runners[orig]!
            const currentDest = assignments.get(orig) ?? orig
            return (
              <div key={orig} className="bg-slate-50 rounded-lg p-3">
                <div className="text-xs font-semibold text-slate-500 mb-2">
                  {runner.playerName} <span className="text-slate-400">(was on {BASE_LABELS[orig]})</span>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {DEST_LABELS.map(({ dest, label }) => (
                    <button
                      key={dest}
                      onClick={() => setDest(orig, dest)}
                      className={`px-2.5 py-1.5 rounded text-xs font-bold transition-all duration-150 active:scale-95 ${
                        currentDest === dest
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
                  ))}
                </div>
              </div>
            )
          })}

          {occupiedBases.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-2">No runners on base</p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 py-2.5 rounded-lg font-semibold transition-all duration-150 active:scale-95"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg font-semibold transition-all duration-150 active:scale-95"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Step 4: Update GamePage for new onConfirm API**

In `src/pages/GamePage.tsx`, make three changes:

**Change A** — Update `handleRunnerConfirm` to accept the new result shape:
```tsx
const handleRunnerConfirm = (result: { runners: BaseRunners; runsScored: number }) => {
  if (pendingPlay) {
    finalizePlay(pendingPlay, result.runners, result.runsScored)
  }
}
```

**Change B** — Update `finalizePlay` signature and run computation:
```tsx
const finalizePlay = (data: PendingPlay, runnerOverrides?: BaseRunners, runsScoredOverride?: number) => {
  const half: HalfInning = snapshot.half
  const batterPos = half === usBattingHalf
    ? snapshot.currentBatterUs
    : snapshot.currentBatterThem

  let runsScored: number

  if (runnerOverrides !== undefined && runsScoredOverride !== undefined) {
    // Use explicit count from RunnerConfirmation (handles scored-via-override correctly)
    runsScored = runsScoredOverride
  } else {
    // Compute from engine replay (default path when no overrides)
    const tempPlays = [...plays, {
      id: undefined,
      gameId: gId,
      sequenceNumber: plays.length + 1,
      inning: snapshot.inning,
      half,
      batterOrderPosition: batterPos,
      ...data,
      runsScoredOnPlay: 0,
      rbis: 0,
      timestamp: new Date(),
    }]
    const tempSnapshot = replayGame(tempPlays, lineupUs, lineupThem, game.homeOrAway)
    runsScored = half === usBattingHalf
      ? tempSnapshot.scoreUs - snapshot.scoreUs
      : tempSnapshot.scoreThem - snapshot.scoreThem
  }

  recordPlay({
    inning: snapshot.inning,
    half,
    batterOrderPosition: batterPos,
    playType: data.playType,
    notation: data.notation,
    fieldersInvolved: data.fieldersInvolved,
    basesReached: data.basesReached,
    runsScoredOnPlay: runsScored,
    rbis: data.isAtBat && data.basesReached.length > 0 ? runsScored : 0,
    pitches: data.pitches,
    isAtBat: data.isAtBat,
    runnerOverrides: runnerOverrides
      ? { first: runnerOverrides.first, second: runnerOverrides.second, third: runnerOverrides.third }
      : undefined,
  })

  setShowPlayEntry(false)
  setPendingPlay(null)
  setPendingRunners(null)
}
```

**Change C** — Update `handlePlayRecorded` to show confirmation for outs with runners:

Replace the `affectsRunners` condition block (lines 89–99) with:

```tsx
const hasRunnersOnBase = !!(snapshot.baseRunners.first || snapshot.baseRunners.second || snapshot.baseRunners.third)
const affectsRunners = data.basesReached.length > 0 ||
  ['SB', 'WP', 'PB', 'BK', 'FC', 'E'].includes(data.playType)
const isOut = ['K', 'KL', 'GO', 'FO', 'LO', 'PO', 'SAC', 'DP'].includes(data.playType)

if (hasRunnersOnBase && (affectsRunners || isOut)) {
  setPendingPlay(data)
  setPendingRunners(tempSnapshot.baseRunners)
  setShowPlayEntry(false)
} else {
  finalizePlay(data)
}
```

**Step 5: Run tests**

```bash
npm run test -- RunnerConfirmation GamePage --reporter=verbose
```
Expected: All RunnerConfirmation tests pass. Existing GamePage tests pass.

**Step 6: Commit**

```bash
git add src/components/RunnerConfirmation.tsx src/components/__tests__/RunnerConfirmation.test.tsx src/pages/GamePage.tsx
git commit -m "feat: redesign RunnerConfirmation with full runner placement grid; show on outs with runners"
```

---

## Task 6: Stolen Base — Runner Selection Sub-Step

**Files:**
- Modify: `src/components/PlayEntryPanel.tsx`
- Modify: `src/pages/GamePage.tsx`
- Test: `src/components/__tests__/PlayEntryPanel.test.tsx`

**Step 1: Write failing tests**

Add to `src/components/__tests__/PlayEntryPanel.test.tsx`:

```tsx
import type { BaseRunners } from '../../engine/types'

const runnersOnFirst: BaseRunners = {
  first: { playerName: 'Alice', orderPosition: 1 },
  second: null,
  third: null,
}

const runnersOnFirstAndSecond: BaseRunners = {
  first: { playerName: 'Alice', orderPosition: 1 },
  second: { playerName: 'Bob', orderPosition: 2 },
  third: null,
}

it('should record SB immediately when only one runner on base', async () => {
  const user = userEvent.setup()
  const onPlayRecorded = vi.fn()
  render(
    <PlayEntryPanel
      batterName="John"
      baseRunners={runnersOnFirst}
      onPlayRecorded={onPlayRecorded}
      onClose={() => {}}
    />
  )
  await user.click(screen.getByRole('button', { name: /^SB$/i }))
  expect(onPlayRecorded).toHaveBeenCalledOnce()
  expect(onPlayRecorded.mock.calls[0][0].playType).toBe('SB')
})

it('should show runner selection when multiple runners on base and SB tapped', async () => {
  const user = userEvent.setup()
  render(
    <PlayEntryPanel
      batterName="John"
      baseRunners={runnersOnFirstAndSecond}
      onPlayRecorded={() => {}}
      onClose={() => {}}
    />
  )
  await user.click(screen.getByRole('button', { name: /^SB$/i }))
  expect(screen.getByText(/who is stealing/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /alice.*1st/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /bob.*2nd/i })).toBeInTheDocument()
})

it('should record SB with runnerOverrides for selected runner', async () => {
  const user = userEvent.setup()
  const onPlayRecorded = vi.fn()
  render(
    <PlayEntryPanel
      batterName="John"
      baseRunners={runnersOnFirstAndSecond}
      onPlayRecorded={onPlayRecorded}
      onClose={() => {}}
    />
  )
  await user.click(screen.getByRole('button', { name: /^SB$/i }))
  await user.click(screen.getByRole('button', { name: /alice.*1st/i }))

  expect(onPlayRecorded).toHaveBeenCalledOnce()
  const call = onPlayRecorded.mock.calls[0][0]
  expect(call.playType).toBe('SB')
  // Alice moved from 1st to 2nd; Bob stays on 2nd (Bob on 2nd should be in override as 2nd)
  expect(call.runnerOverrides).toBeDefined()
  expect(call.runnerOverrides.second).toMatchObject({ playerName: 'Alice' })
})
```

**Step 2: Run to verify failures**

```bash
npm run test -- PlayEntryPanel --reporter=verbose
```
Expected: New tests fail — `baseRunners` prop not accepted, SB sub-step not implemented.

**Step 3: Update PlayEntryPanel types and mode**

In `src/components/PlayEntryPanel.tsx`:

Add to `PlayRecordedData`:
```tsx
interface PlayRecordedData {
  playType: PlayType
  notation: string
  fieldersInvolved: number[]
  basesReached: number[]
  pitches: PitchResult[]
  isAtBat: boolean
  runnerOverrides?: { first: BaseRunner | null; second: BaseRunner | null; third: BaseRunner | null }
}
```

Add `BaseRunner` and `BaseRunners` to the import:
```tsx
import type { PitchResult, PlayType, BaseRunner, BaseRunners } from '../engine/types'
```

Update `PlayEntryPanelProps`:
```tsx
interface PlayEntryPanelProps {
  batterName: string
  baseRunners?: BaseRunners
  onPlayRecorded: (data: PlayRecordedData) => void
  onClose: () => void
}
```

Update `PanelMode`:
```tsx
type PanelMode = 'select' | 'fielding' | 'sb-runner-select'
```

Update function signature:
```tsx
export function PlayEntryPanel({ batterName, baseRunners, onPlayRecorded, onClose }: PlayEntryPanelProps) {
```

**Step 4: Add SB handler logic**

Replace the existing SB button's `onClick` in `SPECIAL_PLAYS.map(...)`. Since `SPECIAL_PLAYS` is a static array, we intercept SB at click time. Add a dedicated handler before `return`:

```tsx
const handleSbClick = () => {
  const runners = baseRunners ?? { first: null, second: null, third: null }
  const occupied = [
    runners.third ? 'third' as const : null,
    runners.second ? 'second' as const : null,
    runners.first ? 'first' as const : null,
  ].filter((b): b is 'first' | 'second' | 'third' => b !== null)

  if (occupied.length <= 1) {
    // Only one (or zero) runner — use default engine logic
    recordSimplePlay('SB', [], false)
  } else {
    setMode('sb-runner-select')
  }
}
```

Add a helper to compute runner overrides when a specific runner steals:

```tsx
const computeSbOverride = (stealing: 'first' | 'second' | 'third') => {
  const runners = baseRunners ?? { first: null, second: null, third: null }
  const result = { first: runners.first, second: runners.second, third: runners.third }
  const runner = runners[stealing]
  if (!runner) return result

  // Advance the stealing runner one base; clear their original base
  result[stealing] = null
  if (stealing === 'first') result.second = runner
  else if (stealing === 'second') result.third = runner
  else if (stealing === 'third') {
    // stealing home — runner scores; just clear 3rd (run handled by RunnerConfirmation)
    result.third = null
  }
  return result
}

const handleSbRunnerSelect = (stealing: 'first' | 'second' | 'third') => {
  const override = computeSbOverride(stealing)
  onPlayRecorded({
    playType: 'SB',
    notation: 'SB',
    fieldersInvolved: [],
    basesReached: [],
    pitches,
    isAtBat: false,
    runnerOverrides: override,
  })
}
```

In `SPECIAL_PLAYS.map(...)`, replace the SB button's onClick:
```tsx
onClick={() => play.playType === 'SB' ? handleSbClick() : recordSimplePlay(play.playType, play.basesReached, play.isAtBat)}
```

Add `sb-runner-select` mode UI after the existing `mode === 'fielding'` block:

```tsx
{mode === 'sb-runner-select' && baseRunners && (
  <div>
    <div className="text-sm font-semibold text-slate-700 mb-3 text-center">Who is stealing?</div>
    <div className="space-y-2">
      {(['third', 'second', 'first'] as const).map(base => {
        const runner = baseRunners[base]
        if (!runner) return null
        const baseLabel = base === 'first' ? '1st' : base === 'second' ? '2nd' : '3rd'
        return (
          <button
            key={base}
            onClick={() => handleSbRunnerSelect(base)}
            aria-label={`${runner.playerName} on ${baseLabel}`}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2.5 rounded-lg font-bold text-sm transition-all duration-150 active:scale-95"
          >
            {runner.playerName} ({baseLabel})
          </button>
        )
      })}
    </div>
    <button
      onClick={() => setMode('select')}
      className="w-full mt-2 bg-slate-200 hover:bg-slate-300 text-slate-700 py-2 rounded font-bold text-sm transition-all duration-150"
    >
      Cancel
    </button>
  </div>
)}
```

**Step 5: Pass baseRunners from GamePage**

In `src/pages/GamePage.tsx`, update the `PlayEntryPanel` usage:

```tsx
{showPlayEntry && (
  <PlayEntryPanel
    batterName={currentBatterSlot?.playerName ?? 'Unknown'}
    baseRunners={snapshot.baseRunners}
    onPlayRecorded={handlePlayRecorded}
    onClose={() => setShowPlayEntry(false)}
  />
)}
```

Also update `handlePlayRecorded` to include `data.runnerOverrides` in the temp play (so the engine uses the correct runner state when computing tempSnapshot for RunnerConfirmation):

In the `tempPlays` construction inside `handlePlayRecorded`, add `runnerOverrides`:
```tsx
const tempPlays = [...plays, {
  id: undefined,
  gameId: gId,
  sequenceNumber: plays.length + 1,
  inning: snapshot.inning,
  half: snapshot.half,
  batterOrderPosition: batterPos,
  ...data,
  runsScoredOnPlay: 0,
  rbis: 0,
  runnerOverrides: data.runnerOverrides,
  timestamp: new Date(),
}]
```

**Step 6: Run tests**

```bash
npm run test -- PlayEntryPanel GamePage --reporter=verbose
```
Expected: All tests pass.

**Step 7: Commit**

```bash
git add src/components/PlayEntryPanel.tsx src/components/__tests__/PlayEntryPanel.test.tsx src/pages/GamePage.tsx
git commit -m "feat: add stolen base runner selection when multiple runners on base"
```

---

## Task 7: Inning Transition — Auto-Switch Tab + Toast

**Files:**
- Modify: `src/pages/GamePage.tsx`
- Test: `src/pages/__tests__/GamePage.test.tsx`

**Step 1: Understand the GamePage test file**

Read `src/pages/__tests__/GamePage.test.tsx` to understand the existing mock setup before writing new tests.

**Step 2: Write a failing test**

Add to `src/pages/__tests__/GamePage.test.tsx`:

Find the test setup (mock lineup + plays) and add a test that verifies the tab auto-switches after a 3-out inning. Look for how the GameContext is mocked and follow that pattern:

```tsx
it('should auto-switch tab to batting team after 3rd out clears the inning', async () => {
  // This requires a snapshot where half just changed — mock a scenario
  // where the active tab is 'us' but snapshot.half is now the 'them' batting half
  // The specific mock will depend on how GameContext is set up in existing tests
  // Follow the exact same mock pattern as other GamePage tests
})
```

> **Note:** Read the existing GamePage test file first (Step 1) and match the mock pattern exactly. The test should verify that after recording a play that causes 3 outs, `activeTab` switches and a toast message appears.

**Step 3: Implement auto-switch + toast in GamePage**

In `src/pages/GamePage.tsx`:

**Change A** — Add toast state and previous-snapshot ref:
```tsx
import { useState, useEffect, useRef } from 'react'
// ...
const [toastMessage, setToastMessage] = useState<string | null>(null)
const prevHalfRef = useRef<string | null>(null)
```

**Change B** — Add `useEffect` to detect half changes and auto-switch tab:

Add this `useEffect` after the existing `useEffect` for `loadGame`:
```tsx
useEffect(() => {
  if (!snapshot) return

  const prevHalf = prevHalfRef.current
  prevHalfRef.current = `${snapshot.inning}-${snapshot.half}`

  // Skip on first render
  if (prevHalf === null) return

  const [prevInningStr, prevHalfStr] = prevHalf.split('-')
  const prevInning = parseInt(prevInningStr)

  // Detect half-inning transition
  const halfChanged = snapshot.half !== prevHalfStr || snapshot.inning !== prevInning
  if (!halfChanged) return

  // Switch tab to the now-batting team
  const nowBattingUs = snapshot.half === usBattingHalf
  setActiveTab(nowBattingUs ? 'us' : 'them')

  // Show toast
  const halfLabel = snapshot.half === 'top' ? 'Top' : 'Bot'
  setToastMessage(`Side retired — ${halfLabel} ${snapshot.inning}`)
  const timer = setTimeout(() => setToastMessage(null), 3000)
  return () => clearTimeout(timer)
}, [snapshot, usBattingHalf])
```

> **Note:** `usBattingHalf` is computed from `game.homeOrAway` before the effects. Since effects run after render, `usBattingHalf` will be the current value. If the `game` loads after mount, the effect will fire again correctly.

**Change C** — Add toast rendering to the JSX, before the closing `</div>`:
```tsx
{/* Toast notification */}
{toastMessage && (
  <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-5 py-2.5 rounded-full text-sm font-semibold shadow-lg z-50 transition-opacity duration-300">
    {toastMessage}
  </div>
)}
```

**Step 4: Run tests**

```bash
npm run test -- GamePage --reporter=verbose
```
Expected: All tests pass.

**Step 5: Commit**

```bash
git add src/pages/GamePage.tsx src/pages/__tests__/GamePage.test.tsx
git commit -m "feat: auto-switch tab and show toast after inning transition"
```

---

## Task 8: Batting Around the Order — Extra Inning Columns

This is the most complex task. Read `src/components/Scoresheet.tsx` and `src/components/__tests__/Scoresheet.test.tsx` fully before starting.

**Files:**
- Modify: `src/components/Scoresheet.tsx`
- Test: `src/components/__tests__/Scoresheet.test.tsx`

**Step 1: Write failing tests for extra columns**

Add to `src/components/__tests__/Scoresheet.test.tsx`:

```tsx
it('shows both at-bats in separate columns when batter wraps in same inning', () => {
  const smallLineup: LineupSlot[] = [
    { orderPosition: 1, playerId: 1, playerName: 'Alice', jerseyNumber: 1, position: 'P', substitutions: [] },
    { orderPosition: 2, playerId: 2, playerName: 'Bob', jerseyNumber: 2, position: 'C', substitutions: [] },
  ]
  // Alice bats twice in inning 1: first K (seq 1), then BB (seq 10)
  const plays: Play[] = [
    {
      id: 1, gameId: 1, sequenceNumber: 1, inning: 1, half: 'top',
      batterOrderPosition: 1, playType: 'K', notation: 'K',
      fieldersInvolved: [], basesReached: [], runsScoredOnPlay: 0,
      rbis: 0, pitches: [], isAtBat: true, timestamp: new Date(),
    },
    {
      id: 2, gameId: 1, sequenceNumber: 2, inning: 1, half: 'top',
      batterOrderPosition: 2, playType: 'BB', notation: 'BB',
      fieldersInvolved: [], basesReached: [1], runsScoredOnPlay: 0,
      rbis: 0, pitches: [], isAtBat: true, timestamp: new Date(),
    },
    {
      id: 3, gameId: 1, sequenceNumber: 10, inning: 1, half: 'top',
      batterOrderPosition: 1, playType: 'BB', notation: 'BB',
      fieldersInvolved: [], basesReached: [1], runsScoredOnPlay: 0,
      rbis: 0, pitches: [], isAtBat: true, timestamp: new Date(),
    },
  ]
  render(
    <Scoresheet
      lineup={smallLineup}
      plays={plays}
      currentInning={2}
      currentBatterPosition={1}
      maxInnings={6}
      onCellClick={() => {}}
    />
  )
  // Should show a "1b" column header for the wrap
  expect(screen.getByText('1b')).toBeInTheDocument()
})

it('shows K in pass-1 column and BB in pass-2 column for same batter', () => {
  const smallLineup: LineupSlot[] = [
    { orderPosition: 1, playerId: 1, playerName: 'Alice', jerseyNumber: 1, position: 'P', substitutions: [] },
    { orderPosition: 2, playerId: 2, playerName: 'Bob', jerseyNumber: 2, position: 'C', substitutions: [] },
  ]
  const plays: Play[] = [
    {
      id: 1, gameId: 1, sequenceNumber: 1, inning: 1, half: 'top',
      batterOrderPosition: 1, playType: 'K', notation: 'K',
      fieldersInvolved: [], basesReached: [], runsScoredOnPlay: 0,
      rbis: 0, pitches: [], isAtBat: true, timestamp: new Date(),
    },
    {
      id: 2, gameId: 1, sequenceNumber: 2, inning: 1, half: 'top',
      batterOrderPosition: 2, playType: 'GO', notation: '6-3',
      fieldersInvolved: [6, 3], basesReached: [], runsScoredOnPlay: 0,
      rbis: 0, pitches: [], isAtBat: true, timestamp: new Date(),
    },
    {
      id: 3, gameId: 1, sequenceNumber: 10, inning: 1, half: 'top',
      batterOrderPosition: 1, playType: 'BB', notation: 'BB',
      fieldersInvolved: [], basesReached: [1], runsScoredOnPlay: 0,
      rbis: 0, pitches: [], isAtBat: true, timestamp: new Date(),
    },
  ]
  const { container } = render(
    <Scoresheet
      lineup={smallLineup}
      plays={plays}
      currentInning={2}
      currentBatterPosition={1}
      maxInnings={6}
      onCellClick={() => {}}
    />
  )
  const cells = container.querySelectorAll('[data-testid="atbat-cell"]')
  // cells[0] = Alice inning 1 pass 1 → K
  // cells[1] = Bob inning 1 pass 1 → 6-3
  // cells[2] = Alice inning 1 pass 2 → BB (new column "1b")
  expect(cells[0].textContent).toContain('K')
  expect(cells[2].textContent).toContain('BB')
})
```

Also **update the existing wrap test** (which currently asserts the LAST play is shown) to match the new behavior:

Find the test `'shows the last at-bat when a batter appears twice in the same inning (order wrap)'` and replace its assertion:

```tsx
// Old test showed last play in single column; new design shows both in separate columns
// Rename + update:
it('shows K in first column and BB in wrap column when batter bats twice in same inning', () => {
  // ... keep same plays setup ...
  // Now assert both are visible
  const cells = container.querySelectorAll('[data-testid="atbat-cell"]')
  // Alice pass 1 = K, Alice pass 2 = BB
  const aliceCells = Array.from(cells).filter(c => {
    // Find cells that have content (non-empty)
    return c.textContent && (c.textContent.includes('K') || c.textContent.includes('BB'))
  })
  expect(aliceCells.length).toBe(2)
})
```

**Step 2: Run to verify failures**

```bash
npm run test -- Scoresheet --reporter=verbose
```
Expected: New tests fail.

**Step 3: Add pass computation helpers to Scoresheet**

At the top of `src/components/Scoresheet.tsx`, before the component, add:

```tsx
// --- Pass computation (batting around the order) ---

/** Returns a Map<playId, passNumber> for all at-bat plays. Pass 1 = first time through order in an inning. */
function computePassMap(plays: Play[]): Map<number, number> {
  const passMap = new Map<number, number>()
  const byInning = new Map<number, Play[]>()

  for (const p of plays) {
    if (!p.isAtBat || p.id === undefined) continue
    if (!byInning.has(p.inning)) byInning.set(p.inning, [])
    byInning.get(p.inning)!.push(p)
  }

  for (const [, inningPlays] of byInning) {
    const sorted = [...inningPlays].sort((a, b) => a.sequenceNumber - b.sequenceNumber)
    let pass = 1
    const seenInPass = new Set<number>()

    for (const play of sorted) {
      if (seenInPass.has(play.batterOrderPosition)) {
        pass++
        seenInPass.clear()
      }
      seenInPass.add(play.batterOrderPosition)
      passMap.set(play.id!, pass)
    }
  }

  return passMap
}

interface InningColumn {
  inning: number
  pass: number
  label: string
}

/** Generates ordered column definitions, including "1b", "1c" etc. for wrap passes. */
function buildColumns(
  plays: Play[],
  passMap: Map<number, number>,
  maxInnings: number,
  currentInning: number,
): InningColumn[] {
  // Find max pass per inning from recorded plays
  const maxPassByInning = new Map<number, number>()
  for (const play of plays) {
    if (!play.isAtBat || play.id === undefined) continue
    const pass = passMap.get(play.id) ?? 1
    const cur = maxPassByInning.get(play.inning) ?? 0
    if (pass > cur) maxPassByInning.set(play.inning, pass)
  }

  const highestInning = Math.max(maxInnings, currentInning)
  const cols: InningColumn[] = []

  for (let inn = 1; inn <= highestInning; inn++) {
    const maxPass = maxPassByInning.get(inn) ?? 1
    for (let p = 1; p <= maxPass; p++) {
      const suffix = p === 1 ? '' : String.fromCharCode(96 + p) // '', 'b', 'c', ...
      cols.push({ inning: inn, pass: p, label: `${inn}${suffix}` })
    }
  }

  return cols
}

/** Returns which pass the current (not-yet-recorded) at-bat is in for the given inning. */
function getCurrentPass(
  plays: Play[],
  passMap: Map<number, number>,
  currentInning: number,
  currentBatterPosition: number,
): number {
  const inningPlays = plays.filter(p => p.isAtBat && p.inning === currentInning && p.id !== undefined)
  if (inningPlays.length === 0) return 1

  const sorted = [...inningPlays].sort((a, b) => b.sequenceNumber - a.sequenceNumber)
  const lastPass = passMap.get(sorted[0].id!) ?? 1
  const lastPassPlays = inningPlays.filter(p => (passMap.get(p.id!) ?? 1) === lastPass)
  const seenInLastPass = new Set(lastPassPlays.map(p => p.batterOrderPosition))

  return seenInLastPass.has(currentBatterPosition) ? lastPass + 1 : lastPass
}
```

**Step 4: Update Scoresheet component body**

Replace the body of `Scoresheet` component:

```tsx
export function Scoresheet({
  lineup,
  plays,
  currentInning,
  currentBatterPosition,
  maxInnings,
  onCellClick,
  runsMap,
}: ScoresheetProps) {
  const passMap = computePassMap(plays)
  const columns = buildColumns(plays, passMap, maxInnings, currentInning)
  const currentPass = getCurrentPass(plays, passMap, currentInning, currentBatterPosition)

  const getPlayForCell = (batterPosition: number, inning: number, pass: number): Play | undefined => {
    return plays.find(
      p => p.isAtBat &&
        p.batterOrderPosition === batterPosition &&
        p.inning === inning &&
        p.id !== undefined &&
        (passMap.get(p.id) ?? 1) === pass
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-sm min-w-full">
        <thead>
          <tr className="bg-slate-100">
            <th className="sticky left-0 z-10 bg-slate-100 border border-slate-200 px-2 py-1.5 text-left min-w-[140px]">
              Batter
            </th>
            {columns.map(col => (
              <th key={`${col.inning}-${col.pass}`} className="border border-slate-200 px-1 py-1.5 text-center min-w-[76px] font-bold">
                {col.label}
              </th>
            ))}
            <th className="border border-slate-200 px-2 py-1.5 text-center w-10 text-xs font-semibold text-slate-500">AB</th>
            <th className="border border-slate-200 px-2 py-1.5 text-center w-10 text-xs font-semibold text-slate-500">R</th>
            <th className="border border-slate-200 px-2 py-1.5 text-center w-10 text-xs font-semibold text-slate-500">H</th>
            <th className="border border-slate-200 px-2 py-1.5 text-center w-10 text-xs font-semibold text-slate-500">RBI</th>
            <th className="border border-slate-200 px-2 py-1.5 text-center w-10 text-xs font-semibold text-slate-500">BB</th>
            <th className="border border-slate-200 px-2 py-1.5 text-center w-10 text-xs font-semibold text-slate-500">K</th>
          </tr>
        </thead>
        <tbody>
          {lineup.map(slot => {
            const playerPlays = plays.filter(p => p.batterOrderPosition === slot.orderPosition && p.isAtBat)
            const stats = computePlayerStats(playerPlays, slot.orderPosition, runsMap?.get(slot.orderPosition) ?? 0)

            return (
              <tr key={slot.orderPosition}>
                {/* Player info — sticky left column */}
                <td className="sticky left-0 z-10 bg-white border border-slate-200 px-2 py-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-mono w-4">{slot.orderPosition}.</span>
                    <span className="text-xs text-slate-500 font-mono w-6">#{slot.jerseyNumber}</span>
                    <span className="text-xs text-slate-500 w-6">{slot.position}</span>
                    <span className="font-semibold text-slate-800 truncate">{slot.playerName}</span>
                  </div>
                  {slot.substitutions.map((sub, si) => (
                    <div key={si} className="flex items-center gap-2 mt-0.5 text-xs text-slate-400 border-t border-dashed border-slate-200 pt-0.5">
                      <span className="w-4"></span>
                      <span className="font-mono w-6">#{sub.newJerseyNumber}</span>
                      <span className="w-6">{sub.newPosition}</span>
                      <span className="truncate">{sub.newPlayerName}</span>
                      <span className="text-[10px]">({sub.half === 'top' ? 'T' : 'B'}{sub.inning})</span>
                    </div>
                  ))}
                </td>

                {/* At-bat cells per inning column */}
                {columns.map(col => {
                  const play = getPlayForCell(slot.orderPosition, col.inning, col.pass)
                  const isCurrentBatter =
                    slot.orderPosition === currentBatterPosition &&
                    col.inning === currentInning &&
                    col.pass === currentPass
                  return (
                    <td key={`${col.inning}-${col.pass}`} className="border border-slate-200 p-0">
                      <AtBatCell
                        play={play ? {
                          playType: play.playType,
                          notation: play.notation,
                          basesReached: play.basesReached,
                          runsScoredOnPlay: play.runsScoredOnPlay,
                          pitches: play.pitches,
                        } : null}
                        isCurrentBatter={isCurrentBatter}
                        onClick={() => onCellClick(slot.orderPosition, col.inning)}
                      />
                    </td>
                  )
                })}

                {/* Summary stats */}
                <td className="border border-slate-200 px-2 py-1 text-center text-xs font-mono">{stats.atBats}</td>
                <td className="border border-slate-200 px-2 py-1 text-center text-xs font-mono">{stats.runs}</td>
                <td className="border border-slate-200 px-2 py-1 text-center text-xs font-mono">{stats.hits}</td>
                <td className="border border-slate-200 px-2 py-1 text-center text-xs font-mono">{stats.rbis}</td>
                <td className="border border-slate-200 px-2 py-1 text-center text-xs font-mono">{stats.walks}</td>
                <td className="border border-slate-200 px-2 py-1 text-center text-xs font-mono">{stats.strikeouts}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

**Step 5: Run all tests**

```bash
npm run test
```
Expected: All tests pass. Note: the existing "shows the last at-bat" test will need updating (Step 1 covered this).

**Step 6: Run lint and build**

```bash
npm run lint && npm run build
```
Expected: No errors.

**Step 7: Commit**

```bash
git add src/components/Scoresheet.tsx src/components/__tests__/Scoresheet.test.tsx
git commit -m "feat: add extra inning columns when batting order wraps in scoresheet"
```

---

## Final: Run all tests + build

```bash
npm run test && npm run lint && npm run build
```
Expected: All tests pass, lint clean, build succeeds.
