# Scorekeeper PWA Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Progressive Web App for little league scorekeeping that mirrors the paper Glover's scorebook, with a pure game engine, event-log replay, per-pitch tracking, and offline-first architecture.

**Architecture:** Pure game engine (functions that replay an ordered play list into a computed GameSnapshot) + Dexie.js for IndexedDB persistence + React Context for state distribution + react-router-dom for navigation. No external state management library.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS v4 (@tailwindcss/vite), Dexie.js, react-router-dom, vite-plugin-pwa, vitest + @testing-library/react

**Design Doc:** `docs/plans/2026-02-22-scorekeeper-design-v2.md`

**TypeScript Notes:** The tsconfig uses `verbatimModuleSyntax: true` (use `import type` for type-only imports), `erasableSyntaxOnly: true` (no enums — use string unions), `noUnusedLocals: true`, `noUnusedParameters: true`.

---

## Phase 1: Project Cleanup & Setup

### Task 1: Fix Tailwind v4, remove unused deps, add required deps

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Modify: `src/index.css`
- Delete: `tailwind.config.js`
- Delete: `postcss.config.js`
- Delete: `src/App.css`
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`
- Modify: `index.html`

**Step 1: Install correct dependencies**

```bash
npm install react-router-dom dexie
npm install -D @tailwindcss/vite vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
npm uninstall zustand axios
```

**Step 2: Delete obsolete config files**

```bash
rm tailwind.config.js postcss.config.js src/App.css src/assets/react.svg
```

**Step 3: Update `vite.config.ts`**

Replace entire file:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      },
      manifest: {
        name: 'Scorekeeper',
        short_name: 'Scorekeeper',
        description: 'Little League Scorekeeping App',
        theme_color: '#1e3a5f',
        background_color: '#f8fafc',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  }
})
```

**Step 4: Create test setup file**

Create `src/test-setup.ts`:

```typescript
import '@testing-library/jest-dom/vitest'
```

**Step 5: Update `src/index.css`**

Replace entire file:

```css
@import "tailwindcss";
```

**Step 6: Update `index.html`**

Replace entire file:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Scorekeeper</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 7: Replace `src/App.tsx` with placeholder**

```typescript
function App() {
  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <h1 className="text-3xl font-bold text-slate-900">Scorekeeper</h1>
      <p className="mt-2 text-slate-600">Coming soon.</p>
    </div>
  )
}

export default App
```

**Step 8: Update `src/main.tsx`**

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

**Step 9: Add test script to `package.json`**

Add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 10: Verify dev server runs**

```bash
npm run dev
```

Expected: Vite dev server on http://localhost:5173, page shows "Scorekeeper" heading with Tailwind styling applied (slate colors, font-bold visible).

**Step 11: Verify test runner works**

Create `src/__tests__/smoke.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

describe('smoke test', () => {
  it('should run', () => {
    expect(1 + 1).toBe(2)
  })
})
```

Run:

```bash
npm run test
```

Expected: PASS

**Step 12: Commit**

```bash
git add -A
git commit -m "chore: fix tailwind v4 setup, add vitest, remove unused deps"
```

---

## Phase 2: Game Engine — Types & Core Logic

### Task 2: Define all game types

**Files:**
- Create: `src/engine/types.ts`

**Step 1: Create types file**

Create `src/engine/types.ts`:

```typescript
// --- Play types (string unions, no enums per tsconfig) ---

export type HalfInning = 'top' | 'bottom'
export type GameStatus = 'draft' | 'in_progress' | 'completed'
export type HomeOrAway = 'home' | 'away'
export type Side = 'us' | 'them'
export type PitchResult = 'B' | 'S' | 'F'

// Play types that count as an at-bat (advance the batter)
export type AtBatPlayType =
  | 'K'           // strikeout swinging
  | 'KL'          // strikeout looking
  | 'BB'          // walk
  | 'HBP'         // hit by pitch
  | '1B'          // single
  | '2B'          // double
  | '3B'          // triple
  | 'HR'          // home run
  | 'GO'          // ground out (with fielders)
  | 'FO'          // fly out (with fielders)
  | 'LO'          // line out (with fielders)
  | 'PO'          // pop out (with fielders)
  | 'FC'          // fielder's choice
  | 'E'           // error
  | 'DP'          // double play
  | 'SAC'         // sacrifice

// Play types that do NOT advance the batter (happen during an at-bat)
export type NonAtBatPlayType =
  | 'SB'          // stolen base
  | 'WP'          // wild pitch
  | 'PB'          // passed ball
  | 'BK'          // balk

export type PlayType = AtBatPlayType | NonAtBatPlayType

// --- Core data types ---

export interface Team {
  id?: number
  name: string
  createdAt: Date
}

export interface Player {
  id?: number
  teamId: number
  name: string
  jerseyNumber: number
  defaultPosition: string
  createdAt: Date
}

export interface Substitution {
  inning: number
  half: HalfInning
  newPlayerName: string
  newJerseyNumber: number
  newPosition: string
}

export interface LineupSlot {
  orderPosition: number        // 1-based batting order position
  playerId: number | null      // null for opponent players (inline)
  playerName: string
  jerseyNumber: number
  position: string
  substitutions: Substitution[]
}

export interface Lineup {
  id?: number
  gameId: number
  side: Side
  battingOrder: LineupSlot[]
}

export interface Game {
  id?: number
  teamId: number
  code: string
  date: Date
  opponentName: string
  homeOrAway: HomeOrAway
  status: GameStatus
  createdAt: Date
  updatedAt: Date
}

// --- Play event log ---

export interface BaseRunnerOverride {
  first: BaseRunner | null
  second: BaseRunner | null
  third: BaseRunner | null
}

export interface Play {
  id?: number
  gameId: number
  sequenceNumber: number
  inning: number
  half: HalfInning
  batterOrderPosition: number  // 1-based position in batting order
  playType: PlayType
  notation: string             // display string: "6-3", "1B", "K", etc.
  fieldersInvolved: number[]   // position numbers [6, 3]
  basesReached: number[]       // bases the BATTER reached: [1] for single, [1,2] for double, etc.
  runsScoredOnPlay: number
  rbis: number
  pitches: PitchResult[]       // per-pitch tracking: ["B", "S", "F", "B", "S"]
  isAtBat: boolean             // true for plays that advance the batting order
  runnerOverrides?: BaseRunnerOverride  // scorekeeper adjustments from confirm step
  timestamp: Date
}

// --- Computed game state (never stored) ---

export interface BaseRunner {
  playerName: string
  orderPosition: number
}

export interface BaseRunners {
  first: BaseRunner | null
  second: BaseRunner | null
  third: BaseRunner | null
}

export interface GameSnapshot {
  inning: number
  half: HalfInning
  outs: number
  scoreUs: number
  scoreThem: number
  currentBatterUs: number      // 1-based order position
  currentBatterThem: number    // 1-based order position
  baseRunners: BaseRunners
  pitchCountByPitcher: Map<string, number>  // pitcher name → cumulative count
  runsPerInningUs: number[]    // index 0 = inning 1
  runsPerInningThem: number[]
  isGameOver: boolean
}
```

**Step 2: Commit**

```bash
git add src/engine/types.ts
git commit -m "feat: define all game engine types"
```

---

### Task 3: Game engine — batting order, outs, inning advancement, baserunners, scoring

This is the core engine. All game rules live here.

**Files:**
- Create: `src/engine/engine.ts`
- Create: `src/engine/__tests__/engine.test.ts`

**Step 1: Write failing tests**

Create `src/engine/__tests__/engine.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { replayGame } from '../engine'
import type { Play, Lineup, LineupSlot } from '../types'

function makeLineup(side: 'us' | 'them', count = 9): Lineup {
  const battingOrder: LineupSlot[] = Array.from({ length: count }, (_, i) => ({
    orderPosition: i + 1,
    playerId: side === 'us' ? i + 1 : null,
    playerName: `${side}-Player${i + 1}`,
    jerseyNumber: (i + 1) * 10,
    position: ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'][i] ?? 'DH',
    substitutions: [],
  }))
  return { gameId: 1, side, battingOrder }
}

function makePlay(overrides: Partial<Play> & Pick<Play, 'sequenceNumber' | 'half' | 'batterOrderPosition' | 'playType'>): Play {
  return {
    gameId: 1,
    inning: 1,
    notation: overrides.playType,
    fieldersInvolved: [],
    basesReached: [],
    runsScoredOnPlay: 0,
    rbis: 0,
    pitches: [],
    isAtBat: true,
    timestamp: new Date(),
    ...overrides,
  }
}

const lineupUs = makeLineup('us')
const lineupThem = makeLineup('them')

describe('replayGame — initial state', () => {
  it('should return initial state with no plays', () => {
    const snapshot = replayGame([], lineupUs, lineupThem)
    expect(snapshot.inning).toBe(1)
    expect(snapshot.half).toBe('top')
    expect(snapshot.outs).toBe(0)
    expect(snapshot.scoreUs).toBe(0)
    expect(snapshot.scoreThem).toBe(0)
    expect(snapshot.currentBatterUs).toBe(1)
    expect(snapshot.currentBatterThem).toBe(1)
    expect(snapshot.isGameOver).toBe(false)
  })
})

describe('replayGame — batting order', () => {
  it('should advance batter after an at-bat play', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: 'K' }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem)
    expect(snapshot.currentBatterUs).toBe(2)
    expect(snapshot.outs).toBe(1)
  })

  it('should NOT advance batter after a non-at-bat play', () => {
    const plays: Play[] = [
      makePlay({
        sequenceNumber: 1, half: 'top', batterOrderPosition: 1,
        playType: 'SB', isAtBat: false,
      }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem)
    expect(snapshot.currentBatterUs).toBe(1)
  })

  it('should wrap batting order from 9 back to 1', () => {
    const plays: Play[] = Array.from({ length: 9 }, (_, i) =>
      makePlay({
        sequenceNumber: i + 1,
        inning: Math.floor(i / 3) + 1,
        half: 'top',
        batterOrderPosition: i + 1,
        playType: 'K',
      })
    )
    const snapshot = replayGame(plays, lineupUs, lineupThem)
    expect(snapshot.currentBatterUs).toBe(1)
  })
})

describe('replayGame — inning advancement', () => {
  it('should advance to bottom of inning after 3 outs in top', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: 'K' }),
      makePlay({ sequenceNumber: 2, half: 'top', batterOrderPosition: 2, playType: 'GO', fieldersInvolved: [6, 3] }),
      makePlay({ sequenceNumber: 3, half: 'top', batterOrderPosition: 3, playType: 'FO', fieldersInvolved: [8] }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem)
    expect(snapshot.inning).toBe(1)
    expect(snapshot.half).toBe('bottom')
    expect(snapshot.outs).toBe(0)
  })

  it('should advance to next inning after 3 outs in bottom', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, inning: 1, half: 'top', batterOrderPosition: 1, playType: 'K' }),
      makePlay({ sequenceNumber: 2, inning: 1, half: 'top', batterOrderPosition: 2, playType: 'K' }),
      makePlay({ sequenceNumber: 3, inning: 1, half: 'top', batterOrderPosition: 3, playType: 'K' }),
      makePlay({ sequenceNumber: 4, inning: 1, half: 'bottom', batterOrderPosition: 1, playType: 'K' }),
      makePlay({ sequenceNumber: 5, inning: 1, half: 'bottom', batterOrderPosition: 2, playType: 'K' }),
      makePlay({ sequenceNumber: 6, inning: 1, half: 'bottom', batterOrderPosition: 3, playType: 'K' }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem)
    expect(snapshot.inning).toBe(2)
    expect(snapshot.half).toBe('top')
    expect(snapshot.outs).toBe(0)
  })

  it('should count double play as 2 outs', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: 'DP', fieldersInvolved: [6, 4, 3] }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem)
    expect(snapshot.outs).toBe(2)
  })
})

describe('replayGame — baserunners', () => {
  it('should put batter on first after a single', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: '1B', basesReached: [1] }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem)
    expect(snapshot.baseRunners.first?.orderPosition).toBe(1)
    expect(snapshot.baseRunners.second).toBeNull()
    expect(snapshot.baseRunners.third).toBeNull()
  })

  it('should advance runner from 1st to 2nd on next single', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: '1B', basesReached: [1] }),
      makePlay({ sequenceNumber: 2, half: 'top', batterOrderPosition: 2, playType: '1B', basesReached: [1] }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem)
    expect(snapshot.baseRunners.first?.orderPosition).toBe(2)
    expect(snapshot.baseRunners.second?.orderPosition).toBe(1)
  })

  it('should score runner from 3rd on a single', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: '3B', basesReached: [1, 2, 3] }),
      makePlay({ sequenceNumber: 2, half: 'top', batterOrderPosition: 2, playType: '1B', basesReached: [1] }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem)
    expect(snapshot.scoreUs).toBe(1)
    expect(snapshot.baseRunners.first?.orderPosition).toBe(2)
    expect(snapshot.baseRunners.third).toBeNull()
  })

  it('should clear all bases and score everyone on HR', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: '1B', basesReached: [1] }),
      makePlay({ sequenceNumber: 2, half: 'top', batterOrderPosition: 2, playType: '2B', basesReached: [1, 2] }),
      makePlay({ sequenceNumber: 3, half: 'top', batterOrderPosition: 3, playType: 'HR', basesReached: [1, 2, 3, 4] }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem)
    expect(snapshot.scoreUs).toBe(3)
    expect(snapshot.baseRunners.first).toBeNull()
    expect(snapshot.baseRunners.second).toBeNull()
    expect(snapshot.baseRunners.third).toBeNull()
  })

  it('should force-advance on walk with bases loaded', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: '1B', basesReached: [1] }),
      makePlay({ sequenceNumber: 2, half: 'top', batterOrderPosition: 2, playType: '1B', basesReached: [1] }),
      makePlay({ sequenceNumber: 3, half: 'top', batterOrderPosition: 3, playType: '1B', basesReached: [1] }),
      makePlay({ sequenceNumber: 4, half: 'top', batterOrderPosition: 4, playType: 'BB', basesReached: [1] }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem)
    expect(snapshot.scoreUs).toBe(1)
    expect(snapshot.baseRunners.first).not.toBeNull()
    expect(snapshot.baseRunners.second).not.toBeNull()
    expect(snapshot.baseRunners.third).not.toBeNull()
  })

  it('should clear bases on 3rd out', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: '1B', basesReached: [1] }),
      makePlay({ sequenceNumber: 2, half: 'top', batterOrderPosition: 2, playType: 'K' }),
      makePlay({ sequenceNumber: 3, half: 'top', batterOrderPosition: 3, playType: 'K' }),
      makePlay({ sequenceNumber: 4, half: 'top', batterOrderPosition: 4, playType: 'K' }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem)
    expect(snapshot.half).toBe('bottom')
    expect(snapshot.baseRunners.first).toBeNull()
  })

  it('should advance runner on stolen base without advancing batter', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: '1B', basesReached: [1] }),
      makePlay({ sequenceNumber: 2, half: 'top', batterOrderPosition: 2, playType: 'SB', isAtBat: false }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem)
    expect(snapshot.baseRunners.first).toBeNull()
    expect(snapshot.baseRunners.second?.orderPosition).toBe(1)
    expect(snapshot.currentBatterUs).toBe(2)
  })

  it('should advance all runners on wild pitch', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, half: 'top', batterOrderPosition: 1, playType: '2B', basesReached: [1, 2] }),
      makePlay({ sequenceNumber: 2, half: 'top', batterOrderPosition: 2, playType: 'WP', isAtBat: false }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem)
    expect(snapshot.baseRunners.second).toBeNull()
    expect(snapshot.baseRunners.third?.orderPosition).toBe(1)
  })
})

describe('replayGame — scoring', () => {
  it('should track runs per inning for us', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, inning: 1, half: 'top', batterOrderPosition: 1, playType: 'HR', basesReached: [1, 2, 3, 4] }),
      makePlay({ sequenceNumber: 2, inning: 1, half: 'top', batterOrderPosition: 2, playType: 'K' }),
      makePlay({ sequenceNumber: 3, inning: 1, half: 'top', batterOrderPosition: 3, playType: 'K' }),
      makePlay({ sequenceNumber: 4, inning: 1, half: 'top', batterOrderPosition: 4, playType: 'K' }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem)
    expect(snapshot.runsPerInningUs[0]).toBe(1)
    expect(snapshot.scoreUs).toBe(1)
  })

  it('should track runs per inning for them', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, inning: 1, half: 'top', batterOrderPosition: 1, playType: 'K' }),
      makePlay({ sequenceNumber: 2, inning: 1, half: 'top', batterOrderPosition: 2, playType: 'K' }),
      makePlay({ sequenceNumber: 3, inning: 1, half: 'top', batterOrderPosition: 3, playType: 'K' }),
      makePlay({ sequenceNumber: 4, inning: 1, half: 'bottom', batterOrderPosition: 1, playType: 'HR', basesReached: [1, 2, 3, 4] }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem)
    expect(snapshot.runsPerInningThem[0]).toBe(1)
    expect(snapshot.scoreThem).toBe(1)
  })

  it('should handle multi-run innings', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, inning: 1, half: 'top', batterOrderPosition: 1, playType: '1B', basesReached: [1] }),
      makePlay({ sequenceNumber: 2, inning: 1, half: 'top', batterOrderPosition: 2, playType: '1B', basesReached: [1] }),
      makePlay({ sequenceNumber: 3, inning: 1, half: 'top', batterOrderPosition: 3, playType: 'HR', basesReached: [1, 2, 3, 4] }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem)
    expect(snapshot.scoreUs).toBe(3)
    expect(snapshot.runsPerInningUs[0]).toBe(3)
  })
})

describe('replayGame — pitch count', () => {
  it('should track cumulative pitch count per pitcher', () => {
    const plays: Play[] = [
      makePlay({
        sequenceNumber: 1, half: 'top', batterOrderPosition: 1,
        playType: 'K', pitches: ['S', 'B', 'S', 'S'],
      }),
      makePlay({
        sequenceNumber: 2, half: 'top', batterOrderPosition: 2,
        playType: 'BB', pitches: ['B', 'B', 'S', 'B', 'B'],
      }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem)
    expect(snapshot.pitchCountByPitcher.get('them-Player1')).toBe(9)
  })

  it('should track pitch counts separately per half-inning pitcher', () => {
    const plays: Play[] = [
      makePlay({ sequenceNumber: 1, inning: 1, half: 'top', batterOrderPosition: 1, playType: 'K', pitches: ['S', 'S', 'S'] }),
      makePlay({ sequenceNumber: 2, inning: 1, half: 'top', batterOrderPosition: 2, playType: 'K', pitches: ['S', 'S', 'S'] }),
      makePlay({ sequenceNumber: 3, inning: 1, half: 'top', batterOrderPosition: 3, playType: 'K', pitches: ['S', 'S', 'S'] }),
      makePlay({ sequenceNumber: 4, inning: 1, half: 'bottom', batterOrderPosition: 1, playType: 'K', pitches: ['S', 'B', 'S', 'S'] }),
    ]
    const snapshot = replayGame(plays, lineupUs, lineupThem)
    expect(snapshot.pitchCountByPitcher.get('them-Player1')).toBe(9)
    expect(snapshot.pitchCountByPitcher.get('us-Player1')).toBe(4)
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm run test -- src/engine/__tests__/engine.test.ts
```

Expected: FAIL — `replayGame` does not exist

**Step 3: Implement the game engine**

Create `src/engine/engine.ts`:

```typescript
import type { Play, Lineup, GameSnapshot, BaseRunners, HalfInning, BaseRunner } from './types'

function initialSnapshot(): GameSnapshot {
  return {
    inning: 1,
    half: 'top',
    outs: 0,
    scoreUs: 0,
    scoreThem: 0,
    currentBatterUs: 1,
    currentBatterThem: 1,
    baseRunners: { first: null, second: null, third: null },
    pitchCountByPitcher: new Map(),
    runsPerInningUs: [],
    runsPerInningThem: [],
    isGameOver: false,
  }
}

function getOutsForPlay(play: Play): number {
  if (!play.isAtBat) return 0
  switch (play.playType) {
    case 'K':
    case 'KL':
    case 'GO':
    case 'FO':
    case 'LO':
    case 'PO':
    case 'FC':
    case 'SAC':
      return 1
    case 'DP':
      return 2
    default:
      return 0
  }
}

function advanceBatter(current: number, lineupSize: number): number {
  return current >= lineupSize ? 1 : current + 1
}

function advanceHalfInning(snapshot: GameSnapshot): void {
  snapshot.baseRunners = { first: null, second: null, third: null }
  snapshot.outs = 0
  if (snapshot.half === 'top') {
    snapshot.half = 'bottom'
  } else {
    snapshot.half = 'top'
    snapshot.inning += 1
  }
}

function ensureInningArray(arr: number[], inning: number): void {
  while (arr.length < inning) {
    arr.push(0)
  }
}

function getBaseRunnerForBatter(
  batterOrderPosition: number,
  half: HalfInning,
  lineupUs: Lineup,
  lineupThem: Lineup,
): BaseRunner {
  const lineup = half === 'top' ? lineupUs : lineupThem
  const slot = lineup.battingOrder.find(s => s.orderPosition === batterOrderPosition)
  return {
    playerName: slot?.playerName ?? `Player${batterOrderPosition}`,
    orderPosition: batterOrderPosition,
  }
}

function applyBaseRunning(
  snapshot: GameSnapshot,
  play: Play,
  lineupUs: Lineup,
  lineupThem: Lineup,
): number {
  let runsScored = 0
  const batter = getBaseRunnerForBatter(play.batterOrderPosition, play.half, lineupUs, lineupThem)
  const runners = snapshot.baseRunners

  // If play has runner overrides from scorekeeper confirmation, use those
  if (play.runnerOverrides) {
    snapshot.baseRunners = {
      first: play.runnerOverrides.first,
      second: play.runnerOverrides.second,
      third: play.runnerOverrides.third,
    }
    return play.runsScoredOnPlay
  }

  switch (play.playType) {
    case '1B': {
      if (runners.third) runsScored++
      if (runners.second) runsScored++
      const newSecond = runners.first
      snapshot.baseRunners = { first: batter, second: newSecond, third: null }
      break
    }
    case '2B': {
      if (runners.third) runsScored++
      if (runners.second) runsScored++
      const newThird = runners.first
      snapshot.baseRunners = { first: null, second: batter, third: newThird }
      break
    }
    case '3B': {
      if (runners.third) runsScored++
      if (runners.second) runsScored++
      if (runners.first) runsScored++
      snapshot.baseRunners = { first: null, second: null, third: batter }
      break
    }
    case 'HR': {
      if (runners.third) runsScored++
      if (runners.second) runsScored++
      if (runners.first) runsScored++
      runsScored++ // batter
      snapshot.baseRunners = { first: null, second: null, third: null }
      break
    }
    case 'BB':
    case 'HBP': {
      if (runners.first) {
        if (runners.second) {
          if (runners.third) {
            runsScored++ // bases loaded walk/HBP
          }
          snapshot.baseRunners.third = runners.second
        }
        snapshot.baseRunners.second = runners.first
      }
      snapshot.baseRunners.first = batter
      break
    }
    case 'SB': {
      if (runners.third) {
        runsScored++
        snapshot.baseRunners.third = null
      } else if (runners.second) {
        snapshot.baseRunners.third = runners.second
        snapshot.baseRunners.second = null
      } else if (runners.first) {
        snapshot.baseRunners.second = runners.first
        snapshot.baseRunners.first = null
      }
      break
    }
    case 'WP':
    case 'PB':
    case 'BK': {
      if (runners.third) {
        runsScored++
        snapshot.baseRunners.third = null
      }
      if (runners.second) {
        snapshot.baseRunners.third = runners.second
        snapshot.baseRunners.second = null
      }
      if (runners.first) {
        snapshot.baseRunners.second = runners.first
        snapshot.baseRunners.first = null
      }
      break
    }
    case 'FC': {
      if (runners.third) {
        snapshot.baseRunners.third = null
      } else if (runners.second) {
        snapshot.baseRunners.second = null
      } else if (runners.first) {
        snapshot.baseRunners.first = null
      }
      snapshot.baseRunners.first = batter
      break
    }
    case 'SAC': {
      if (runners.third) {
        runsScored++
        snapshot.baseRunners.third = null
      }
      if (runners.second) {
        snapshot.baseRunners.third = runners.second
        snapshot.baseRunners.second = null
      }
      if (runners.first) {
        snapshot.baseRunners.second = runners.first
        snapshot.baseRunners.first = null
      }
      break
    }
    case 'DP': {
      if (runners.first) {
        snapshot.baseRunners.first = null
      } else if (runners.second) {
        snapshot.baseRunners.second = null
      } else if (runners.third) {
        snapshot.baseRunners.third = null
      }
      break
    }
    case 'E': {
      if (runners.third) runsScored++
      if (runners.second) runsScored++
      const newSecond = runners.first
      snapshot.baseRunners = { first: batter, second: newSecond, third: null }
      break
    }
    case 'K':
    case 'KL':
    case 'GO':
    case 'FO':
    case 'LO':
    case 'PO':
      // Out — runners stay put
      break
  }

  return runsScored
}

export function replayGame(
  plays: Play[],
  lineupUs: Lineup,
  lineupThem: Lineup,
): GameSnapshot {
  const snapshot = initialSnapshot()
  const lineupSizeUs = lineupUs.battingOrder.length
  const lineupSizeThem = lineupThem.battingOrder.length

  const sorted = [...plays].sort((a, b) => a.sequenceNumber - b.sequenceNumber)

  for (const play of sorted) {
    // Track pitch count
    if (play.pitches.length > 0) {
      const pitcherLineup = play.half === 'top' ? lineupThem : lineupUs
      const pitcher = pitcherLineup.battingOrder.find(s => s.position === 'P')
      if (pitcher) {
        const key = pitcher.playerName
        const current = snapshot.pitchCountByPitcher.get(key) ?? 0
        snapshot.pitchCountByPitcher.set(key, current + play.pitches.length)
      }
    }

    // Apply base running and scoring
    const outsOnPlay = getOutsForPlay(play)
    const runsScored = applyBaseRunning(snapshot, play, lineupUs, lineupThem)

    // Apply outs
    snapshot.outs += outsOnPlay

    // Apply runs
    const isUsBatting = play.half === 'top'
    if (isUsBatting) {
      snapshot.scoreUs += runsScored
      ensureInningArray(snapshot.runsPerInningUs, play.inning)
      snapshot.runsPerInningUs[play.inning - 1] += runsScored
    } else {
      snapshot.scoreThem += runsScored
      ensureInningArray(snapshot.runsPerInningThem, play.inning)
      snapshot.runsPerInningThem[play.inning - 1] += runsScored
    }

    // Advance batter
    if (play.isAtBat) {
      if (isUsBatting) {
        snapshot.currentBatterUs = advanceBatter(snapshot.currentBatterUs, lineupSizeUs)
      } else {
        snapshot.currentBatterThem = advanceBatter(snapshot.currentBatterThem, lineupSizeThem)
      }
    }

    // Check for inning change
    if (snapshot.outs >= 3) {
      advanceHalfInning(snapshot)
    }
  }

  return snapshot
}
```

**Step 4: Run tests**

```bash
npm run test -- src/engine/__tests__/engine.test.ts
```

Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/engine/
git commit -m "feat: add game engine with batting, baserunners, scoring, pitch tracking"
```

---

### Task 4: Notation parser and stats computation

**Files:**
- Create: `src/engine/notation.ts`
- Create: `src/engine/stats.ts`
- Create: `src/engine/__tests__/notation.test.ts`
- Create: `src/engine/__tests__/stats.test.ts`

**Step 1: Write failing notation tests**

Create `src/engine/__tests__/notation.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseShorthand, generateNotation } from '../notation'

describe('parseShorthand', () => {
  it('should parse strikeout', () => {
    const result = parseShorthand('K')
    expect(result.playType).toBe('K')
    expect(result.fieldersInvolved).toEqual([])
  })

  it('should parse single', () => {
    expect(parseShorthand('1B').playType).toBe('1B')
  })

  it('should parse single with direction', () => {
    const result = parseShorthand('1B7')
    expect(result.playType).toBe('1B')
    expect(result.fieldersInvolved).toEqual([7])
  })

  it('should parse ground out', () => {
    const result = parseShorthand('6-3')
    expect(result.playType).toBe('GO')
    expect(result.fieldersInvolved).toEqual([6, 3])
  })

  it('should parse double play', () => {
    const result = parseShorthand('6-4-3')
    expect(result.playType).toBe('DP')
    expect(result.fieldersInvolved).toEqual([6, 4, 3])
  })

  it('should parse fly out', () => {
    const result = parseShorthand('F8')
    expect(result.playType).toBe('FO')
    expect(result.fieldersInvolved).toEqual([8])
  })

  it('should parse walk', () => {
    expect(parseShorthand('BB').playType).toBe('BB')
  })

  it('should parse home run', () => {
    expect(parseShorthand('HR').playType).toBe('HR')
  })
})

describe('generateNotation', () => {
  it('should generate ground out notation', () => {
    expect(generateNotation('GO', [6, 3])).toBe('6-3')
  })

  it('should generate fly out notation', () => {
    expect(generateNotation('FO', [8])).toBe('F8')
  })

  it('should generate single with direction', () => {
    expect(generateNotation('1B', [7])).toBe('1B7')
  })

  it('should generate simple plays', () => {
    expect(generateNotation('K', [])).toBe('K')
    expect(generateNotation('BB', [])).toBe('BB')
    expect(generateNotation('HR', [])).toBe('HR')
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm run test -- src/engine/__tests__/notation.test.ts
```

Expected: FAIL

**Step 3: Implement notation parser**

Create `src/engine/notation.ts`:

```typescript
import type { PlayType } from './types'

interface ParsedPlay {
  playType: PlayType
  fieldersInvolved: number[]
  basesReached: number[]
  isAtBat: boolean
}

const SIMPLE_PLAYS: Record<string, { playType: PlayType; basesReached: number[]; isAtBat: boolean }> = {
  'K': { playType: 'K', basesReached: [], isAtBat: true },
  'KL': { playType: 'KL', basesReached: [], isAtBat: true },
  'BB': { playType: 'BB', basesReached: [1], isAtBat: true },
  'HBP': { playType: 'HBP', basesReached: [1], isAtBat: true },
  '1B': { playType: '1B', basesReached: [1], isAtBat: true },
  '2B': { playType: '2B', basesReached: [1, 2], isAtBat: true },
  '3B': { playType: '3B', basesReached: [1, 2, 3], isAtBat: true },
  'HR': { playType: 'HR', basesReached: [1, 2, 3, 4], isAtBat: true },
  'SB': { playType: 'SB', basesReached: [], isAtBat: false },
  'WP': { playType: 'WP', basesReached: [], isAtBat: false },
  'PB': { playType: 'PB', basesReached: [], isAtBat: false },
  'BK': { playType: 'BK', basesReached: [], isAtBat: false },
  'FC': { playType: 'FC', basesReached: [1], isAtBat: true },
  'SAC': { playType: 'SAC', basesReached: [], isAtBat: true },
}

export function parseShorthand(input: string): ParsedPlay {
  const trimmed = input.trim().toUpperCase()

  if (SIMPLE_PLAYS[trimmed]) {
    const p = SIMPLE_PLAYS[trimmed]
    return { playType: p.playType, fieldersInvolved: [], basesReached: p.basesReached, isAtBat: p.isAtBat }
  }

  // Hit with direction: "1B7", "2B8", "3B9"
  const hitWithDir = trimmed.match(/^([123]B)(\d)$/)
  if (hitWithDir) {
    const base = SIMPLE_PLAYS[hitWithDir[1]]
    return {
      playType: base.playType,
      fieldersInvolved: [parseInt(hitWithDir[2])],
      basesReached: base.basesReached,
      isAtBat: true,
    }
  }

  // Fly/line/pop out: "F8", "L6", "P4"
  const flyMatch = trimmed.match(/^([FLP])(\d)$/)
  if (flyMatch) {
    const typeMap: Record<string, PlayType> = { 'F': 'FO', 'L': 'LO', 'P': 'PO' }
    return {
      playType: typeMap[flyMatch[1]],
      fieldersInvolved: [parseInt(flyMatch[2])],
      basesReached: [],
      isAtBat: true,
    }
  }

  // Fielding sequence: "6-3", "6-4-3"
  const fieldingMatch = trimmed.match(/^(\d)-(\d)(?:-(\d))?$/)
  if (fieldingMatch) {
    const fielders = [parseInt(fieldingMatch[1]), parseInt(fieldingMatch[2])]
    if (fieldingMatch[3]) {
      fielders.push(parseInt(fieldingMatch[3]))
      return { playType: 'DP', fieldersInvolved: fielders, basesReached: [], isAtBat: true }
    }
    return { playType: 'GO', fieldersInvolved: fielders, basesReached: [], isAtBat: true }
  }

  // Error: "E6"
  const errorMatch = trimmed.match(/^E(\d)$/)
  if (errorMatch) {
    return { playType: 'E', fieldersInvolved: [parseInt(errorMatch[1])], basesReached: [1], isAtBat: true }
  }

  // Fallback
  return { playType: 'K', fieldersInvolved: [], basesReached: [], isAtBat: true }
}

export function generateNotation(playType: PlayType, fieldersInvolved: number[]): string {
  switch (playType) {
    case 'GO':
    case 'DP':
      return fieldersInvolved.join('-')
    case 'FO':
      return `F${fieldersInvolved[0] ?? ''}`
    case 'LO':
      return `L${fieldersInvolved[0] ?? ''}`
    case 'PO':
      return `P${fieldersInvolved[0] ?? ''}`
    case '1B':
    case '2B':
    case '3B':
      return fieldersInvolved.length > 0 ? `${playType}${fieldersInvolved[0]}` : playType
    case 'E':
      return `E${fieldersInvolved[0] ?? ''}`
    default:
      return playType
  }
}
```

**Step 4: Run notation tests**

```bash
npm run test -- src/engine/__tests__/notation.test.ts
```

Expected: ALL PASS

**Step 5: Write failing stats tests**

Create `src/engine/__tests__/stats.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { computePlayerStats } from '../stats'
import type { Play } from '../types'

function makeBatterPlay(overrides: Partial<Play>): Play {
  return {
    gameId: 1,
    sequenceNumber: 1,
    inning: 1,
    half: 'top',
    batterOrderPosition: 1,
    playType: 'K',
    notation: 'K',
    fieldersInvolved: [],
    basesReached: [],
    runsScoredOnPlay: 0,
    rbis: 0,
    pitches: [],
    isAtBat: true,
    timestamp: new Date(),
    ...overrides,
  }
}

describe('computePlayerStats', () => {
  it('should compute basic stats from plays', () => {
    const plays: Play[] = [
      makeBatterPlay({ playType: '1B', basesReached: [1] }),
      makeBatterPlay({ playType: 'K', sequenceNumber: 2 }),
      makeBatterPlay({ playType: '2B', basesReached: [1, 2], sequenceNumber: 3 }),
      makeBatterPlay({ playType: 'BB', basesReached: [1], sequenceNumber: 4 }),
      makeBatterPlay({ playType: 'HR', basesReached: [1, 2, 3, 4], rbis: 1, sequenceNumber: 5 }),
    ]
    const stats = computePlayerStats(plays, 1)
    expect(stats.atBats).toBe(4)   // BB excluded
    expect(stats.hits).toBe(3)     // 1B + 2B + HR
    expect(stats.walks).toBe(1)
    expect(stats.strikeouts).toBe(1)
    expect(stats.doubles).toBe(1)
    expect(stats.homeRuns).toBe(1)
    expect(stats.rbis).toBe(1)
  })

  it('should compute batting average', () => {
    const plays: Play[] = [
      makeBatterPlay({ playType: '1B', basesReached: [1] }),
      makeBatterPlay({ playType: 'K', sequenceNumber: 2 }),
      makeBatterPlay({ playType: 'K', sequenceNumber: 3 }),
      makeBatterPlay({ playType: '1B', basesReached: [1], sequenceNumber: 4 }),
    ]
    const stats = computePlayerStats(plays, 1)
    expect(stats.avg).toBeCloseTo(0.500)
  })

  it('should handle zero at-bats', () => {
    const stats = computePlayerStats([], 1)
    expect(stats.atBats).toBe(0)
    expect(stats.avg).toBe(0)
  })

  it('should not count HBP as at-bat', () => {
    const plays: Play[] = [
      makeBatterPlay({ playType: 'HBP', basesReached: [1] }),
    ]
    const stats = computePlayerStats(plays, 1)
    expect(stats.atBats).toBe(0)
  })
})
```

**Step 6: Run stats tests to verify they fail**

```bash
npm run test -- src/engine/__tests__/stats.test.ts
```

Expected: FAIL

**Step 7: Implement stats computation**

Create `src/engine/stats.ts`:

```typescript
import type { Play } from './types'

export interface PlayerStats {
  games: number
  atBats: number
  runs: number
  hits: number
  doubles: number
  triples: number
  homeRuns: number
  rbis: number
  walks: number
  strikeouts: number
  avg: number
  obp: number
  slg: number
}

const HIT_TYPES = ['1B', '2B', '3B', 'HR']
const NON_AB_TYPES = ['BB', 'HBP', 'SAC']

export function computePlayerStats(plays: Play[], batterOrderPosition: number): PlayerStats {
  const playerPlays = plays.filter(
    p => p.batterOrderPosition === batterOrderPosition && p.isAtBat
  )

  const atBats = playerPlays.filter(p => !NON_AB_TYPES.includes(p.playType)).length
  const hits = playerPlays.filter(p => HIT_TYPES.includes(p.playType)).length
  const doubles = playerPlays.filter(p => p.playType === '2B').length
  const triples = playerPlays.filter(p => p.playType === '3B').length
  const homeRuns = playerPlays.filter(p => p.playType === 'HR').length
  const walks = playerPlays.filter(p => p.playType === 'BB').length
  const strikeouts = playerPlays.filter(p => p.playType === 'K' || p.playType === 'KL').length
  const hbp = playerPlays.filter(p => p.playType === 'HBP').length
  const rbis = playerPlays.reduce((sum, p) => sum + p.rbis, 0)
  const runs = playerPlays.reduce((sum, p) => sum + p.runsScoredOnPlay, 0)

  const avg = atBats > 0 ? hits / atBats : 0
  const obpDenom = atBats + walks + hbp
  const obp = obpDenom > 0 ? (hits + walks + hbp) / obpDenom : 0
  const totalBases = playerPlays.reduce((sum, p) => {
    if (p.playType === '1B') return sum + 1
    if (p.playType === '2B') return sum + 2
    if (p.playType === '3B') return sum + 3
    if (p.playType === 'HR') return sum + 4
    return sum
  }, 0)
  const slg = atBats > 0 ? totalBases / atBats : 0

  const gameIds = new Set(playerPlays.map(p => p.gameId))

  return { games: gameIds.size, atBats, runs, hits, doubles, triples, homeRuns, rbis, walks, strikeouts, avg, obp, slg }
}
```

**Step 8: Run all engine tests**

```bash
npm run test -- src/engine/
```

Expected: ALL PASS

**Step 9: Commit**

```bash
git add src/engine/
git commit -m "feat: add notation parser and player stats computation"
```

---

## Phase 3: Database Layer

### Task 5: Dexie database setup with correct schema

**Files:**
- Create: `src/db/database.ts`
- Create: `src/db/__tests__/database.test.ts`

**Step 1: Write failing test**

Create `src/db/__tests__/database.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { db } from '../database'

describe('ScoreKeeperDB', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  afterEach(async () => {
    await db.close()
  })

  it('should have all expected tables', () => {
    const tableNames = db.tables.map(t => t.name)
    expect(tableNames).toContain('teams')
    expect(tableNames).toContain('players')
    expect(tableNames).toContain('games')
    expect(tableNames).toContain('lineups')
    expect(tableNames).toContain('plays')
  })

  it('should insert and retrieve a team', async () => {
    const teamId = await db.teams.add({
      name: 'Mudcats',
      createdAt: new Date(),
    })
    const team = await db.teams.get(teamId)
    expect(team?.name).toBe('Mudcats')
  })

  it('should insert and retrieve a player', async () => {
    const teamId = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
    const playerId = await db.players.add({
      teamId,
      name: 'John Doe',
      jerseyNumber: 23,
      defaultPosition: 'SS',
      createdAt: new Date(),
    })
    const player = await db.players.get(playerId)
    expect(player?.name).toBe('John Doe')
    expect(player?.jerseyNumber).toBe(23)
  })

  it('should query players by teamId', async () => {
    const teamId = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
    await db.players.bulkAdd([
      { teamId, name: 'Player 1', jerseyNumber: 1, defaultPosition: 'P', createdAt: new Date() },
      { teamId, name: 'Player 2', jerseyNumber: 2, defaultPosition: 'C', createdAt: new Date() },
    ])
    const players = await db.players.where('teamId').equals(teamId).toArray()
    expect(players).toHaveLength(2)
  })

  it('should insert and retrieve plays by gameId', async () => {
    await db.plays.add({
      gameId: 1,
      sequenceNumber: 1,
      inning: 1,
      half: 'top',
      batterOrderPosition: 1,
      playType: 'K',
      notation: 'K',
      fieldersInvolved: [],
      basesReached: [],
      runsScoredOnPlay: 0,
      rbis: 0,
      pitches: ['S', 'B', 'S'],
      isAtBat: true,
      timestamp: new Date(),
    })
    const plays = await db.plays.where('gameId').equals(1).toArray()
    expect(plays).toHaveLength(1)
    expect(plays[0].pitches).toEqual(['S', 'B', 'S'])
  })

  it('should store and retrieve lineups with nested battingOrder', async () => {
    await db.lineups.add({
      gameId: 1,
      side: 'us',
      battingOrder: [
        {
          orderPosition: 1,
          playerId: 1,
          playerName: 'John Doe',
          jerseyNumber: 23,
          position: 'SS',
          substitutions: [],
        },
      ],
    })
    const lineups = await db.lineups.where('gameId').equals(1).toArray()
    expect(lineups).toHaveLength(1)
    expect(lineups[0].battingOrder[0].playerName).toBe('John Doe')
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm run test -- src/db/__tests__/database.test.ts
```

Expected: FAIL — `db` does not exist

**Step 3: Implement Dexie database**

Create `src/db/database.ts`:

```typescript
import Dexie from 'dexie'
import type { Table } from 'dexie'
import type { Team, Player, Game, Lineup, Play } from '../engine/types'

export class ScoreKeeperDB extends Dexie {
  teams!: Table<Team>
  players!: Table<Player>
  games!: Table<Game>
  lineups!: Table<Lineup>
  plays!: Table<Play>

  constructor() {
    super('scorekeeper_db')
    this.version(1).stores({
      teams: '++id',
      players: '++id, teamId',
      games: '++id, teamId, code, status',
      lineups: '++id, gameId, [gameId+side]',
      plays: '++id, gameId, sequenceNumber, [gameId+inning+half]',
    })
  }
}

export const db = new ScoreKeeperDB()
```

**Step 4: Run tests**

```bash
npm run test -- src/db/__tests__/database.test.ts
```

Expected: ALL PASS

Note: Dexie tests use `fake-indexeddb` when running in jsdom/node. If tests fail because IndexedDB is not available, install it:

```bash
npm install -D fake-indexeddb
```

And add to `src/test-setup.ts`:

```typescript
import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
```

**Step 5: Commit**

```bash
git add src/db/
git commit -m "feat: add dexie database with teams, players, games, lineups, plays tables"
```

---

### Task 6: Database service — CRUD operations

**Files:**
- Create: `src/db/gameService.ts`
- Create: `src/db/__tests__/gameService.test.ts`

**Step 1: Write failing tests**

Create `src/db/__tests__/gameService.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { db } from '../database'
import {
  createTeam,
  getTeam,
  addPlayer,
  getPlayersForTeam,
  createGame,
  getGame,
  getGamesForTeam,
  saveLineup,
  getLineupsForGame,
  addPlay,
  getPlaysForGame,
  deleteLastPlay,
  updatePlay,
} from '../gameService'

describe('gameService', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  afterEach(async () => {
    await db.close()
  })

  describe('teams', () => {
    it('should create and retrieve a team', async () => {
      const team = await createTeam('Mudcats')
      expect(team.name).toBe('Mudcats')
      expect(team.id).toBeDefined()

      const fetched = await getTeam(team.id!)
      expect(fetched?.name).toBe('Mudcats')
    })
  })

  describe('players', () => {
    it('should add players and retrieve by team', async () => {
      const team = await createTeam('Mudcats')
      await addPlayer(team.id!, 'John Doe', 23, 'SS')
      await addPlayer(team.id!, 'Jane Smith', 7, 'P')

      const players = await getPlayersForTeam(team.id!)
      expect(players).toHaveLength(2)
      expect(players[0].name).toBe('John Doe')
    })
  })

  describe('games', () => {
    it('should create a game with auto-generated code', async () => {
      const team = await createTeam('Mudcats')
      const game = await createGame(team.id!, 'Tigers', 'home')
      expect(game.code).toHaveLength(6)
      expect(game.status).toBe('in_progress')
      expect(game.opponentName).toBe('Tigers')
    })

    it('should list games for a team', async () => {
      const team = await createTeam('Mudcats')
      await createGame(team.id!, 'Tigers', 'home')
      await createGame(team.id!, 'Bears', 'away')

      const games = await getGamesForTeam(team.id!)
      expect(games).toHaveLength(2)
    })
  })

  describe('lineups', () => {
    it('should save and retrieve lineups for a game', async () => {
      const team = await createTeam('Mudcats')
      const game = await createGame(team.id!, 'Tigers', 'home')

      await saveLineup(game.id!, 'us', [
        { orderPosition: 1, playerId: 1, playerName: 'John', jerseyNumber: 23, position: 'SS', substitutions: [] },
      ])

      const lineups = await getLineupsForGame(game.id!)
      expect(lineups).toHaveLength(1)
      expect(lineups[0].side).toBe('us')
      expect(lineups[0].battingOrder).toHaveLength(1)
    })
  })

  describe('plays', () => {
    it('should add plays with auto-incrementing sequence numbers', async () => {
      const team = await createTeam('Mudcats')
      const game = await createGame(team.id!, 'Tigers', 'home')

      const play1 = await addPlay(game.id!, {
        inning: 1,
        half: 'top',
        batterOrderPosition: 1,
        playType: 'K',
        notation: 'K',
        fieldersInvolved: [],
        basesReached: [],
        runsScoredOnPlay: 0,
        rbis: 0,
        pitches: ['S', 'S', 'S'],
        isAtBat: true,
      })
      expect(play1.sequenceNumber).toBe(1)

      const play2 = await addPlay(game.id!, {
        inning: 1,
        half: 'top',
        batterOrderPosition: 2,
        playType: '1B',
        notation: '1B',
        fieldersInvolved: [],
        basesReached: [1],
        runsScoredOnPlay: 0,
        rbis: 0,
        pitches: ['B', 'S', 'F', 'B'],
        isAtBat: true,
      })
      expect(play2.sequenceNumber).toBe(2)

      const plays = await getPlaysForGame(game.id!)
      expect(plays).toHaveLength(2)
    })

    it('should delete the last play (undo)', async () => {
      const team = await createTeam('Mudcats')
      const game = await createGame(team.id!, 'Tigers', 'home')

      await addPlay(game.id!, {
        inning: 1, half: 'top', batterOrderPosition: 1, playType: 'K',
        notation: 'K', fieldersInvolved: [], basesReached: [],
        runsScoredOnPlay: 0, rbis: 0, pitches: [], isAtBat: true,
      })
      await addPlay(game.id!, {
        inning: 1, half: 'top', batterOrderPosition: 2, playType: '1B',
        notation: '1B', fieldersInvolved: [], basesReached: [1],
        runsScoredOnPlay: 0, rbis: 0, pitches: [], isAtBat: true,
      })

      await deleteLastPlay(game.id!)
      const plays = await getPlaysForGame(game.id!)
      expect(plays).toHaveLength(1)
      expect(plays[0].playType).toBe('K')
    })

    it('should update an existing play (edit)', async () => {
      const team = await createTeam('Mudcats')
      const game = await createGame(team.id!, 'Tigers', 'home')

      const play = await addPlay(game.id!, {
        inning: 1, half: 'top', batterOrderPosition: 1, playType: 'K',
        notation: 'K', fieldersInvolved: [], basesReached: [],
        runsScoredOnPlay: 0, rbis: 0, pitches: [], isAtBat: true,
      })

      await updatePlay(play.id!, { playType: '1B', notation: '1B', basesReached: [1] })
      const updated = await db.plays.get(play.id!)
      expect(updated?.playType).toBe('1B')
      expect(updated?.notation).toBe('1B')
    })
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm run test -- src/db/__tests__/gameService.test.ts
```

Expected: FAIL

**Step 3: Implement game service**

Create `src/db/gameService.ts`:

```typescript
import { db } from './database'
import type { Team, Player, Game, Lineup, Play, LineupSlot, HomeOrAway, HalfInning, PlayType, PitchResult } from '../engine/types'

// --- Teams ---

export async function createTeam(name: string): Promise<Team> {
  const team: Team = { name, createdAt: new Date() }
  const id = await db.teams.add(team)
  return { ...team, id }
}

export async function getTeam(id: number): Promise<Team | undefined> {
  return db.teams.get(id)
}

export async function getAllTeams(): Promise<Team[]> {
  return db.teams.toArray()
}

// --- Players ---

export async function addPlayer(
  teamId: number,
  name: string,
  jerseyNumber: number,
  defaultPosition: string,
): Promise<Player> {
  const player: Player = { teamId, name, jerseyNumber, defaultPosition, createdAt: new Date() }
  const id = await db.players.add(player)
  return { ...player, id }
}

export async function getPlayersForTeam(teamId: number): Promise<Player[]> {
  return db.players.where('teamId').equals(teamId).toArray()
}

export async function deletePlayer(id: number): Promise<void> {
  await db.players.delete(id)
}

// --- Games ---

function generateGameCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export async function createGame(
  teamId: number,
  opponentName: string,
  homeOrAway: HomeOrAway,
): Promise<Game> {
  const now = new Date()
  const game: Game = {
    teamId,
    code: generateGameCode(),
    date: now,
    opponentName,
    homeOrAway,
    status: 'in_progress',
    createdAt: now,
    updatedAt: now,
  }
  const id = await db.games.add(game)
  return { ...game, id }
}

export async function getGame(id: number): Promise<Game | undefined> {
  return db.games.get(id)
}

export async function getGamesForTeam(teamId: number): Promise<Game[]> {
  return db.games.where('teamId').equals(teamId).toArray()
}

export async function updateGameStatus(id: number, status: Game['status']): Promise<void> {
  await db.games.update(id, { status, updatedAt: new Date() })
}

// --- Lineups ---

export async function saveLineup(
  gameId: number,
  side: 'us' | 'them',
  battingOrder: LineupSlot[],
): Promise<Lineup> {
  // Upsert: delete existing lineup for this game+side, then add
  const existing = await db.lineups
    .where('[gameId+side]')
    .equals([gameId, side])
    .first()
  if (existing?.id) {
    await db.lineups.delete(existing.id)
  }
  const lineup: Lineup = { gameId, side, battingOrder }
  const id = await db.lineups.add(lineup)
  return { ...lineup, id }
}

export async function getLineupsForGame(gameId: number): Promise<Lineup[]> {
  return db.lineups.where('gameId').equals(gameId).toArray()
}

// --- Plays ---

interface AddPlayInput {
  inning: number
  half: HalfInning
  batterOrderPosition: number
  playType: PlayType
  notation: string
  fieldersInvolved: number[]
  basesReached: number[]
  runsScoredOnPlay: number
  rbis: number
  pitches: PitchResult[]
  isAtBat: boolean
}

export async function addPlay(gameId: number, input: AddPlayInput): Promise<Play> {
  // Get next sequence number
  const existing = await db.plays.where('gameId').equals(gameId).toArray()
  const maxSeq = existing.reduce((max, p) => Math.max(max, p.sequenceNumber), 0)

  const play: Play = {
    gameId,
    sequenceNumber: maxSeq + 1,
    ...input,
    timestamp: new Date(),
  }
  const id = await db.plays.add(play)
  return { ...play, id }
}

export async function getPlaysForGame(gameId: number): Promise<Play[]> {
  return db.plays.where('gameId').equals(gameId).sortBy('sequenceNumber')
}

export async function deleteLastPlay(gameId: number): Promise<void> {
  const plays = await db.plays.where('gameId').equals(gameId).sortBy('sequenceNumber')
  if (plays.length > 0) {
    const last = plays[plays.length - 1]
    if (last.id) {
      await db.plays.delete(last.id)
    }
  }
}

export async function updatePlay(id: number, updates: Partial<Play>): Promise<void> {
  await db.plays.update(id, updates)
}
```

**Step 4: Run tests**

```bash
npm run test -- src/db/__tests__/gameService.test.ts
```

Expected: ALL PASS

**Step 5: Run all tests**

```bash
npm run test
```

Expected: ALL PASS

**Step 6: Commit**

```bash
git add src/db/
git commit -m "feat: add game service with CRUD for teams, players, games, lineups, plays"
```

---

## Phase 4: App Shell & Routing

### Task 7: React Router setup and app layout

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`
- Create: `src/layouts/AppLayout.tsx`
- Create: `src/pages/HomePage.tsx`
- Create: `src/pages/NotFoundPage.tsx`

**Step 1: Create layout component**

Create `src/layouts/AppLayout.tsx`:

```typescript
import { Outlet, Link, useLocation } from 'react-router-dom'

export function AppLayout() {
  const location = useLocation()
  const isGamePage = location.pathname.startsWith('/game/')

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {!isGamePage && (
        <header className="bg-slate-800 text-white px-6 py-4">
          <Link to="/" className="text-xl font-bold tracking-tight">
            Scorekeeper
          </Link>
        </header>
      )}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
```

**Step 2: Create HomePage placeholder**

Create `src/pages/HomePage.tsx`:

```typescript
import { Link } from 'react-router-dom'

export function HomePage() {
  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Scorekeeper</h1>
      <div className="space-y-4">
        <Link
          to="/team"
          className="block w-full text-center bg-slate-700 hover:bg-slate-800 text-white py-3 px-4 rounded-lg font-semibold"
        >
          Manage Team Roster
        </Link>
        <button
          className="block w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg font-semibold"
        >
          Start New Game
        </button>
        <button
          className="block w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-semibold"
        >
          Enter Game Code
        </button>
      </div>
    </div>
  )
}
```

**Step 3: Create NotFoundPage**

Create `src/pages/NotFoundPage.tsx`:

```typescript
import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="max-w-lg mx-auto p-6 text-center">
      <h1 className="text-2xl font-bold text-slate-900 mb-4">Page Not Found</h1>
      <Link to="/" className="text-blue-600 hover:underline">Back to Home</Link>
    </div>
  )
}
```

**Step 4: Update `src/App.tsx` with router**

```typescript
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { HomePage } from './pages/HomePage'
import { NotFoundPage } from './pages/NotFoundPage'

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'team', element: <div>Team page placeholder</div> },
      { path: 'game/:gameId/setup', element: <div>Game setup placeholder</div> },
      { path: 'game/:gameId', element: <div>Game page placeholder</div> },
      { path: 'game/:gameId/stats', element: <div>Game stats placeholder</div> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

function App() {
  return <RouterProvider router={router} />
}

export default App
```

**Step 5: Verify dev server runs**

```bash
npm run dev
```

Expected: App loads at /, shows "Scorekeeper" heading with buttons. Navigation to /team shows placeholder. Back button works.

**Step 6: Commit**

```bash
git add src/
git commit -m "feat: add react-router with app layout and page placeholders"
```

---

### Task 8: Game context provider — connects engine + Dexie + React

**Files:**
- Create: `src/contexts/GameContext.tsx`
- Create: `src/contexts/__tests__/GameContext.test.tsx`

**Step 1: Write failing test**

Create `src/contexts/__tests__/GameContext.test.tsx`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { GameProvider, useGame } from '../GameContext'
import { db } from '../../db/database'
import { createTeam, addPlayer, createGame, saveLineup } from '../../db/gameService'

function wrapper({ children }: { children: ReactNode }) {
  return <GameProvider>{children}</GameProvider>
}

describe('GameContext', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  afterEach(async () => {
    await db.close()
  })

  it('should start with null game state', () => {
    const { result } = renderHook(() => useGame(), { wrapper })
    expect(result.current.game).toBeNull()
    expect(result.current.snapshot).toBeNull()
  })

  it('should load a game and compute snapshot', async () => {
    // Set up test data
    const team = await createTeam('Mudcats')
    await addPlayer(team.id!, 'Player 1', 1, 'P')
    const game = await createGame(team.id!, 'Tigers', 'home')
    await saveLineup(game.id!, 'us', [
      { orderPosition: 1, playerId: 1, playerName: 'Player 1', jerseyNumber: 1, position: 'P', substitutions: [] },
    ])
    await saveLineup(game.id!, 'them', [
      { orderPosition: 1, playerId: null, playerName: 'Opp 1', jerseyNumber: 10, position: 'P', substitutions: [] },
    ])

    const { result } = renderHook(() => useGame(), { wrapper })

    await act(async () => {
      await result.current.loadGame(game.id!)
    })

    expect(result.current.game).not.toBeNull()
    expect(result.current.game?.id).toBe(game.id)
    expect(result.current.snapshot).not.toBeNull()
    expect(result.current.snapshot?.inning).toBe(1)
    expect(result.current.snapshot?.half).toBe('top')
  })

  it('should record a play and update snapshot', async () => {
    const team = await createTeam('Mudcats')
    const game = await createGame(team.id!, 'Tigers', 'home')
    await saveLineup(game.id!, 'us', [
      { orderPosition: 1, playerId: 1, playerName: 'P1', jerseyNumber: 1, position: 'P', substitutions: [] },
      { orderPosition: 2, playerId: 2, playerName: 'P2', jerseyNumber: 2, position: 'C', substitutions: [] },
    ])
    await saveLineup(game.id!, 'them', [
      { orderPosition: 1, playerId: null, playerName: 'O1', jerseyNumber: 10, position: 'P', substitutions: [] },
    ])

    const { result } = renderHook(() => useGame(), { wrapper })

    await act(async () => {
      await result.current.loadGame(game.id!)
    })

    await act(async () => {
      await result.current.recordPlay({
        inning: 1,
        half: 'top',
        batterOrderPosition: 1,
        playType: 'K',
        notation: 'K',
        fieldersInvolved: [],
        basesReached: [],
        runsScoredOnPlay: 0,
        rbis: 0,
        pitches: ['S', 'S', 'S'],
        isAtBat: true,
      })
    })

    expect(result.current.snapshot?.outs).toBe(1)
    expect(result.current.snapshot?.currentBatterUs).toBe(2)
    expect(result.current.plays).toHaveLength(1)
  })

  it('should undo the last play', async () => {
    const team = await createTeam('Mudcats')
    const game = await createGame(team.id!, 'Tigers', 'home')
    await saveLineup(game.id!, 'us', [
      { orderPosition: 1, playerId: 1, playerName: 'P1', jerseyNumber: 1, position: 'P', substitutions: [] },
    ])
    await saveLineup(game.id!, 'them', [
      { orderPosition: 1, playerId: null, playerName: 'O1', jerseyNumber: 10, position: 'P', substitutions: [] },
    ])

    const { result } = renderHook(() => useGame(), { wrapper })

    await act(async () => {
      await result.current.loadGame(game.id!)
    })

    await act(async () => {
      await result.current.recordPlay({
        inning: 1, half: 'top', batterOrderPosition: 1, playType: 'K',
        notation: 'K', fieldersInvolved: [], basesReached: [],
        runsScoredOnPlay: 0, rbis: 0, pitches: [], isAtBat: true,
      })
    })

    expect(result.current.snapshot?.outs).toBe(1)

    await act(async () => {
      await result.current.undoLastPlay()
    })

    expect(result.current.snapshot?.outs).toBe(0)
    expect(result.current.plays).toHaveLength(0)
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm run test -- src/contexts/__tests__/GameContext.test.tsx
```

Expected: FAIL

**Step 3: Implement GameContext**

Create `src/contexts/GameContext.tsx`:

```typescript
import { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { Game, Lineup, Play, GameSnapshot, HalfInning, PlayType, PitchResult } from '../engine/types'
import { replayGame } from '../engine/engine'
import { getGame, getLineupsForGame, getPlaysForGame, addPlay, deleteLastPlay, updatePlay } from '../db/gameService'

interface RecordPlayInput {
  inning: number
  half: HalfInning
  batterOrderPosition: number
  playType: PlayType
  notation: string
  fieldersInvolved: number[]
  basesReached: number[]
  runsScoredOnPlay: number
  rbis: number
  pitches: PitchResult[]
  isAtBat: boolean
}

interface GameContextValue {
  game: Game | null
  lineupUs: Lineup | null
  lineupThem: Lineup | null
  plays: Play[]
  snapshot: GameSnapshot | null
  loadGame: (gameId: number) => Promise<void>
  recordPlay: (input: RecordPlayInput) => Promise<void>
  undoLastPlay: () => Promise<void>
  editPlay: (playId: number, updates: Partial<Play>) => Promise<void>
  clearGame: () => void
}

const GameContext = createContext<GameContextValue | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  const [game, setGame] = useState<Game | null>(null)
  const [lineupUs, setLineupUs] = useState<Lineup | null>(null)
  const [lineupThem, setLineupThem] = useState<Lineup | null>(null)
  const [plays, setPlays] = useState<Play[]>([])
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null)

  const recompute = useCallback((currentPlays: Play[], lusVal: Lineup | null, lthVal: Lineup | null) => {
    if (!lusVal || !lthVal) return
    const snap = replayGame(currentPlays, lusVal, lthVal)
    setSnapshot(snap)
  }, [])

  const loadGame = useCallback(async (gameId: number) => {
    const g = await getGame(gameId)
    if (!g) return

    const lineups = await getLineupsForGame(gameId)
    const lus = lineups.find(l => l.side === 'us') ?? null
    const lth = lineups.find(l => l.side === 'them') ?? null
    const p = await getPlaysForGame(gameId)

    setGame(g)
    setLineupUs(lus)
    setLineupThem(lth)
    setPlays(p)

    if (lus && lth) {
      const snap = replayGame(p, lus, lth)
      setSnapshot(snap)
    }
  }, [])

  const recordPlay = useCallback(async (input: RecordPlayInput) => {
    if (!game?.id) return
    const newPlay = await addPlay(game.id, input)
    const newPlays = [...plays, newPlay]
    setPlays(newPlays)
    recompute(newPlays, lineupUs, lineupThem)
  }, [game, plays, lineupUs, lineupThem, recompute])

  const undoLastPlay = useCallback(async () => {
    if (!game?.id) return
    await deleteLastPlay(game.id)
    const newPlays = plays.slice(0, -1)
    setPlays(newPlays)
    recompute(newPlays, lineupUs, lineupThem)
  }, [game, plays, lineupUs, lineupThem, recompute])

  const editPlay = useCallback(async (playId: number, updates: Partial<Play>) => {
    if (!game?.id) return
    await updatePlay(playId, updates)
    const refreshed = await getPlaysForGame(game.id)
    setPlays(refreshed)
    recompute(refreshed, lineupUs, lineupThem)
  }, [game, lineupUs, lineupThem, recompute])

  const clearGame = useCallback(() => {
    setGame(null)
    setLineupUs(null)
    setLineupThem(null)
    setPlays([])
    setSnapshot(null)
  }, [])

  return (
    <GameContext.Provider value={{
      game, lineupUs, lineupThem, plays, snapshot,
      loadGame, recordPlay, undoLastPlay, editPlay, clearGame,
    }}>
      {children}
    </GameContext.Provider>
  )
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within a GameProvider')
  return ctx
}
```

**Step 4: Run tests**

```bash
npm run test -- src/contexts/__tests__/GameContext.test.tsx
```

Expected: ALL PASS

**Step 5: Wire GameProvider into App**

Update `src/App.tsx` — wrap RouterProvider with GameProvider:

```typescript
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { GameProvider } from './contexts/GameContext'
import { AppLayout } from './layouts/AppLayout'
import { HomePage } from './pages/HomePage'
import { NotFoundPage } from './pages/NotFoundPage'

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'team', element: <div>Team page placeholder</div> },
      { path: 'game/:gameId/setup', element: <div>Game setup placeholder</div> },
      { path: 'game/:gameId', element: <div>Game page placeholder</div> },
      { path: 'game/:gameId/stats', element: <div>Game stats placeholder</div> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

function App() {
  return (
    <GameProvider>
      <RouterProvider router={router} />
    </GameProvider>
  )
}

export default App
```

**Step 6: Commit**

```bash
git add src/
git commit -m "feat: add GameContext provider connecting engine, dexie, and react"
```

---

## Phase 5: Team Management & Pre-Game Setup

### Task 9: Team roster management page

**Files:**
- Create: `src/pages/TeamPage.tsx`
- Create: `src/pages/__tests__/TeamPage.test.tsx`

**Step 1: Write failing test**

Create `src/pages/__tests__/TeamPage.test.tsx`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { TeamPage } from '../TeamPage'
import { db } from '../../db/database'

function renderWithRouter() {
  return render(
    <MemoryRouter>
      <TeamPage />
    </MemoryRouter>
  )
}

describe('TeamPage', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  afterEach(async () => {
    await db.close()
  })

  it('should show create team form when no team exists', async () => {
    renderWithRouter()
    await waitFor(() => {
      expect(screen.getByText(/create team/i)).toBeInTheDocument()
    })
  })

  it('should create a team', async () => {
    const user = userEvent.setup()
    renderWithRouter()

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/team name/i)).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText(/team name/i), 'Mudcats')
    await user.click(screen.getByRole('button', { name: /create team/i }))

    await waitFor(() => {
      expect(screen.getByText('Mudcats')).toBeInTheDocument()
    })
  })

  it('should add a player to the roster', async () => {
    const user = userEvent.setup()
    // Pre-create a team
    await db.teams.add({ name: 'Mudcats', createdAt: new Date() })

    renderWithRouter()

    await waitFor(() => {
      expect(screen.getByText('Mudcats')).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText(/player name/i), 'John Doe')
    await user.type(screen.getByPlaceholderText(/jersey/i), '23')
    await user.type(screen.getByPlaceholderText(/position/i), 'SS')
    await user.click(screen.getByRole('button', { name: /add player/i }))

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('23')).toBeInTheDocument()
    })
  })

  it('should delete a player from the roster', async () => {
    const user = userEvent.setup()
    const teamId = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
    await db.players.add({ teamId, name: 'John Doe', jerseyNumber: 23, defaultPosition: 'SS', createdAt: new Date() })

    renderWithRouter()

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /delete/i }))

    await waitFor(() => {
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
    })
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm run test -- src/pages/__tests__/TeamPage.test.tsx
```

Expected: FAIL

**Step 3: Implement TeamPage**

Create `src/pages/TeamPage.tsx`:

```typescript
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { Team, Player } from '../engine/types'
import { createTeam, getAllTeams, addPlayer, getPlayersForTeam, deletePlayer } from '../db/gameService'

export function TeamPage() {
  const [team, setTeam] = useState<Team | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)

  // Create team form
  const [teamName, setTeamName] = useState('')

  // Add player form
  const [playerName, setPlayerName] = useState('')
  const [jerseyNumber, setJerseyNumber] = useState('')
  const [position, setPosition] = useState('')

  useEffect(() => {
    async function load() {
      const teams = await getAllTeams()
      if (teams.length > 0) {
        setTeam(teams[0])
        const p = await getPlayersForTeam(teams[0].id!)
        setPlayers(p)
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleCreateTeam = async () => {
    if (!teamName.trim()) return
    const t = await createTeam(teamName.trim())
    setTeam(t)
    setTeamName('')
  }

  const handleAddPlayer = async () => {
    if (!team?.id || !playerName.trim() || !jerseyNumber.trim()) return
    const p = await addPlayer(team.id, playerName.trim(), parseInt(jerseyNumber), position.trim() || 'UT')
    setPlayers([...players, p])
    setPlayerName('')
    setJerseyNumber('')
    setPosition('')
  }

  const handleDeletePlayer = async (id: number) => {
    await deletePlayer(id)
    setPlayers(players.filter(p => p.id !== id))
  }

  if (loading) return <div className="p-6">Loading...</div>

  if (!team) {
    return (
      <div className="max-w-lg mx-auto p-6">
        <Link to="/" className="text-blue-600 hover:underline text-sm">&larr; Back</Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-4 mb-6">Create Team</h1>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Team name"
            value={teamName}
            onChange={e => setTeamName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateTeam()}
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2"
          />
          <button
            onClick={handleCreateTeam}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold"
          >
            Create Team
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Link to="/" className="text-blue-600 hover:underline text-sm">&larr; Back</Link>
      <h1 className="text-2xl font-bold text-slate-900 mt-4 mb-2">{team.name}</h1>
      <p className="text-slate-500 mb-6">{players.length} player{players.length !== 1 ? 's' : ''}</p>

      {/* Add player form */}
      <div className="border border-slate-200 rounded-lg p-4 mb-6 bg-white">
        <h2 className="text-lg font-semibold text-slate-800 mb-3">Add Player</h2>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Player name"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="text"
            inputMode="numeric"
            placeholder="Jersey #"
            value={jerseyNumber}
            onChange={e => setJerseyNumber(e.target.value)}
            className="w-20 border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="Position"
            value={position}
            onChange={e => setPosition(e.target.value)}
            className="w-20 border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={handleAddPlayer}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold text-sm"
          >
            Add Player
          </button>
        </div>
      </div>

      {/* Roster table */}
      {players.length > 0 && (
        <table className="w-full border-collapse bg-white rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-slate-100 text-left text-sm text-slate-600">
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Pos</th>
              <th className="px-4 py-2 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {players.map(p => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-4 py-2 text-sm font-mono">{p.jerseyNumber}</td>
                <td className="px-4 py-2 text-sm font-semibold">{p.name}</td>
                <td className="px-4 py-2 text-sm text-slate-600">{p.defaultPosition}</td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => handleDeletePlayer(p.id!)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
```

**Step 4: Wire into router**

Update the `team` route in `src/App.tsx`:

```typescript
// Replace: { path: 'team', element: <div>Team page placeholder</div> },
// With:
import { TeamPage } from './pages/TeamPage'
// ...
{ path: 'team', element: <TeamPage /> },
```

**Step 5: Run tests**

```bash
npm run test -- src/pages/__tests__/TeamPage.test.tsx
```

Expected: ALL PASS

**Step 6: Commit**

```bash
git add src/
git commit -m "feat: add team roster management page"
```

---

### Task 10: Pre-game setup page

**Files:**
- Create: `src/pages/GameSetupPage.tsx`
- Create: `src/pages/__tests__/GameSetupPage.test.tsx`

**Step 1: Write failing test**

Create `src/pages/__tests__/GameSetupPage.test.tsx`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { GameProvider } from '../../contexts/GameContext'
import { GameSetupPage } from '../GameSetupPage'
import { db } from '../../db/database'

async function seedTeamAndGame() {
  const teamId = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
  await db.players.bulkAdd([
    { teamId, name: 'Alice', jerseyNumber: 1, defaultPosition: 'P', createdAt: new Date() },
    { teamId, name: 'Bob', jerseyNumber: 2, defaultPosition: 'C', createdAt: new Date() },
    { teamId, name: 'Charlie', jerseyNumber: 3, defaultPosition: '1B', createdAt: new Date() },
  ])
  const gameId = await db.games.add({
    teamId,
    code: 'TEST01',
    date: new Date(),
    opponentName: 'Tigers',
    homeOrAway: 'home',
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

  it('should display team players for lineup selection', async () => {
    const gameId = await seedTeamAndGame()
    renderSetup(gameId)

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.getByText('Bob')).toBeInTheDocument()
      expect(screen.getByText('Charlie')).toBeInTheDocument()
    })
  })

  it('should show opponent lineup entry', async () => {
    const gameId = await seedTeamAndGame()
    renderSetup(gameId)

    await waitFor(() => {
      expect(screen.getByText(/opponent lineup/i)).toBeInTheDocument()
    })
  })

  it('should allow adding an opponent player', async () => {
    const user = userEvent.setup()
    const gameId = await seedTeamAndGame()
    renderSetup(gameId)

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/opponent name/i)).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText(/opponent name/i), 'Smith')
    await user.type(screen.getByPlaceholderText(/opp #/i), '15')
    await user.type(screen.getByPlaceholderText(/opp pos/i), 'SS')
    await user.click(screen.getByRole('button', { name: /add opponent/i }))

    await waitFor(() => {
      expect(screen.getByText('Smith')).toBeInTheDocument()
    })
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm run test -- src/pages/__tests__/GameSetupPage.test.tsx
```

Expected: FAIL

**Step 3: Implement GameSetupPage**

Create `src/pages/GameSetupPage.tsx`:

```typescript
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Player, LineupSlot } from '../engine/types'
import { useGame } from '../contexts/GameContext'
import { getGame, getPlayersForTeam, saveLineup } from '../db/gameService'

interface OpponentPlayer {
  name: string
  jerseyNumber: number
  position: string
}

export function GameSetupPage() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const { loadGame } = useGame()

  const [players, setPlayers] = useState<Player[]>([])
  const [battingOrder, setBattingOrder] = useState<number[]>([]) // player ids in order
  const [opponents, setOpponents] = useState<OpponentPlayer[]>([])
  const [loading, setLoading] = useState(true)

  // Opponent form
  const [oppName, setOppName] = useState('')
  const [oppNumber, setOppNumber] = useState('')
  const [oppPosition, setOppPosition] = useState('')

  const gId = parseInt(gameId ?? '0')

  useEffect(() => {
    async function load() {
      const game = await getGame(gId)
      if (!game) return
      const p = await getPlayersForTeam(game.teamId)
      setPlayers(p)
      // Default batting order: roster order
      setBattingOrder(p.map(pl => pl.id!))
      setLoading(false)
    }
    load()
  }, [gId])

  const handleAddOpponent = () => {
    if (!oppName.trim() || !oppNumber.trim()) return
    setOpponents([...opponents, {
      name: oppName.trim(),
      jerseyNumber: parseInt(oppNumber),
      position: oppPosition.trim() || 'UT',
    }])
    setOppName('')
    setOppNumber('')
    setOppPosition('')
  }

  const handleMoveUp = (index: number) => {
    if (index === 0) return
    const newOrder = [...battingOrder]
    const temp = newOrder[index - 1]
    newOrder[index - 1] = newOrder[index]
    newOrder[index] = temp
    setBattingOrder(newOrder)
  }

  const handleMoveDown = (index: number) => {
    if (index >= battingOrder.length - 1) return
    const newOrder = [...battingOrder]
    const temp = newOrder[index + 1]
    newOrder[index + 1] = newOrder[index]
    newOrder[index] = temp
    setBattingOrder(newOrder)
  }

  const handleStartGame = async () => {
    // Build our lineup
    const ourSlots: LineupSlot[] = battingOrder.map((playerId, i) => {
      const player = players.find(p => p.id === playerId)!
      return {
        orderPosition: i + 1,
        playerId: player.id!,
        playerName: player.name,
        jerseyNumber: player.jerseyNumber,
        position: player.defaultPosition,
        substitutions: [],
      }
    })

    // Build opponent lineup
    const oppSlots: LineupSlot[] = opponents.map((opp, i) => ({
      orderPosition: i + 1,
      playerId: null,
      playerName: opp.name,
      jerseyNumber: opp.jerseyNumber,
      position: opp.position,
      substitutions: [],
    }))

    await saveLineup(gId, 'us', ourSlots)
    await saveLineup(gId, 'them', oppSlots)
    await loadGame(gId)
    navigate(`/game/${gId}`)
  }

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Game Setup</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Our batting order */}
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Our Batting Order</h2>
          <div className="space-y-1">
            {battingOrder.map((playerId, index) => {
              const player = players.find(p => p.id === playerId)
              if (!player) return null
              return (
                <div key={playerId} className="flex items-center gap-2 bg-white border border-slate-200 rounded px-3 py-2">
                  <span className="text-sm font-mono text-slate-400 w-6">{index + 1}.</span>
                  <span className="text-sm font-semibold flex-1">{player.name}</span>
                  <span className="text-xs text-slate-500">#{player.jerseyNumber}</span>
                  <span className="text-xs text-slate-500 w-8">{player.defaultPosition}</span>
                  <button onClick={() => handleMoveUp(index)} className="text-slate-400 hover:text-slate-700 text-xs px-1">&uarr;</button>
                  <button onClick={() => handleMoveDown(index)} className="text-slate-400 hover:text-slate-700 text-xs px-1">&darr;</button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Opponent lineup */}
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Opponent Lineup</h2>

          <div className="flex gap-2 mb-3">
            <input
              type="text"
              placeholder="Opponent name"
              value={oppName}
              onChange={e => setOppName(e.target.value)}
              className="flex-1 border border-slate-300 rounded px-2 py-1.5 text-sm"
            />
            <input
              type="text"
              inputMode="numeric"
              placeholder="Opp #"
              value={oppNumber}
              onChange={e => setOppNumber(e.target.value)}
              className="w-16 border border-slate-300 rounded px-2 py-1.5 text-sm"
            />
            <input
              type="text"
              placeholder="Opp pos"
              value={oppPosition}
              onChange={e => setOppPosition(e.target.value)}
              className="w-16 border border-slate-300 rounded px-2 py-1.5 text-sm"
            />
            <button
              onClick={handleAddOpponent}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm font-semibold"
            >
              Add Opponent
            </button>
          </div>

          <div className="space-y-1">
            {opponents.map((opp, index) => (
              <div key={index} className="flex items-center gap-2 bg-white border border-slate-200 rounded px-3 py-2">
                <span className="text-sm font-mono text-slate-400 w-6">{index + 1}.</span>
                <span className="text-sm font-semibold flex-1">{opp.name}</span>
                <span className="text-xs text-slate-500">#{opp.jerseyNumber}</span>
                <span className="text-xs text-slate-500">{opp.position}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Start game button */}
      <div className="mt-8">
        <button
          onClick={handleStartGame}
          disabled={battingOrder.length === 0 || opponents.length === 0}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-bold text-lg"
        >
          Start Game
        </button>
      </div>
    </div>
  )
}
```

**Step 4: Wire into router**

Update the `game/:gameId/setup` route in `src/App.tsx`:

```typescript
import { GameSetupPage } from './pages/GameSetupPage'
// ...
{ path: 'game/:gameId/setup', element: <GameSetupPage /> },
```

**Step 5: Run tests**

```bash
npm run test -- src/pages/__tests__/GameSetupPage.test.tsx
```

Expected: ALL PASS

**Step 6: Commit**

```bash
git add src/
git commit -m "feat: add pre-game setup page with batting order and opponent lineup"
```

---

### Task 11: Wire HomePage to create games and navigate

**Files:**
- Modify: `src/pages/HomePage.tsx`
- Create: `src/pages/__tests__/HomePage.test.tsx`

**Step 1: Write failing test**

Create `src/pages/__tests__/HomePage.test.tsx`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { GameProvider } from '../../contexts/GameContext'
import { HomePage } from '../HomePage'
import { db } from '../../db/database'

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <GameProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/team" element={<div>Team Page</div>} />
          <Route path="/game/:gameId/setup" element={<div>Setup Page</div>} />
        </Routes>
      </GameProvider>
    </MemoryRouter>
  )
}

describe('HomePage', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  afterEach(async () => {
    await db.close()
  })

  it('should show new game dialog when clicking start new game', async () => {
    const user = userEvent.setup()
    await db.teams.add({ name: 'Mudcats', createdAt: new Date() })

    renderHome()

    await user.click(screen.getByRole('button', { name: /start new game/i }))

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/opponent/i)).toBeInTheDocument()
    })
  })

  it('should redirect to team page if no team exists when starting game', async () => {
    const user = userEvent.setup()
    renderHome()

    await user.click(screen.getByRole('button', { name: /start new game/i }))

    await waitFor(() => {
      expect(screen.getByText('Team Page')).toBeInTheDocument()
    })
  })

  it('should show in-progress games', async () => {
    const teamId = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
    await db.games.add({
      teamId, code: 'ABC123', date: new Date(), opponentName: 'Tigers',
      homeOrAway: 'home', status: 'in_progress', createdAt: new Date(), updatedAt: new Date(),
    })

    renderHome()

    await waitFor(() => {
      expect(screen.getByText(/tigers/i)).toBeInTheDocument()
    })
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm run test -- src/pages/__tests__/HomePage.test.tsx
```

Expected: FAIL

**Step 3: Update HomePage with real functionality**

Replace `src/pages/HomePage.tsx`:

```typescript
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Game, Team } from '../engine/types'
import { getAllTeams, getGamesForTeam, createGame } from '../db/gameService'

export function HomePage() {
  const navigate = useNavigate()
  const [team, setTeam] = useState<Team | null>(null)
  const [games, setGames] = useState<Game[]>([])
  const [showNewGame, setShowNewGame] = useState(false)
  const [opponentName, setOpponentName] = useState('')
  const [homeOrAway, setHomeOrAway] = useState<'home' | 'away'>('home')

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

  const handleStartNewGame = async () => {
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

  const inProgressGames = games.filter(g => g.status === 'in_progress')
  const completedGames = games.filter(g => g.status === 'completed')

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
              <Link
                key={g.id}
                to={`/game/${g.id}`}
                className="block bg-white border border-slate-200 rounded-lg px-4 py-3 hover:bg-slate-50"
              >
                <div className="font-semibold text-slate-900">vs {g.opponentName}</div>
                <div className="text-xs text-slate-500">
                  {g.homeOrAway === 'home' ? 'Home' : 'Away'} &middot; {g.code}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Completed games */}
      {completedGames.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Completed</h2>
          <div className="space-y-2">
            {completedGames.map(g => (
              <Link
                key={g.id}
                to={`/game/${g.id}/stats`}
                className="block bg-white border border-slate-200 rounded-lg px-4 py-3 hover:bg-slate-50"
              >
                <div className="font-semibold text-slate-900">vs {g.opponentName}</div>
                <div className="text-xs text-slate-500">
                  {g.finalScoreUs ?? '?'} - {g.finalScoreThem ?? '?'}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 4: Run tests**

```bash
npm run test -- src/pages/__tests__/HomePage.test.tsx
```

Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/
git commit -m "feat: wire homepage with game creation, in-progress games, and navigation"
```

---

## Phase 6: Scoresheet UI Components

### Task 12: Diamond SVG component

**Files:**
- Create: `src/components/Diamond.tsx`
- Create: `src/components/__tests__/Diamond.test.tsx`

**Step 1: Write failing test**

Create `src/components/__tests__/Diamond.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Diamond } from '../Diamond'

describe('Diamond', () => {
  it('should render an SVG element', () => {
    const { container } = render(<Diamond basesReached={[]} />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('should render base path for a single', () => {
    const { container } = render(<Diamond basesReached={[1]} />)
    const paths = container.querySelectorAll('[data-testid="base-path"]')
    expect(paths.length).toBeGreaterThan(0)
  })

  it('should render filled diamond for home run', () => {
    const { container } = render(<Diamond basesReached={[1, 2, 3, 4]} runScored />)
    const filled = container.querySelector('[data-testid="run-scored"]')
    expect(filled).toBeInTheDocument()
  })

  it('should display notation text', () => {
    const { container } = render(<Diamond basesReached={[1]} notation="1B" />)
    expect(container.textContent).toContain('1B')
  })

  it('should render pitch dots', () => {
    const { container } = render(
      <Diamond basesReached={[]} pitches={['B', 'S', 'F', 'B', 'S']} />
    )
    const dots = container.querySelectorAll('[data-testid="pitch-dot"]')
    expect(dots.length).toBe(5)
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm run test -- src/components/__tests__/Diamond.test.tsx
```

Expected: FAIL

**Step 3: Implement Diamond component**

Create `src/components/Diamond.tsx`:

```typescript
import type { PitchResult } from '../engine/types'

interface DiamondProps {
  basesReached: number[]
  runScored?: boolean
  notation?: string
  pitches?: PitchResult[]
  size?: number
}

export function Diamond({
  basesReached,
  runScored = false,
  notation = '',
  pitches = [],
  size = 60,
}: DiamondProps) {
  // Diamond coordinates (in a 100x100 viewBox)
  const home = { x: 50, y: 88 }
  const first = { x: 85, y: 50 }
  const second = { x: 50, y: 12 }
  const third = { x: 15, y: 50 }

  const bases = [home, first, second, third, home]
  const hasBase = (n: number) => basesReached.includes(n)

  // Build path segments for bases reached
  const segments: string[] = []
  if (hasBase(1)) segments.push(`M ${home.x} ${home.y} L ${first.x} ${first.y}`)
  if (hasBase(2)) segments.push(`M ${first.x} ${first.y} L ${second.x} ${second.y}`)
  if (hasBase(3)) segments.push(`M ${second.x} ${second.y} L ${third.x} ${third.y}`)
  if (hasBase(4)) segments.push(`M ${third.x} ${third.y} L ${home.x} ${home.y}`)

  // Pitch dot colors
  const pitchColor = (p: PitchResult) => {
    if (p === 'B') return '#3b82f6' // blue
    if (p === 'S') return '#ef4444' // red
    return '#f59e0b' // amber for foul
  }

  return (
    <div className="flex flex-col items-center" style={{ width: size, height: size + 20 }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className="block"
      >
        {/* Diamond outline */}
        <polygon
          points={`${home.x},${home.y} ${first.x},${first.y} ${second.x},${second.y} ${third.x},${third.y}`}
          fill="none"
          stroke="#94a3b8"
          strokeWidth="1"
        />

        {/* Run scored: filled diamond */}
        {runScored && (
          <polygon
            data-testid="run-scored"
            points={`${home.x},${home.y} ${first.x},${first.y} ${second.x},${second.y} ${third.x},${third.y}`}
            fill="#fbbf24"
            fillOpacity="0.4"
            stroke="#f59e0b"
            strokeWidth="1.5"
          />
        )}

        {/* Base runner paths */}
        {segments.map((d, i) => (
          <path
            key={i}
            data-testid="base-path"
            d={d}
            fill="none"
            stroke="#1e40af"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        ))}

        {/* Base markers */}
        {[first, second, third].map((base, i) => (
          <rect
            key={i}
            x={base.x - 3}
            y={base.y - 3}
            width={6}
            height={6}
            transform={`rotate(45 ${base.x} ${base.y})`}
            fill={hasBase(i + 1) ? '#1e40af' : '#e2e8f0'}
            stroke="#94a3b8"
            strokeWidth="0.5"
          />
        ))}

        {/* Notation text */}
        {notation && (
          <text
            x="50"
            y="54"
            textAnchor="middle"
            className="text-[10px] font-bold"
            fill="#1e293b"
          >
            {notation}
          </text>
        )}
      </svg>

      {/* Pitch tracking dots below diamond */}
      {pitches.length > 0 && (
        <div className="flex gap-0.5 mt-0.5">
          {pitches.map((p, i) => (
            <div
              key={i}
              data-testid="pitch-dot"
              className="rounded-full"
              style={{
                width: 4,
                height: 4,
                backgroundColor: pitchColor(p),
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 4: Run tests**

```bash
npm run test -- src/components/__tests__/Diamond.test.tsx
```

Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/components/
git commit -m "feat: add Diamond SVG component with baserunner paths and pitch dots"
```

---

### Task 13: AtBatCell component (Glover's-style scoresheet cell)

**Files:**
- Create: `src/components/AtBatCell.tsx`
- Create: `src/components/__tests__/AtBatCell.test.tsx`

**Step 1: Write failing test**

Create `src/components/__tests__/AtBatCell.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AtBatCell } from '../AtBatCell'

describe('AtBatCell', () => {
  it('should render empty cell', () => {
    const { container } = render(
      <AtBatCell play={null} isCurrentBatter={false} onClick={() => {}} />
    )
    expect(container.querySelector('[data-testid="atbat-cell"]')).toBeInTheDocument()
  })

  it('should render diamond with notation when play exists', () => {
    const { container } = render(
      <AtBatCell
        play={{
          playType: '1B',
          notation: '1B',
          basesReached: [1],
          runsScoredOnPlay: 0,
          pitches: ['B', 'S'],
        }}
        isCurrentBatter={false}
        onClick={() => {}}
      />
    )
    expect(container.textContent).toContain('1B')
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('should highlight current batter cell', () => {
    const { container } = render(
      <AtBatCell play={null} isCurrentBatter={true} onClick={() => {}} />
    )
    expect(container.querySelector('[data-testid="atbat-cell"]')?.className).toContain('ring')
  })

  it('should call onClick when clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<AtBatCell play={null} isCurrentBatter={false} onClick={onClick} />)

    await user.click(screen.getByTestId('atbat-cell'))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm run test -- src/components/__tests__/AtBatCell.test.tsx
```

Expected: FAIL

**Step 3: Implement AtBatCell**

Create `src/components/AtBatCell.tsx`:

```typescript
import { Diamond } from './Diamond'
import type { PitchResult } from '../engine/types'

interface CellPlayData {
  playType: string
  notation: string
  basesReached: number[]
  runsScoredOnPlay: number
  pitches: PitchResult[]
}

interface AtBatCellProps {
  play: CellPlayData | null
  isCurrentBatter: boolean
  onClick: () => void
}

export function AtBatCell({ play, isCurrentBatter, onClick }: AtBatCellProps) {
  return (
    <div
      data-testid="atbat-cell"
      onClick={onClick}
      className={`
        min-h-[72px] min-w-[72px] flex items-center justify-center cursor-pointer
        border border-slate-200 transition-colors
        ${isCurrentBatter ? 'bg-amber-50 ring-2 ring-amber-400 ring-inset' : 'bg-white hover:bg-slate-50'}
      `}
    >
      {play ? (
        <Diamond
          basesReached={play.basesReached}
          runScored={play.runsScoredOnPlay > 0}
          notation={play.notation}
          pitches={play.pitches}
          size={56}
        />
      ) : null}
    </div>
  )
}
```

**Step 4: Run tests**

```bash
npm run test -- src/components/__tests__/AtBatCell.test.tsx
```

Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/components/
git commit -m "feat: add AtBatCell component for scoresheet grid cells"
```

---

### Task 14: ScoreSummary top bar

**Files:**
- Create: `src/components/ScoreSummary.tsx`
- Create: `src/components/__tests__/ScoreSummary.test.tsx`

**Step 1: Write failing test**

Create `src/components/__tests__/ScoreSummary.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScoreSummary } from '../ScoreSummary'

describe('ScoreSummary', () => {
  it('should display inning and half', () => {
    render(
      <ScoreSummary inning={3} half="top" outs={2} scoreUs={4} scoreThem={1} pitchCount={47} pitcherName="Smith" />
    )
    expect(screen.getByText(/top 3/i)).toBeInTheDocument()
  })

  it('should display score', () => {
    render(
      <ScoreSummary inning={1} half="top" outs={0} scoreUs={4} scoreThem={1} pitchCount={0} pitcherName="Smith" />
    )
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('should display outs as visual indicators', () => {
    const { container } = render(
      <ScoreSummary inning={1} half="top" outs={2} scoreUs={0} scoreThem={0} pitchCount={0} pitcherName="Smith" />
    )
    const filledOuts = container.querySelectorAll('[data-testid="out-filled"]')
    expect(filledOuts.length).toBe(2)
  })

  it('should display pitcher pitch count', () => {
    render(
      <ScoreSummary inning={1} half="top" outs={0} scoreUs={0} scoreThem={0} pitchCount={47} pitcherName="Smith" />
    )
    expect(screen.getByText(/47/)).toBeInTheDocument()
    expect(screen.getByText(/smith/i)).toBeInTheDocument()
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm run test -- src/components/__tests__/ScoreSummary.test.tsx
```

Expected: FAIL

**Step 3: Implement ScoreSummary**

Create `src/components/ScoreSummary.tsx`:

```typescript
import type { HalfInning } from '../engine/types'

interface ScoreSummaryProps {
  inning: number
  half: HalfInning
  outs: number
  scoreUs: number
  scoreThem: number
  pitchCount: number
  pitcherName: string
}

export function ScoreSummary({
  inning,
  half,
  outs,
  scoreUs,
  scoreThem,
  pitchCount,
  pitcherName,
}: ScoreSummaryProps) {
  const halfLabel = half === 'top' ? '\u25B2' : '\u25BC' // ▲ ▼

  return (
    <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between gap-4">
      {/* Inning */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs">{halfLabel}</span>
        <span className="text-lg font-bold">{half === 'top' ? 'Top' : 'Bot'} {inning}</span>
      </div>

      {/* Outs */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-slate-400 mr-1">OUT</span>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            data-testid={i < outs ? 'out-filled' : 'out-empty'}
            className={`w-3 h-3 rounded-full ${
              i < outs ? 'bg-amber-400' : 'bg-slate-600'
            }`}
          />
        ))}
      </div>

      {/* Score */}
      <div className="flex items-center gap-2">
        <div className="text-center">
          <div className="text-xs text-slate-400">US</div>
          <div className="text-2xl font-bold">{scoreUs}</div>
        </div>
        <div className="text-slate-500">-</div>
        <div className="text-center">
          <div className="text-xs text-slate-400">THEM</div>
          <div className="text-2xl font-bold">{scoreThem}</div>
        </div>
      </div>

      {/* Pitcher + pitch count */}
      <div className="text-right">
        <div className="text-xs text-slate-400">{pitcherName}</div>
        <div className="text-lg font-mono font-bold">{pitchCount}</div>
      </div>
    </div>
  )
}
```

**Step 4: Run tests**

```bash
npm run test -- src/components/__tests__/ScoreSummary.test.tsx
```

Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/components/
git commit -m "feat: add ScoreSummary top bar with inning, outs, score, pitch count"
```

---

### Task 15: Scoresheet grid component

**Files:**
- Create: `src/components/Scoresheet.tsx`
- Create: `src/components/__tests__/Scoresheet.test.tsx`

**Step 1: Write failing test**

Create `src/components/__tests__/Scoresheet.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Scoresheet } from '../Scoresheet'
import type { LineupSlot, Play } from '../../engine/types'

const mockLineup: LineupSlot[] = [
  { orderPosition: 1, playerId: 1, playerName: 'Alice', jerseyNumber: 1, position: 'P', substitutions: [] },
  { orderPosition: 2, playerId: 2, playerName: 'Bob', jerseyNumber: 2, position: 'C', substitutions: [] },
  { orderPosition: 3, playerId: 3, playerName: 'Charlie', jerseyNumber: 3, position: '1B', substitutions: [] },
]

describe('Scoresheet', () => {
  it('should render player names in batting order', () => {
    render(
      <Scoresheet
        lineup={mockLineup}
        plays={[]}
        currentInning={1}
        currentBatterPosition={1}
        maxInnings={6}
        onCellClick={() => {}}
      />
    )
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('Charlie')).toBeInTheDocument()
  })

  it('should render inning column headers', () => {
    render(
      <Scoresheet
        lineup={mockLineup}
        plays={[]}
        currentInning={3}
        currentBatterPosition={1}
        maxInnings={6}
        onCellClick={() => {}}
      />
    )
    for (let i = 1; i <= 6; i++) {
      expect(screen.getByText(i.toString())).toBeInTheDocument()
    }
  })

  it('should render summary stat headers', () => {
    render(
      <Scoresheet
        lineup={mockLineup}
        plays={[]}
        currentInning={1}
        currentBatterPosition={1}
        maxInnings={6}
        onCellClick={() => {}}
      />
    )
    expect(screen.getByText('AB')).toBeInTheDocument()
    expect(screen.getByText('R')).toBeInTheDocument()
    expect(screen.getByText('H')).toBeInTheDocument()
  })

  it('should populate cells with play data', () => {
    const plays: Play[] = [{
      id: 1, gameId: 1, sequenceNumber: 1, inning: 1, half: 'top',
      batterOrderPosition: 1, playType: 'K', notation: 'K',
      fieldersInvolved: [], basesReached: [], runsScoredOnPlay: 0,
      rbis: 0, pitches: ['S', 'S', 'S'], isAtBat: true, timestamp: new Date(),
    }]
    const { container } = render(
      <Scoresheet
        lineup={mockLineup}
        plays={plays}
        currentInning={1}
        currentBatterPosition={2}
        maxInnings={6}
        onCellClick={() => {}}
      />
    )
    expect(container.textContent).toContain('K')
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm run test -- src/components/__tests__/Scoresheet.test.tsx
```

Expected: FAIL

**Step 3: Implement Scoresheet**

Create `src/components/Scoresheet.tsx`:

```typescript
import type { LineupSlot, Play } from '../engine/types'
import { AtBatCell } from './AtBatCell'
import { computePlayerStats } from '../engine/stats'

interface ScoresheetProps {
  lineup: LineupSlot[]
  plays: Play[]
  currentInning: number
  currentBatterPosition: number
  maxInnings: number
  onCellClick: (batterPosition: number, inning: number) => void
}

export function Scoresheet({
  lineup,
  plays,
  currentInning,
  currentBatterPosition,
  maxInnings,
  onCellClick,
}: ScoresheetProps) {
  const innings = Array.from({ length: Math.max(maxInnings, currentInning) }, (_, i) => i + 1)

  const getPlayForCell = (batterPosition: number, inning: number): Play | undefined => {
    return plays.find(p => p.batterOrderPosition === batterPosition && p.inning === inning && p.isAtBat)
  }

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-sm min-w-full">
        <thead>
          <tr className="bg-slate-100">
            <th className="sticky left-0 z-10 bg-slate-100 border border-slate-200 px-2 py-1.5 text-left min-w-[140px]">
              Batter
            </th>
            {innings.map(inn => (
              <th key={inn} className="border border-slate-200 px-1 py-1.5 text-center min-w-[76px] font-bold">
                {inn}
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
            const stats = computePlayerStats(playerPlays, slot.orderPosition)

            return (
              <tr key={slot.orderPosition}>
                {/* Player info — sticky left column */}
                <td className="sticky left-0 z-10 bg-white border border-slate-200 px-2 py-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-mono w-4">{slot.orderPosition}</span>
                    <span className="text-xs text-slate-500 font-mono w-6">#{slot.jerseyNumber}</span>
                    <span className="text-xs text-slate-500 w-6">{slot.position}</span>
                    <span className="font-semibold text-slate-800 truncate">{slot.playerName}</span>
                  </div>
                  {/* Substitution rows */}
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

                {/* At-bat cells per inning */}
                {innings.map(inn => {
                  const play = getPlayForCell(slot.orderPosition, inn)
                  return (
                    <td key={inn} className="border border-slate-200 p-0">
                      <AtBatCell
                        play={play ? {
                          playType: play.playType,
                          notation: play.notation,
                          basesReached: play.basesReached,
                          runsScoredOnPlay: play.runsScoredOnPlay,
                          pitches: play.pitches,
                        } : null}
                        isCurrentBatter={slot.orderPosition === currentBatterPosition && inn === currentInning}
                        onClick={() => onCellClick(slot.orderPosition, inn)}
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

**Step 4: Run tests**

```bash
npm run test -- src/components/__tests__/Scoresheet.test.tsx
```

Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/components/
git commit -m "feat: add Scoresheet grid with sticky player column, at-bat cells, and live stats"
```

---

## Phase 7: Play Entry Interface

### Task 16: Pitch tracking panel

**Files:**
- Create: `src/components/PitchTracker.tsx`
- Create: `src/components/__tests__/PitchTracker.test.tsx`

**Step 1: Write failing test**

Create `src/components/__tests__/PitchTracker.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PitchTracker } from '../PitchTracker'

describe('PitchTracker', () => {
  it('should render ball and strike buttons', () => {
    render(<PitchTracker pitches={[]} onAddPitch={() => {}} onRemovePitch={() => {}} />)
    expect(screen.getByRole('button', { name: /ball/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /strike/i })).toBeInTheDocument()
  })

  it('should display current count', () => {
    render(<PitchTracker pitches={['B', 'S', 'B', 'F']} onAddPitch={() => {}} onRemovePitch={() => {}} />)
    // 2 balls, 1 strike + 1 foul = 2 strikes displayed
    expect(screen.getByText('2-2')).toBeInTheDocument()
  })

  it('should call onAddPitch when ball pressed', async () => {
    const user = userEvent.setup()
    const onAddPitch = vi.fn()
    render(<PitchTracker pitches={[]} onAddPitch={onAddPitch} onRemovePitch={() => {}} />)

    await user.click(screen.getByRole('button', { name: /ball/i }))
    expect(onAddPitch).toHaveBeenCalledWith('B')
  })

  it('should call onAddPitch when strike pressed', async () => {
    const user = userEvent.setup()
    const onAddPitch = vi.fn()
    render(<PitchTracker pitches={[]} onAddPitch={onAddPitch} onRemovePitch={() => {}} />)

    await user.click(screen.getByRole('button', { name: /strike/i }))
    expect(onAddPitch).toHaveBeenCalledWith('S')
  })

  it('should show total pitch count', () => {
    render(<PitchTracker pitches={['B', 'S', 'F', 'B', 'S']} onAddPitch={() => {}} onRemovePitch={() => {}} />)
    expect(screen.getByText(/5 pitches/i)).toBeInTheDocument()
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm run test -- src/components/__tests__/PitchTracker.test.tsx
```

Expected: FAIL

**Step 3: Implement PitchTracker**

Create `src/components/PitchTracker.tsx`:

```typescript
import type { PitchResult } from '../engine/types'

interface PitchTrackerProps {
  pitches: PitchResult[]
  onAddPitch: (pitch: PitchResult) => void
  onRemovePitch: () => void
}

export function PitchTracker({ pitches, onAddPitch, onRemovePitch }: PitchTrackerProps) {
  const balls = pitches.filter(p => p === 'B').length
  const strikes = pitches.filter(p => p === 'S' || p === 'F').length
  // Fouls only count as strikes up to 2
  const displayStrikes = Math.min(strikes, 2) + pitches.filter(p => p === 'S').length - pitches.filter(p => p === 'S').length
  // Simpler: count S and F separately
  const sCount = pitches.filter(p => p === 'S').length
  const fCount = pitches.filter(p => p === 'F').length
  const strikeDisplay = Math.min(sCount + fCount, 2 + fCount) // fouls can't be strike 3
  const actualStrikes = Math.min(sCount + Math.min(fCount, Math.max(0, 2 - sCount)), 2)
  // Simplest approach: just count as baseball does
  let b = 0
  let s = 0
  for (const p of pitches) {
    if (p === 'B') b++
    else if (p === 'S') s = Math.min(s + 1, 2)
    else if (p === 'F') s = Math.min(s + 1, 2) // foul can bring to 2 but not 3
  }

  return (
    <div className="bg-slate-100 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-lg font-mono font-bold text-slate-800">{b}-{s}</div>
        <div className="text-xs text-slate-500">{pitches.length} pitches</div>
      </div>

      <div className="flex items-center gap-1 mb-3">
        {pitches.map((p, i) => (
          <div
            key={i}
            className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${
              p === 'B' ? 'bg-blue-500' : p === 'S' ? 'bg-red-500' : 'bg-amber-500'
            }`}
          >
            {p}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onAddPitch('B')}
          className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg font-bold text-sm"
        >
          Ball
        </button>
        <button
          onClick={() => onAddPitch('S')}
          className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg font-bold text-sm"
        >
          Strike
        </button>
        <button
          onClick={() => onAddPitch('F')}
          className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-lg font-bold text-sm"
        >
          Foul
        </button>
        {pitches.length > 0 && (
          <button
            onClick={onRemovePitch}
            className="bg-slate-300 hover:bg-slate-400 text-slate-700 py-2 px-3 rounded-lg font-bold text-sm"
          >
            Undo
          </button>
        )}
      </div>
    </div>
  )
}
```

**Step 4: Run tests**

```bash
npm run test -- src/components/__tests__/PitchTracker.test.tsx
```

Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/components/
git commit -m "feat: add PitchTracker component for per-pitch B/S/F tracking"
```

---

### Task 17: Field diagram component for fielding plays

**Files:**
- Create: `src/components/FieldDiagram.tsx`
- Create: `src/components/__tests__/FieldDiagram.test.tsx`

**Step 1: Write failing test**

Create `src/components/__tests__/FieldDiagram.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FieldDiagram } from '../FieldDiagram'

describe('FieldDiagram', () => {
  it('should render all 9 position buttons', () => {
    render(<FieldDiagram selectedPositions={[]} onPositionClick={() => {}} />)
    for (let i = 1; i <= 9; i++) {
      expect(screen.getByRole('button', { name: new RegExp(i.toString()) })).toBeInTheDocument()
    }
  })

  it('should highlight selected positions', () => {
    const { container } = render(<FieldDiagram selectedPositions={[6, 3]} onPositionClick={() => {}} />)
    const highlighted = container.querySelectorAll('[data-selected="true"]')
    expect(highlighted.length).toBe(2)
  })

  it('should call onPositionClick when position tapped', async () => {
    const user = userEvent.setup()
    const onPositionClick = vi.fn()
    render(<FieldDiagram selectedPositions={[]} onPositionClick={onPositionClick} />)

    await user.click(screen.getByRole('button', { name: /6.*SS/i }))
    expect(onPositionClick).toHaveBeenCalledWith(6)
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm run test -- src/components/__tests__/FieldDiagram.test.tsx
```

Expected: FAIL

**Step 3: Implement FieldDiagram**

Create `src/components/FieldDiagram.tsx`:

```typescript
const POSITIONS = [
  { num: 1, label: 'P', x: 50, y: 62 },
  { num: 2, label: 'C', x: 50, y: 88 },
  { num: 3, label: '1B', x: 78, y: 68 },
  { num: 4, label: '2B', x: 62, y: 45 },
  { num: 5, label: '3B', x: 22, y: 68 },
  { num: 6, label: 'SS', x: 38, y: 45 },
  { num: 7, label: 'LF', x: 15, y: 22 },
  { num: 8, label: 'CF', x: 50, y: 10 },
  { num: 9, label: 'RF', x: 85, y: 22 },
]

interface FieldDiagramProps {
  selectedPositions: number[]
  onPositionClick: (position: number) => void
}

export function FieldDiagram({ selectedPositions, onPositionClick }: FieldDiagramProps) {
  return (
    <div className="relative w-72 h-72 mx-auto">
      {/* Green field background */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
        {/* Outfield arc */}
        <path d="M 5 50 Q 5 5 50 5 Q 95 5 95 50" fill="#86efac" fillOpacity="0.3" stroke="#16a34a" strokeWidth="0.5" />
        {/* Infield diamond */}
        <polygon points="50,85 78,55 50,25 22,55" fill="#fde68a" fillOpacity="0.3" stroke="#ca8a04" strokeWidth="0.5" />
      </svg>

      {/* Position buttons */}
      {POSITIONS.map(pos => {
        const isSelected = selectedPositions.includes(pos.num)
        return (
          <button
            key={pos.num}
            data-selected={isSelected}
            onClick={() => onPositionClick(pos.num)}
            className={`
              absolute w-10 h-10 rounded-full flex flex-col items-center justify-center
              text-xs font-bold transition-all transform -translate-x-1/2 -translate-y-1/2
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

**Step 4: Run tests**

```bash
npm run test -- src/components/__tests__/FieldDiagram.test.tsx
```

Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/components/
git commit -m "feat: add FieldDiagram component for fielding play position selection"
```

---

### Task 18: Play entry panel — combines pitch tracking, outcome buttons, field diagram

**Files:**
- Create: `src/components/PlayEntryPanel.tsx`
- Create: `src/components/__tests__/PlayEntryPanel.test.tsx`

**Step 1: Write failing test**

Create `src/components/__tests__/PlayEntryPanel.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlayEntryPanel } from '../PlayEntryPanel'

describe('PlayEntryPanel', () => {
  it('should render pitch tracker and common play buttons', () => {
    render(<PlayEntryPanel batterName="John Doe" onPlayRecorded={() => {}} onClose={() => {}} />)
    expect(screen.getByText(/john doe/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ball/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^K$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^1B$/i })).toBeInTheDocument()
  })

  it('should call onPlayRecorded with play data for strikeout', async () => {
    const user = userEvent.setup()
    const onPlayRecorded = vi.fn()
    render(<PlayEntryPanel batterName="John" onPlayRecorded={onPlayRecorded} onClose={() => {}} />)

    // Track some pitches first
    await user.click(screen.getByRole('button', { name: /strike/i }))
    await user.click(screen.getByRole('button', { name: /strike/i }))

    // Record the outcome
    await user.click(screen.getByRole('button', { name: /^K$/i }))

    expect(onPlayRecorded).toHaveBeenCalledOnce()
    const call = onPlayRecorded.mock.calls[0][0]
    expect(call.playType).toBe('K')
    expect(call.pitches).toEqual(['S', 'S'])
  })

  it('should show field diagram when fielding play selected', async () => {
    const user = userEvent.setup()
    render(<PlayEntryPanel batterName="John" onPlayRecorded={() => {}} onClose={() => {}} />)

    await user.click(screen.getByRole('button', { name: /ground out/i }))

    // Field diagram should appear
    expect(screen.getByRole('button', { name: /6.*SS/i })).toBeInTheDocument()
  })

  it('should record fielding play after selecting positions', async () => {
    const user = userEvent.setup()
    const onPlayRecorded = vi.fn()
    render(<PlayEntryPanel batterName="John" onPlayRecorded={onPlayRecorded} onClose={() => {}} />)

    await user.click(screen.getByRole('button', { name: /ground out/i }))
    await user.click(screen.getByRole('button', { name: /6.*SS/i }))
    await user.click(screen.getByRole('button', { name: /3.*1B/i }))
    await user.click(screen.getByRole('button', { name: /confirm/i }))

    expect(onPlayRecorded).toHaveBeenCalledOnce()
    const call = onPlayRecorded.mock.calls[0][0]
    expect(call.playType).toBe('GO')
    expect(call.fieldersInvolved).toEqual([6, 3])
    expect(call.notation).toBe('6-3')
  })

  it('should have a shorthand text input', () => {
    render(<PlayEntryPanel batterName="John" onPlayRecorded={() => {}} onClose={() => {}} />)
    expect(screen.getByPlaceholderText(/shorthand/i)).toBeInTheDocument()
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm run test -- src/components/__tests__/PlayEntryPanel.test.tsx
```

Expected: FAIL

**Step 3: Implement PlayEntryPanel**

Create `src/components/PlayEntryPanel.tsx`:

```typescript
import { useState } from 'react'
import type { PitchResult, PlayType } from '../engine/types'
import { PitchTracker } from './PitchTracker'
import { FieldDiagram } from './FieldDiagram'
import { parseShorthand, generateNotation } from '../engine/notation'

interface PlayRecordedData {
  playType: PlayType
  notation: string
  fieldersInvolved: number[]
  basesReached: number[]
  pitches: PitchResult[]
  isAtBat: boolean
}

interface PlayEntryPanelProps {
  batterName: string
  onPlayRecorded: (data: PlayRecordedData) => void
  onClose: () => void
}

type PanelMode = 'select' | 'fielding' | 'shorthand'

const COMMON_PLAYS: { label: string; playType: PlayType; basesReached: number[] }[] = [
  { label: 'K', playType: 'K', basesReached: [] },
  { label: 'KL', playType: 'KL', basesReached: [] },
  { label: 'BB', playType: 'BB', basesReached: [1] },
  { label: 'HBP', playType: 'HBP', basesReached: [1] },
  { label: '1B', playType: '1B', basesReached: [1] },
  { label: '2B', playType: '2B', basesReached: [1, 2] },
  { label: '3B', playType: '3B', basesReached: [1, 2, 3] },
  { label: 'HR', playType: 'HR', basesReached: [1, 2, 3, 4] },
]

const FIELDING_PLAYS: { label: string; playType: PlayType }[] = [
  { label: 'Ground Out', playType: 'GO' },
  { label: 'Fly Out', playType: 'FO' },
  { label: 'Line Out', playType: 'LO' },
  { label: 'Pop Out', playType: 'PO' },
]

const SPECIAL_PLAYS: { label: string; playType: PlayType; basesReached: number[]; isAtBat: boolean }[] = [
  { label: 'FC', playType: 'FC', basesReached: [1], isAtBat: true },
  { label: 'E', playType: 'E', basesReached: [1], isAtBat: true },
  { label: 'DP', playType: 'DP', basesReached: [], isAtBat: true },
  { label: 'SAC', playType: 'SAC', basesReached: [], isAtBat: true },
  { label: 'SB', playType: 'SB', basesReached: [], isAtBat: false },
  { label: 'WP', playType: 'WP', basesReached: [], isAtBat: false },
  { label: 'PB', playType: 'PB', basesReached: [], isAtBat: false },
  { label: 'BK', playType: 'BK', basesReached: [], isAtBat: false },
]

export function PlayEntryPanel({ batterName, onPlayRecorded, onClose }: PlayEntryPanelProps) {
  const [pitches, setPitches] = useState<PitchResult[]>([])
  const [mode, setMode] = useState<PanelMode>('select')
  const [fieldingPlayType, setFieldingPlayType] = useState<PlayType>('GO')
  const [selectedPositions, setSelectedPositions] = useState<number[]>([])
  const [shorthand, setShorthand] = useState('')

  const handleAddPitch = (p: PitchResult) => setPitches([...pitches, p])
  const handleRemovePitch = () => setPitches(pitches.slice(0, -1))

  const recordSimplePlay = (playType: PlayType, basesReached: number[], isAtBat = true) => {
    onPlayRecorded({
      playType,
      notation: generateNotation(playType, []),
      fieldersInvolved: [],
      basesReached,
      pitches,
      isAtBat,
    })
  }

  const handleFieldingPlaySelect = (playType: PlayType) => {
    setFieldingPlayType(playType)
    setSelectedPositions([])
    setMode('fielding')
  }

  const handlePositionClick = (pos: number) => {
    if (selectedPositions.includes(pos)) {
      setSelectedPositions(selectedPositions.filter(p => p !== pos))
    } else {
      setSelectedPositions([...selectedPositions, pos])
    }
  }

  const handleConfirmFielding = () => {
    const notation = generateNotation(fieldingPlayType, selectedPositions)
    onPlayRecorded({
      playType: fieldingPlayType,
      notation,
      fieldersInvolved: selectedPositions,
      basesReached: [],
      pitches,
      isAtBat: true,
    })
  }

  const handleShorthandSubmit = () => {
    if (!shorthand.trim()) return
    const parsed = parseShorthand(shorthand)
    onPlayRecorded({
      ...parsed,
      notation: generateNotation(parsed.playType, parsed.fieldersInvolved),
      pitches,
    })
  }

  return (
    <div className="fixed inset-x-0 bottom-0 bg-white border-t-2 border-slate-300 shadow-2xl max-h-[80vh] overflow-y-auto z-50">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-sm text-slate-500">At bat:</span>
            <span className="ml-2 font-bold text-slate-900">{batterName}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">&times;</button>
        </div>

        {/* Pitch tracker */}
        <div className="mb-4">
          <PitchTracker pitches={pitches} onAddPitch={handleAddPitch} onRemovePitch={handleRemovePitch} />
        </div>

        {mode === 'select' && (
          <>
            {/* Common plays */}
            <div className="mb-3">
              <div className="text-xs font-semibold text-slate-500 mb-1.5">OUTCOME</div>
              <div className="grid grid-cols-4 gap-1.5">
                {COMMON_PLAYS.map(play => (
                  <button
                    key={play.label}
                    onClick={() => recordSimplePlay(play.playType, play.basesReached)}
                    className="bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-bold text-sm"
                  >
                    {play.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Fielding plays */}
            <div className="mb-3">
              <div className="text-xs font-semibold text-slate-500 mb-1.5">FIELDING</div>
              <div className="grid grid-cols-2 gap-1.5">
                {FIELDING_PLAYS.map(play => (
                  <button
                    key={play.label}
                    onClick={() => handleFieldingPlaySelect(play.playType)}
                    className="bg-green-600 hover:bg-green-700 text-white py-2 rounded font-bold text-sm"
                  >
                    {play.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Special plays */}
            <div className="mb-3">
              <div className="text-xs font-semibold text-slate-500 mb-1.5">SPECIAL</div>
              <div className="grid grid-cols-4 gap-1.5">
                {SPECIAL_PLAYS.map(play => (
                  <button
                    key={play.label}
                    onClick={() => recordSimplePlay(play.playType, play.basesReached, play.isAtBat)}
                    className="bg-amber-600 hover:bg-amber-700 text-white py-2 rounded font-bold text-sm"
                  >
                    {play.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Shorthand input */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Shorthand (e.g. 6-3, 1B7, F8)"
                value={shorthand}
                onChange={e => setShorthand(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleShorthandSubmit()}
                className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm font-mono"
              />
              <button
                onClick={handleShorthandSubmit}
                disabled={!shorthand.trim()}
                className="bg-slate-700 hover:bg-slate-800 disabled:bg-slate-300 text-white px-4 py-2 rounded text-sm font-bold"
              >
                Enter
              </button>
            </div>
          </>
        )}

        {mode === 'fielding' && (
          <div>
            <div className="text-sm font-semibold text-slate-700 mb-2 text-center">
              Tap fielders in order: {selectedPositions.join(' → ') || '(none selected)'}
            </div>
            <FieldDiagram selectedPositions={selectedPositions} onPositionClick={handlePositionClick} />
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { setMode('select'); setSelectedPositions([]) }}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 py-2 rounded font-bold text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmFielding}
                disabled={selectedPositions.length === 0}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white py-2 rounded font-bold text-sm"
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

**Step 4: Run tests**

```bash
npm run test -- src/components/__tests__/PlayEntryPanel.test.tsx
```

Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/components/
git commit -m "feat: add PlayEntryPanel combining pitch tracking, outcome buttons, field diagram, shorthand"
```

---

### Task 19: Runner confirmation component

**Files:**
- Create: `src/components/RunnerConfirmation.tsx`
- Create: `src/components/__tests__/RunnerConfirmation.test.tsx`

**Step 1: Write failing test**

Create `src/components/__tests__/RunnerConfirmation.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RunnerConfirmation } from '../RunnerConfirmation'
import type { BaseRunners } from '../../engine/types'

describe('RunnerConfirmation', () => {
  it('should display current base runners', () => {
    const runners: BaseRunners = {
      first: { playerName: 'Alice', orderPosition: 1 },
      second: null,
      third: { playerName: 'Bob', orderPosition: 2 },
    }
    render(<RunnerConfirmation runners={runners} onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.getByText(/alice/i)).toBeInTheDocument()
    expect(screen.getByText(/bob/i)).toBeInTheDocument()
  })

  it('should show confirm and cancel buttons', () => {
    const runners: BaseRunners = { first: null, second: null, third: null }
    render(<RunnerConfirmation runners={runners} onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('should call onConfirm with runners when confirmed', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const runners: BaseRunners = {
      first: { playerName: 'Alice', orderPosition: 1 },
      second: null,
      third: null,
    }
    render(<RunnerConfirmation runners={runners} onConfirm={onConfirm} onCancel={() => {}} />)

    await user.click(screen.getByRole('button', { name: /confirm/i }))
    expect(onConfirm).toHaveBeenCalledWith(runners)
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm run test -- src/components/__tests__/RunnerConfirmation.test.tsx
```

Expected: FAIL

**Step 3: Implement RunnerConfirmation**

Create `src/components/RunnerConfirmation.tsx`:

```typescript
import { useState } from 'react'
import type { BaseRunners } from '../engine/types'

interface RunnerConfirmationProps {
  runners: BaseRunners
  onConfirm: (runners: BaseRunners) => void
  onCancel: () => void
}

export function RunnerConfirmation({ runners, onConfirm, onCancel }: RunnerConfirmationProps) {
  const [current, setCurrent] = useState<BaseRunners>({ ...runners })

  const clearBase = (base: 'first' | 'second' | 'third') => {
    setCurrent({ ...current, [base]: null })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Confirm Runners</h3>

        <div className="space-y-3 mb-6">
          {/* Third base */}
          <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-2">
            <span className="text-sm font-semibold text-slate-600">3rd</span>
            {current.third ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{current.third.playerName}</span>
                <button onClick={() => clearBase('third')} className="text-red-400 hover:text-red-600 text-xs">clear</button>
              </div>
            ) : (
              <span className="text-xs text-slate-400">empty</span>
            )}
          </div>

          {/* Second base */}
          <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-2">
            <span className="text-sm font-semibold text-slate-600">2nd</span>
            {current.second ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{current.second.playerName}</span>
                <button onClick={() => clearBase('second')} className="text-red-400 hover:text-red-600 text-xs">clear</button>
              </div>
            ) : (
              <span className="text-xs text-slate-400">empty</span>
            )}
          </div>

          {/* First base */}
          <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-2">
            <span className="text-sm font-semibold text-slate-600">1st</span>
            {current.first ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{current.first.playerName}</span>
                <button onClick={() => clearBase('first')} className="text-red-400 hover:text-red-600 text-xs">clear</button>
              </div>
            ) : (
              <span className="text-xs text-slate-400">empty</span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 py-2.5 rounded-lg font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(current)}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg font-semibold"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Step 4: Run tests**

```bash
npm run test -- src/components/__tests__/RunnerConfirmation.test.tsx
```

Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/components/
git commit -m "feat: add RunnerConfirmation component for post-play baserunner adjustment"
```

---

## Phase 8: Game Page Integration

### Task 20: GamePage — full integration

**Files:**
- Create: `src/pages/GamePage.tsx`
- Create: `src/pages/__tests__/GamePage.test.tsx`

**Step 1: Write failing test**

Create `src/pages/__tests__/GamePage.test.tsx`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
      expect(screen.getByText('Player1')).toBeInTheDocument()
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
})
```

**Step 2: Run tests to verify they fail**

```bash
npm run test -- src/pages/__tests__/GamePage.test.tsx
```

Expected: FAIL

**Step 3: Implement GamePage**

Create `src/pages/GamePage.tsx`:

```typescript
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useGame } from '../contexts/GameContext'
import { ScoreSummary } from '../components/ScoreSummary'
import { Scoresheet } from '../components/Scoresheet'
import { PlayEntryPanel } from '../components/PlayEntryPanel'
import { RunnerConfirmation } from '../components/RunnerConfirmation'
import type { BaseRunners, HalfInning, PlayType, PitchResult } from '../engine/types'
import { replayGame } from '../engine/engine'

type ActiveTab = 'us' | 'them'

interface PendingPlay {
  playType: PlayType
  notation: string
  fieldersInvolved: number[]
  basesReached: number[]
  pitches: PitchResult[]
  isAtBat: boolean
}

export function GamePage() {
  const { gameId } = useParams()
  const {
    game, lineupUs, lineupThem, plays, snapshot,
    loadGame, recordPlay, undoLastPlay,
  } = useGame()

  const [activeTab, setActiveTab] = useState<ActiveTab>('us')
  const [showPlayEntry, setShowPlayEntry] = useState(false)
  const [pendingPlay, setPendingPlay] = useState<PendingPlay | null>(null)
  const [pendingRunners, setPendingRunners] = useState<BaseRunners | null>(null)

  const gId = parseInt(gameId ?? '0')

  useEffect(() => {
    if (gId && (!game || game.id !== gId)) {
      loadGame(gId)
    }
  }, [gId, game, loadGame])

  if (!game || !snapshot || !lineupUs || !lineupThem) {
    return <div className="p-6 text-slate-500">Loading game...</div>
  }

  const activeLineup = activeTab === 'us' ? lineupUs : lineupThem
  const currentBatter = activeTab === 'us' ? snapshot.currentBatterUs : snapshot.currentBatterThem
  const activePlays = plays.filter(p =>
    activeTab === 'us' ? p.half === 'top' : p.half === 'bottom'
  )

  // Determine current pitcher for pitch count
  const pitcherLineup = snapshot.half === 'top' ? lineupThem : lineupUs
  const currentPitcher = pitcherLineup.battingOrder.find(s => s.position === 'P')
  const pitcherName = currentPitcher?.playerName ?? 'Unknown'
  const pitchCount = snapshot.pitchCountByPitcher.get(pitcherName) ?? 0

  // Current batter name
  const currentBatterSlot = activeTab === 'us'
    ? lineupUs.battingOrder.find(s => s.orderPosition === snapshot.currentBatterUs)
    : lineupThem.battingOrder.find(s => s.orderPosition === snapshot.currentBatterThem)

  const handlePlayRecorded = (data: PendingPlay) => {
    // Compute what the runners would look like after this play
    const tempPlays = [...plays, {
      id: undefined,
      gameId: gId,
      sequenceNumber: plays.length + 1,
      inning: snapshot.inning,
      half: snapshot.half,
      batterOrderPosition: snapshot.half === 'top' ? snapshot.currentBatterUs : snapshot.currentBatterThem,
      ...data,
      runsScoredOnPlay: 0,
      rbis: 0,
      timestamp: new Date(),
    }]

    const tempSnapshot = replayGame(tempPlays, lineupUs, lineupThem)

    // If this play could affect runners, show confirmation
    const affectsRunners = data.basesReached.length > 0 ||
      ['SB', 'WP', 'PB', 'BK', 'FC', 'E'].includes(data.playType)

    if (affectsRunners && (snapshot.baseRunners.first || snapshot.baseRunners.second || snapshot.baseRunners.third)) {
      setPendingPlay(data)
      setPendingRunners(tempSnapshot.baseRunners)
      setShowPlayEntry(false)
    } else {
      // Record directly
      finalizePlay(data)
    }
  }

  const finalizePlay = (data: PendingPlay, runnerOverrides?: BaseRunners) => {
    const half: HalfInning = snapshot.half
    const batterPos = half === 'top' ? snapshot.currentBatterUs : snapshot.currentBatterThem

    // Compute runs scored (simplified: count based on engine replay)
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
      runnerOverrides: runnerOverrides ? {
        first: runnerOverrides.first,
        second: runnerOverrides.second,
        third: runnerOverrides.third,
      } : undefined,
      timestamp: new Date(),
    }]
    const tempSnapshot = replayGame(tempPlays, lineupUs, lineupThem)
    const runsScored = (half === 'top')
      ? tempSnapshot.scoreUs - snapshot.scoreUs
      : tempSnapshot.scoreThem - snapshot.scoreThem

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
    })

    setShowPlayEntry(false)
    setPendingPlay(null)
    setPendingRunners(null)
  }

  const handleRunnerConfirm = (runners: BaseRunners) => {
    if (pendingPlay) {
      finalizePlay(pendingPlay, runners)
    }
  }

  const handleRunnerCancel = () => {
    setPendingPlay(null)
    setPendingRunners(null)
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Score summary */}
      <ScoreSummary
        inning={snapshot.inning}
        half={snapshot.half}
        outs={snapshot.outs}
        scoreUs={snapshot.scoreUs}
        scoreThem={snapshot.scoreThem}
        pitchCount={pitchCount}
        pitcherName={pitcherName}
      />

      {/* Home/Away tabs */}
      <div className="flex border-b border-slate-200 bg-white">
        <button
          onClick={() => setActiveTab('us')}
          className={`flex-1 py-2 text-sm font-bold text-center ${
            activeTab === 'us' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'
          }`}
        >
          Us ({game.homeOrAway === 'home' ? 'Home' : 'Away'})
        </button>
        <button
          onClick={() => setActiveTab('them')}
          className={`flex-1 py-2 text-sm font-bold text-center ${
            activeTab === 'them' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'
          }`}
        >
          Them ({game.opponentName})
        </button>
      </div>

      {/* Scoresheet */}
      <div className="flex-1 overflow-auto">
        <Scoresheet
          lineup={activeLineup.battingOrder}
          plays={activePlays}
          currentInning={snapshot.inning}
          currentBatterPosition={currentBatter}
          maxInnings={6}
          onCellClick={() => setShowPlayEntry(true)}
        />
      </div>

      {/* Bottom action bar */}
      <div className="p-3 bg-white border-t border-slate-200 flex gap-2">
        <button
          onClick={() => setShowPlayEntry(true)}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-bold"
        >
          Record Play
        </button>
        <button
          onClick={undoLastPlay}
          disabled={plays.length === 0}
          className="bg-slate-200 hover:bg-slate-300 disabled:bg-slate-100 disabled:text-slate-400 text-slate-700 py-2.5 px-4 rounded-lg font-bold"
        >
          Undo
        </button>
      </div>

      {/* Play entry panel */}
      {showPlayEntry && (
        <PlayEntryPanel
          batterName={currentBatterSlot?.playerName ?? 'Unknown'}
          onPlayRecorded={handlePlayRecorded}
          onClose={() => setShowPlayEntry(false)}
        />
      )}

      {/* Runner confirmation */}
      {pendingRunners && (
        <RunnerConfirmation
          runners={pendingRunners}
          onConfirm={handleRunnerConfirm}
          onCancel={handleRunnerCancel}
        />
      )}
    </div>
  )
}
```

**Step 4: Wire into router**

Update `src/App.tsx`:

```typescript
import { GamePage } from './pages/GamePage'
// ...
{ path: 'game/:gameId', element: <GamePage /> },
```

**Step 5: Run tests**

```bash
npm run test -- src/pages/__tests__/GamePage.test.tsx
```

Expected: ALL PASS

**Step 6: Commit**

```bash
git add src/
git commit -m "feat: add GamePage integrating scoresheet, play entry, runner confirmation"
```

---

### Task 21: Substitution UI

**Files:**
- Create: `src/components/SubstitutionDialog.tsx`
- Create: `src/components/__tests__/SubstitutionDialog.test.tsx`

**Step 1: Write failing test**

Create `src/components/__tests__/SubstitutionDialog.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SubstitutionDialog } from '../SubstitutionDialog'

describe('SubstitutionDialog', () => {
  it('should show form fields for new player', () => {
    render(
      <SubstitutionDialog
        currentPlayerName="Alice"
        orderPosition={3}
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )
    expect(screen.getByText(/replacing alice/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/new player name/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/jersey/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/position/i)).toBeInTheDocument()
  })

  it('should call onConfirm with substitution data', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(
      <SubstitutionDialog
        currentPlayerName="Alice"
        orderPosition={3}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />
    )

    await user.type(screen.getByPlaceholderText(/new player name/i), 'Dave')
    await user.type(screen.getByPlaceholderText(/jersey/i), '99')
    await user.type(screen.getByPlaceholderText(/position/i), 'RF')
    await user.click(screen.getByRole('button', { name: /confirm sub/i }))

    expect(onConfirm).toHaveBeenCalledWith({
      newPlayerName: 'Dave',
      newJerseyNumber: 99,
      newPosition: 'RF',
    })
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm run test -- src/components/__tests__/SubstitutionDialog.test.tsx
```

Expected: FAIL

**Step 3: Implement SubstitutionDialog**

Create `src/components/SubstitutionDialog.tsx`:

```typescript
import { useState } from 'react'

interface SubstitutionData {
  newPlayerName: string
  newJerseyNumber: number
  newPosition: string
}

interface SubstitutionDialogProps {
  currentPlayerName: string
  orderPosition: number
  onConfirm: (data: SubstitutionData) => void
  onCancel: () => void
}

export function SubstitutionDialog({
  currentPlayerName,
  orderPosition,
  onConfirm,
  onCancel,
}: SubstitutionDialogProps) {
  const [name, setName] = useState('')
  const [jersey, setJersey] = useState('')
  const [position, setPosition] = useState('')

  const handleConfirm = () => {
    if (!name.trim() || !jersey.trim()) return
    onConfirm({
      newPlayerName: name.trim(),
      newJerseyNumber: parseInt(jersey),
      newPosition: position.trim() || 'UT',
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4">
        <h3 className="text-lg font-bold text-slate-900 mb-1">Substitution</h3>
        <p className="text-sm text-slate-500 mb-4">
          Replacing {currentPlayerName} (#{orderPosition} in order)
        </p>

        <div className="space-y-3 mb-6">
          <input
            type="text"
            placeholder="New player name"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              placeholder="Jersey #"
              value={jersey}
              onChange={e => setJersey(e.target.value)}
              className="w-24 border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="Position"
              value={position}
              onChange={e => setPosition(e.target.value)}
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 py-2.5 rounded-lg font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!name.trim() || !jersey.trim()}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white py-2.5 rounded-lg font-semibold"
          >
            Confirm Sub
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Step 4: Run tests**

```bash
npm run test -- src/components/__tests__/SubstitutionDialog.test.tsx
```

Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/components/
git commit -m "feat: add SubstitutionDialog for mid-game player substitutions"
```

---

## Phase 9: Stats & History

### Task 22: Game stats page

**Files:**
- Create: `src/pages/GameStatsPage.tsx`
- Create: `src/pages/__tests__/GameStatsPage.test.tsx`

**Step 1: Write failing test**

Create `src/pages/__tests__/GameStatsPage.test.tsx`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { GameProvider } from '../../contexts/GameContext'
import { GameStatsPage } from '../GameStatsPage'
import { db } from '../../db/database'

async function seedGameWithPlays() {
  const teamId = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
  const gameId = await db.games.add({
    teamId, code: 'TEST01', date: new Date(), opponentName: 'Tigers',
    homeOrAway: 'home', status: 'completed', createdAt: new Date(), updatedAt: new Date(),
  })
  await db.lineups.add({
    gameId, side: 'us',
    battingOrder: [
      { orderPosition: 1, playerId: 1, playerName: 'Alice', jerseyNumber: 1, position: 'P', substitutions: [] },
      { orderPosition: 2, playerId: 2, playerName: 'Bob', jerseyNumber: 2, position: 'C', substitutions: [] },
    ],
  })
  await db.lineups.add({
    gameId, side: 'them',
    battingOrder: [
      { orderPosition: 1, playerId: null, playerName: 'Opp1', jerseyNumber: 10, position: 'P', substitutions: [] },
    ],
  })
  await db.plays.add({
    gameId, sequenceNumber: 1, inning: 1, half: 'top', batterOrderPosition: 1,
    playType: '1B', notation: '1B', fieldersInvolved: [], basesReached: [1],
    runsScoredOnPlay: 0, rbis: 0, pitches: ['B', 'S', 'B'], isAtBat: true, timestamp: new Date(),
  })
  await db.plays.add({
    gameId, sequenceNumber: 2, inning: 1, half: 'top', batterOrderPosition: 2,
    playType: 'HR', notation: 'HR', fieldersInvolved: [], basesReached: [1, 2, 3, 4],
    runsScoredOnPlay: 2, rbis: 2, pitches: ['S', 'B', 'S'], isAtBat: true, timestamp: new Date(),
  })
  return gameId
}

function renderStats(gameId: number) {
  return render(
    <MemoryRouter initialEntries={[`/game/${gameId}/stats`]}>
      <GameProvider>
        <Routes>
          <Route path="/game/:gameId/stats" element={<GameStatsPage />} />
        </Routes>
      </GameProvider>
    </MemoryRouter>
  )
}

describe('GameStatsPage', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  afterEach(async () => {
    await db.close()
  })

  it('should display game info', async () => {
    const gameId = await seedGameWithPlays()
    renderStats(gameId)

    await waitFor(() => {
      expect(screen.getByText(/tigers/i)).toBeInTheDocument()
    })
  })

  it('should display player stats', async () => {
    const gameId = await seedGameWithPlays()
    renderStats(gameId)

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.getByText('Bob')).toBeInTheDocument()
    })
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm run test -- src/pages/__tests__/GameStatsPage.test.tsx
```

Expected: FAIL

**Step 3: Implement GameStatsPage**

Create `src/pages/GameStatsPage.tsx`:

```typescript
import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import type { Game, Lineup, Play } from '../engine/types'
import { getGame, getLineupsForGame, getPlaysForGame } from '../db/gameService'
import { computePlayerStats } from '../engine/stats'
import { replayGame } from '../engine/engine'

export function GameStatsPage() {
  const { gameId } = useParams()
  const [game, setGame] = useState<Game | null>(null)
  const [lineupUs, setLineupUs] = useState<Lineup | null>(null)
  const [plays, setPlays] = useState<Play[]>([])
  const [loading, setLoading] = useState(true)

  const gId = parseInt(gameId ?? '0')

  useEffect(() => {
    async function load() {
      const g = await getGame(gId)
      if (!g) return
      setGame(g)
      const lineups = await getLineupsForGame(gId)
      setLineupUs(lineups.find(l => l.side === 'us') ?? null)
      const p = await getPlaysForGame(gId)
      setPlays(p)
      setLoading(false)
    }
    load()
  }, [gId])

  if (loading) return <div className="p-6">Loading...</div>
  if (!game || !lineupUs) return <div className="p-6">Game not found.</div>

  const topPlays = plays.filter(p => p.half === 'top')

  return (
    <div className="max-w-3xl mx-auto p-6">
      <Link to="/" className="text-blue-600 hover:underline text-sm">&larr; Home</Link>
      <h1 className="text-2xl font-bold text-slate-900 mt-4 mb-1">
        vs {game.opponentName}
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        {game.homeOrAway === 'home' ? 'Home' : 'Away'} &middot; {game.code}
      </p>

      {/* Player stats table */}
      <table className="w-full border-collapse bg-white rounded-lg overflow-hidden text-sm">
        <thead>
          <tr className="bg-slate-100 text-left">
            <th className="px-3 py-2">Player</th>
            <th className="px-2 py-2 text-center">AB</th>
            <th className="px-2 py-2 text-center">R</th>
            <th className="px-2 py-2 text-center">H</th>
            <th className="px-2 py-2 text-center">2B</th>
            <th className="px-2 py-2 text-center">3B</th>
            <th className="px-2 py-2 text-center">HR</th>
            <th className="px-2 py-2 text-center">RBI</th>
            <th className="px-2 py-2 text-center">BB</th>
            <th className="px-2 py-2 text-center">K</th>
            <th className="px-2 py-2 text-center">AVG</th>
          </tr>
        </thead>
        <tbody>
          {lineupUs.battingOrder.map(slot => {
            const stats = computePlayerStats(topPlays, slot.orderPosition)
            return (
              <tr key={slot.orderPosition} className="border-t border-slate-100">
                <td className="px-3 py-2 font-semibold">{slot.playerName}</td>
                <td className="px-2 py-2 text-center font-mono">{stats.atBats}</td>
                <td className="px-2 py-2 text-center font-mono">{stats.runs}</td>
                <td className="px-2 py-2 text-center font-mono">{stats.hits}</td>
                <td className="px-2 py-2 text-center font-mono">{stats.doubles}</td>
                <td className="px-2 py-2 text-center font-mono">{stats.triples}</td>
                <td className="px-2 py-2 text-center font-mono">{stats.homeRuns}</td>
                <td className="px-2 py-2 text-center font-mono">{stats.rbis}</td>
                <td className="px-2 py-2 text-center font-mono">{stats.walks}</td>
                <td className="px-2 py-2 text-center font-mono">{stats.strikeouts}</td>
                <td className="px-2 py-2 text-center font-mono">
                  {stats.atBats > 0 ? stats.avg.toFixed(3) : '.000'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

**Step 4: Wire into router**

Update `src/App.tsx`:

```typescript
import { GameStatsPage } from './pages/GameStatsPage'
// ...
{ path: 'game/:gameId/stats', element: <GameStatsPage /> },
```

**Step 5: Run tests**

```bash
npm run test -- src/pages/__tests__/GameStatsPage.test.tsx
```

Expected: ALL PASS

**Step 6: Commit**

```bash
git add src/
git commit -m "feat: add game stats page with per-player batting stats"
```

---

### Task 23: Season stats page

**Files:**
- Create: `src/pages/SeasonStatsPage.tsx`

This page aggregates stats across all games. It queries all plays for all games belonging to the team, groups by player, and computes cumulative stats.

**Step 1: Implement SeasonStatsPage**

Create `src/pages/SeasonStatsPage.tsx`:

```typescript
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { Player, Play, Lineup } from '../engine/types'
import { getAllTeams, getPlayersForTeam, getGamesForTeam } from '../db/gameService'
import { db } from '../db/database'
import { computePlayerStats } from '../engine/stats'

interface PlayerSeasonStats {
  player: Player
  stats: ReturnType<typeof computePlayerStats>
}

export function SeasonStatsPage() {
  const [playerStats, setPlayerStats] = useState<PlayerSeasonStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const teams = await getAllTeams()
      if (teams.length === 0) { setLoading(false); return }
      const team = teams[0]
      const players = await getPlayersForTeam(team.id!)
      const games = await getGamesForTeam(team.id!)

      // Gather all plays across all games (our at-bats = top half)
      const allPlays: Play[] = []
      const playerOrderMap = new Map<number, number>() // playerId -> orderPosition

      for (const game of games) {
        const lineups = await db.lineups.where('gameId').equals(game.id!).toArray()
        const ourLineup = lineups.find(l => l.side === 'us')
        if (!ourLineup) continue

        // Map player IDs to order positions for this game
        for (const slot of ourLineup.battingOrder) {
          if (slot.playerId) {
            playerOrderMap.set(slot.playerId, slot.orderPosition)
          }
        }

        const plays = await db.plays.where('gameId').equals(game.id!).toArray()
        const topPlays = plays.filter(p => p.half === 'top')
        allPlays.push(...topPlays)
      }

      // Compute stats per player
      const results: PlayerSeasonStats[] = players.map(player => {
        // Find all order positions this player has batted in across games
        const playerPlays = allPlays.filter(p => {
          // Match by checking if this player was at this order position in the lineup
          // Simplified: use playerOrderMap
          return playerOrderMap.get(player.id!) === p.batterOrderPosition
        })
        const stats = computePlayerStats(playerPlays, playerOrderMap.get(player.id!) ?? 0)
        return { player, stats }
      })

      setPlayerStats(results.filter(r => r.stats.games > 0))
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Link to="/" className="text-blue-600 hover:underline text-sm">&larr; Home</Link>
      <h1 className="text-2xl font-bold text-slate-900 mt-4 mb-6">Season Stats</h1>

      {playerStats.length === 0 ? (
        <p className="text-slate-500">No games played yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse bg-white rounded-lg overflow-hidden text-sm">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className="px-3 py-2">Player</th>
                <th className="px-2 py-2 text-center">G</th>
                <th className="px-2 py-2 text-center">AB</th>
                <th className="px-2 py-2 text-center">R</th>
                <th className="px-2 py-2 text-center">H</th>
                <th className="px-2 py-2 text-center">2B</th>
                <th className="px-2 py-2 text-center">3B</th>
                <th className="px-2 py-2 text-center">HR</th>
                <th className="px-2 py-2 text-center">RBI</th>
                <th className="px-2 py-2 text-center">BB</th>
                <th className="px-2 py-2 text-center">K</th>
                <th className="px-2 py-2 text-center">AVG</th>
                <th className="px-2 py-2 text-center">OBP</th>
                <th className="px-2 py-2 text-center">SLG</th>
              </tr>
            </thead>
            <tbody>
              {playerStats.map(({ player, stats }) => (
                <tr key={player.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-semibold">{player.name}</td>
                  <td className="px-2 py-2 text-center font-mono">{stats.games}</td>
                  <td className="px-2 py-2 text-center font-mono">{stats.atBats}</td>
                  <td className="px-2 py-2 text-center font-mono">{stats.runs}</td>
                  <td className="px-2 py-2 text-center font-mono">{stats.hits}</td>
                  <td className="px-2 py-2 text-center font-mono">{stats.doubles}</td>
                  <td className="px-2 py-2 text-center font-mono">{stats.triples}</td>
                  <td className="px-2 py-2 text-center font-mono">{stats.homeRuns}</td>
                  <td className="px-2 py-2 text-center font-mono">{stats.rbis}</td>
                  <td className="px-2 py-2 text-center font-mono">{stats.walks}</td>
                  <td className="px-2 py-2 text-center font-mono">{stats.strikeouts}</td>
                  <td className="px-2 py-2 text-center font-mono">{stats.avg.toFixed(3)}</td>
                  <td className="px-2 py-2 text-center font-mono">{stats.obp.toFixed(3)}</td>
                  <td className="px-2 py-2 text-center font-mono">{stats.slg.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Wire into router and add link from HomePage**

In `src/App.tsx` add the route:

```typescript
import { SeasonStatsPage } from './pages/SeasonStatsPage'
// ...
{ path: 'stats', element: <SeasonStatsPage /> },
```

In `src/pages/HomePage.tsx` add a link:

```typescript
<Link to="/stats" className="block w-full text-center bg-slate-500 hover:bg-slate-600 text-white py-3 px-4 rounded-lg font-semibold">
  Season Stats
</Link>
```

**Step 3: Commit**

```bash
git add src/
git commit -m "feat: add season stats page with cumulative player batting stats"
```

---

## Phase 10: Sync, Beginner Mode & PWA Polish

### Task 24: Sync service interface (stubbed)

**Files:**
- Create: `src/services/syncService.ts`
- Create: `src/services/__tests__/syncService.test.ts`

**Step 1: Write failing test**

Create `src/services/__tests__/syncService.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { db } from '../../db/database'
import { SyncService } from '../syncService'
import { createTeam, createGame, saveLineup, addPlay } from '../../db/gameService'

describe('SyncService', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  afterEach(async () => {
    await db.close()
  })

  it('should generate a 6-character alphanumeric game code', () => {
    const code = SyncService.generateGameCode()
    expect(code).toHaveLength(6)
    expect(/^[A-Z0-9]{6}$/.test(code)).toBe(true)
  })

  it('should generate unique codes', () => {
    const codes = new Set(Array.from({ length: 100 }, () => SyncService.generateGameCode()))
    expect(codes.size).toBeGreaterThan(90) // Statistically should all be unique
  })

  it('should export game data as JSON', async () => {
    const team = await createTeam('Mudcats')
    const game = await createGame(team.id!, 'Tigers', 'home')
    await saveLineup(game.id!, 'us', [
      { orderPosition: 1, playerId: 1, playerName: 'Alice', jerseyNumber: 1, position: 'P', substitutions: [] },
    ])
    await addPlay(game.id!, {
      inning: 1, half: 'top', batterOrderPosition: 1, playType: 'K',
      notation: 'K', fieldersInvolved: [], basesReached: [],
      runsScoredOnPlay: 0, rbis: 0, pitches: ['S', 'S', 'S'], isAtBat: true,
    })

    const exported = await SyncService.exportGame(game.id!)
    expect(exported).not.toBeNull()
    const parsed = JSON.parse(exported!)
    expect(parsed.game.opponentName).toBe('Tigers')
    expect(parsed.lineups).toHaveLength(1)
    expect(parsed.plays).toHaveLength(1)
  })

  it('should import game data from JSON', async () => {
    const json = JSON.stringify({
      game: {
        teamId: 1, code: 'IMPORT', date: new Date().toISOString(),
        opponentName: 'Bears', homeOrAway: 'away', status: 'in_progress',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      },
      lineups: [],
      plays: [],
    })

    const gameId = await SyncService.importGame(json)
    expect(gameId).toBeGreaterThan(0)

    const game = await db.games.get(gameId)
    expect(game?.opponentName).toBe('Bears')
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm run test -- src/services/__tests__/syncService.test.ts
```

Expected: FAIL

**Step 3: Implement SyncService**

Create `src/services/syncService.ts`:

```typescript
import { db } from '../db/database'
import type { Game, Lineup, Play } from '../engine/types'

interface GameExport {
  game: Omit<Game, 'id'>
  lineups: Omit<Lineup, 'id'>[]
  plays: Omit<Play, 'id'>[]
}

export class SyncService {
  static generateGameCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // No ambiguous chars (0/O, 1/I)
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)]
    }
    return code
  }

  static async exportGame(gameId: number): Promise<string | null> {
    const game = await db.games.get(gameId)
    if (!game) return null

    const lineups = await db.lineups.where('gameId').equals(gameId).toArray()
    const plays = await db.plays.where('gameId').equals(gameId).sortBy('sequenceNumber')

    // Strip IDs for portability
    const { id: _gId, ...gameData } = game
    const lineupData = lineups.map(({ id: _id, ...rest }) => rest)
    const playData = plays.map(({ id: _id, ...rest }) => rest)

    const exported: GameExport = {
      game: gameData,
      lineups: lineupData,
      plays: playData,
    }

    return JSON.stringify(exported)
  }

  static async importGame(json: string): Promise<number> {
    const data: GameExport = JSON.parse(json)

    // Create the game
    const gameId = await db.games.add({
      ...data.game,
      date: new Date(data.game.date),
      createdAt: new Date(data.game.createdAt),
      updatedAt: new Date(data.game.updatedAt),
    })

    // Create lineups
    for (const lineup of data.lineups) {
      await db.lineups.add({ ...lineup, gameId })
    }

    // Create plays
    for (const play of data.plays) {
      await db.plays.add({
        ...play,
        gameId,
        timestamp: new Date(play.timestamp),
      })
    }

    return gameId
  }

  // Future: Replace these with actual Supabase calls
  static async uploadGame(_gameId: number): Promise<string> {
    // Stub: would upload to Supabase and return game code
    throw new Error('Supabase sync not yet configured')
  }

  static async downloadGame(_code: string): Promise<number> {
    // Stub: would download from Supabase and import
    throw new Error('Supabase sync not yet configured')
  }
}
```

**Step 4: Run tests**

```bash
npm run test -- src/services/__tests__/syncService.test.ts
```

Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/services/
git commit -m "feat: add sync service with JSON export/import and game code generation"
```

---

### Task 25: Beginner mode

**Files:**
- Create: `src/components/BeginnerGuide.tsx`
- Create: `src/components/__tests__/BeginnerGuide.test.tsx`
- Create: `src/contexts/PreferencesContext.tsx`

**Step 1: Write failing test**

Create `src/components/__tests__/BeginnerGuide.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BeginnerGuide } from '../BeginnerGuide'

describe('BeginnerGuide', () => {
  it('should display the play notation', () => {
    render(<BeginnerGuide playType="K" notation="K" />)
    expect(screen.getByText('K')).toBeInTheDocument()
  })

  it('should show explanation for strikeout', () => {
    render(<BeginnerGuide playType="K" notation="K" />)
    expect(screen.getByText(/strikeout/i)).toBeInTheDocument()
  })

  it('should show explanation for ground out', () => {
    render(<BeginnerGuide playType="GO" notation="6-3" />)
    expect(screen.getByText(/ground out/i)).toBeInTheDocument()
    expect(screen.getByText(/shortstop.*first/i)).toBeInTheDocument()
  })

  it('should show explanation for single', () => {
    render(<BeginnerGuide playType="1B" notation="1B" />)
    expect(screen.getByText(/single/i)).toBeInTheDocument()
  })

  it('should render a diamond showing the play', () => {
    const { container } = render(<BeginnerGuide playType="1B" notation="1B" />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm run test -- src/components/__tests__/BeginnerGuide.test.tsx
```

Expected: FAIL

**Step 3: Implement PreferencesContext**

Create `src/contexts/PreferencesContext.tsx`:

```typescript
import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'

interface Preferences {
  beginnerMode: boolean
  setBeginnerMode: (v: boolean) => void
}

const PreferencesContext = createContext<Preferences>({
  beginnerMode: false,
  setBeginnerMode: () => {},
})

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [beginnerMode, setBeginnerModeState] = useState(() => {
    return localStorage.getItem('scorekeeper_beginner_mode') === 'true'
  })

  const setBeginnerMode = (v: boolean) => {
    setBeginnerModeState(v)
    localStorage.setItem('scorekeeper_beginner_mode', String(v))
  }

  return (
    <PreferencesContext.Provider value={{ beginnerMode, setBeginnerMode }}>
      {children}
    </PreferencesContext.Provider>
  )
}

export function usePreferences() {
  return useContext(PreferencesContext)
}
```

**Step 4: Implement BeginnerGuide**

Create `src/components/BeginnerGuide.tsx`:

```typescript
import { Diamond } from './Diamond'
import type { PlayType } from '../engine/types'

const POSITION_NAMES: Record<number, string> = {
  1: 'pitcher', 2: 'catcher', 3: 'first baseman',
  4: 'second baseman', 5: 'third baseman', 6: 'shortstop',
  7: 'left fielder', 8: 'center fielder', 9: 'right fielder',
}

function getExplanation(playType: PlayType, notation: string): string {
  switch (playType) {
    case 'K': return 'Strikeout (swinging). The batter swung and missed strike three.'
    case 'KL': return 'Strikeout (looking). The batter did not swing at strike three.'
    case 'BB': return 'Walk (base on balls). Four balls — batter goes to first base.'
    case 'HBP': return 'Hit by pitch. The batter was hit and goes to first base.'
    case '1B': return 'Single. The batter hit safely and reached first base.'
    case '2B': return 'Double. The batter hit safely and reached second base.'
    case '3B': return 'Triple. The batter hit safely and reached third base.'
    case 'HR': return 'Home run! The batter and all runners score.'
    case 'GO': {
      const parts = notation.split('-').map(Number)
      const fielders = parts.map(n => POSITION_NAMES[n] ?? `#${n}`).join(' to ')
      return `Ground out (${notation}). Fielded by ${fielders}.`
    }
    case 'FO': {
      const pos = parseInt(notation.replace('F', ''))
      return `Fly out (${notation}). Caught by the ${POSITION_NAMES[pos] ?? `fielder #${pos}`}.`
    }
    case 'LO': {
      const pos = parseInt(notation.replace('L', ''))
      return `Line out (${notation}). Line drive caught by the ${POSITION_NAMES[pos] ?? `fielder #${pos}`}.`
    }
    case 'PO': return `Pop out (${notation}). Pop fly caught.`
    case 'FC': return 'Fielder\'s choice. The batter reached base but a runner was put out.'
    case 'E': return `Error (${notation}). A fielder made an error, allowing the batter to reach base.`
    case 'DP': return `Double play (${notation}). Two outs recorded on one play.`
    case 'SAC': return 'Sacrifice. The batter was out but advanced a runner.'
    case 'SB': return 'Stolen base. A runner advanced a base while the pitcher was delivering.'
    case 'WP': return 'Wild pitch. The pitcher threw a pitch the catcher couldn\'t handle, runners advance.'
    case 'PB': return 'Passed ball. The catcher failed to catch a pitch, runners advance.'
    case 'BK': return 'Balk. Illegal pitching action, runners advance one base.'
    default: return notation
  }
}

function getBasesForPlay(playType: PlayType): number[] {
  switch (playType) {
    case '1B': return [1]
    case '2B': return [1, 2]
    case '3B': return [1, 2, 3]
    case 'HR': return [1, 2, 3, 4]
    case 'BB': case 'HBP': return [1]
    default: return []
  }
}

interface BeginnerGuideProps {
  playType: PlayType
  notation: string
}

export function BeginnerGuide({ playType, notation }: BeginnerGuideProps) {
  const explanation = getExplanation(playType, notation)
  const bases = getBasesForPlay(playType)

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mx-4 mb-4">
      <div className="flex items-start gap-4">
        <Diamond
          basesReached={bases}
          notation={notation}
          runScored={playType === 'HR'}
          size={80}
        />
        <div className="flex-1">
          <div className="text-lg font-bold text-blue-900 mb-1">{notation}</div>
          <p className="text-sm text-blue-800">{explanation}</p>
        </div>
      </div>
    </div>
  )
}
```

**Step 5: Run tests**

```bash
npm run test -- src/components/__tests__/BeginnerGuide.test.tsx
```

Expected: ALL PASS

**Step 6: Wire PreferencesProvider into App.tsx**

Wrap the app in `<PreferencesProvider>`:

```typescript
import { PreferencesProvider } from './contexts/PreferencesContext'
// ...
function App() {
  return (
    <PreferencesProvider>
      <GameProvider>
        <RouterProvider router={router} />
      </GameProvider>
    </PreferencesProvider>
  )
}
```

**Step 7: Commit**

```bash
git add src/
git commit -m "feat: add beginner mode with play explanations and preferences context"
```

---

### Task 26: PWA icons and final polish

**Files:**
- Create: `public/icon-192.png`
- Create: `public/icon-512.png`
- Modify: `index.html`

**Step 1: Generate PWA icons**

Create simple placeholder SVG icons and convert. For now, create a minimal SVG icon:

Create `public/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="64" fill="#1e3a5f"/>
  <polygon points="256,80 400,256 256,432 112,256" fill="none" stroke="#fbbf24" stroke-width="24" stroke-linejoin="round"/>
  <circle cx="256" cy="256" r="16" fill="#fbbf24"/>
  <text x="256" y="340" text-anchor="middle" font-family="system-ui" font-size="64" font-weight="bold" fill="white">SK</text>
</svg>
```

Then generate PNGs (if ImageMagick or similar available):

```bash
# If available, convert SVG to PNG. Otherwise these can be created manually.
# For now, copy the SVG as a reference:
cp public/icon.svg public/icon-192.png  # placeholder — replace with real PNGs
cp public/icon.svg public/icon-512.png  # placeholder — replace with real PNGs
```

Note: For production, generate proper PNG icons from the SVG using a tool like https://realfavicongenerator.net or sharp/ImageMagick.

**Step 2: Update index.html with meta tags**

Update `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/icon.svg" />
    <link rel="apple-touch-icon" href="/icon-192.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#1e3a5f" />
    <meta name="description" content="Little League Scorekeeping App — mirrors your Glover's scorebook" />
    <title>Scorekeeper</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 3: Final App.tsx with all routes**

Ensure `src/App.tsx` has all routes wired:

```typescript
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { PreferencesProvider } from './contexts/PreferencesContext'
import { GameProvider } from './contexts/GameContext'
import { AppLayout } from './layouts/AppLayout'
import { HomePage } from './pages/HomePage'
import { TeamPage } from './pages/TeamPage'
import { GameSetupPage } from './pages/GameSetupPage'
import { GamePage } from './pages/GamePage'
import { GameStatsPage } from './pages/GameStatsPage'
import { SeasonStatsPage } from './pages/SeasonStatsPage'
import { NotFoundPage } from './pages/NotFoundPage'

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'team', element: <TeamPage /> },
      { path: 'stats', element: <SeasonStatsPage /> },
      { path: 'game/:gameId/setup', element: <GameSetupPage /> },
      { path: 'game/:gameId', element: <GamePage /> },
      { path: 'game/:gameId/stats', element: <GameStatsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

function App() {
  return (
    <PreferencesProvider>
      <GameProvider>
        <RouterProvider router={router} />
      </GameProvider>
    </PreferencesProvider>
  )
}

export default App
```

**Step 4: Run full test suite**

```bash
npm run test
```

Expected: ALL PASS

**Step 5: Build and verify**

```bash
npm run build
```

Expected: Build succeeds with no errors

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add PWA icons, meta tags, and finalize all routes"
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1 | Project cleanup: Tailwind v4, deps, vitest |
| 2 | 2-4 | Game engine: types, replay, notation, stats |
| 3 | 5-6 | Database: Dexie schema, game service CRUD |
| 4 | 7-8 | App shell: routing, GameContext provider |
| 5 | 9-11 | Team/setup: roster page, game setup, home page |
| 6 | 12-15 | Scoresheet UI: Diamond, AtBatCell, ScoreSummary, Scoresheet |
| 7 | 16-19 | Play entry: PitchTracker, FieldDiagram, PlayEntryPanel, RunnerConfirmation |
| 8 | 20-21 | Game page: full integration, substitution dialog |
| 9 | 22-23 | Stats: game stats page, season stats page |
| 10 | 24-26 | Sync stub, beginner mode, PWA polish |

**Total: 26 tasks across 10 phases**

---

## Execution Options

Plan is complete and saved to `docs/plans/2026-02-22-scorekeeper-implementation.md`.

**1. Subagent-Driven (this session)** — I dispatch a fresh subagent per task, review between tasks. Fast iteration, good for catching issues early.

**2. Parallel Session (separate worktree)** — You open a new session with `superpowers:executing-plans`, I batch execute tasks with checkpoints.

Which approach would you prefer?
