# Multi-Team Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Evolve from single "home team" model to symmetric multi-team model where any two managed teams can play each other.

**Architecture:** Replace `Game.teamId`/`opponentName`/`homeOrAway` with `team1Id`/`team2Id`/`homeTeamId`. Change `Lineup.side` from `'us'|'them'` to `'home'|'away'`. Simplify engine by dropping `homeOrAway` parameter — `lineupHome` always bats bottom, `lineupAway` always bats top. Rename all `Us`/`Them` snapshot fields to `Home`/`Away`.

**Tech Stack:** React 19, TypeScript 5.9 (strict), Vite 7, Tailwind CSS v4, Dexie.js 4, vitest 4

**Design doc:** `docs/plans/2026-03-02-multi-team-design.md`

---

## Global Rename Reference

This table applies to every file in the codebase. Refer to it throughout implementation:

| Old | New | Notes |
|-----|-----|-------|
| `Side = 'us' \| 'them'` | `Side = 'home' \| 'away'` | Type definition in types.ts |
| `HomeOrAway` | *deleted* | No longer needed |
| `lineupUs` / `lineupThem` | `lineupHome` / `lineupAway` | Variables, params, props |
| `scoreUs` / `scoreThem` | `scoreHome` / `scoreAway` | GameSnapshot fields |
| `currentBatterUs` / `Them` | `currentBatterHome` / `Away` | GameSnapshot fields |
| `runsPerInningUs` / `Them` | `runsPerInningHome` / `Away` | GameSnapshot fields |
| `runsScoredByPositionUs` / `Them` | `runsScoredByPositionHome` / `Away` | GameSnapshot fields |
| `Game.teamId` | `Game.team1Id` | First team in game |
| `Game.opponentName` | *deleted* | Replaced by team2Id → Team.name |
| `Game.homeOrAway` | `Game.homeTeamId` | Which team is home |
| `LineupSlot.playerId: number \| null` | `LineupSlot.playerId: number` | Always populated |
| `replayGame(plays, lUs, lThem, hoa)` | `replayGame(plays, lHome, lAway)` | 3 args, not 4 |
| `computeRunnerJourneys(p, lUs, lTh, hoa)` | `computeRunnerJourneys(p, lHome, lAway)` | 3 args, not 4 |

### Test Fixture Mapping

Most existing tests use `homeOrAway: 'away'` (meaning "us is away"). When converting:

- **Old `homeOrAway: 'away'`**: `lineupUs` was the away team → becomes `lineupAway`. `lineupThem` was home → becomes `lineupHome`. `snapshot.scoreUs` → `snapshot.scoreAway`. `snapshot.scoreThem` → `snapshot.scoreHome`.
- **Old `homeOrAway: 'home'`**: `lineupUs` was home → becomes `lineupHome`. `lineupThem` was away → becomes `lineupAway`. `snapshot.scoreUs` → `snapshot.scoreHome`. `snapshot.scoreThem` → `snapshot.scoreAway`.

The replayGame call **reverses parameter order** when the old test used `'away'`:
```typescript
// Old: replayGame(plays, lineupUs, lineupThem, 'away')
// New: replayGame(plays, lineupHome, lineupAway)
//   where lineupHome = old lineupThem, lineupAway = old lineupUs
```

With fresh fixture names (`lineupHome`, `lineupAway`), this is clean — just `replayGame(plays, lineupHome, lineupAway)`.

---

## Phase 1: Engine Layer

### Task 1: Update Engine Types

**Files:**
- Modify: `src/engine/types.ts`

This task updates all type definitions. Downstream files will have compile errors until subsequent tasks fix them.

**Step 1: Update types.ts**

Apply these changes:

```typescript
// Line 5: Remove HomeOrAway
// DELETE: export type HomeOrAway = 'home' | 'away'

// Line 6: Change Side
export type Side = 'home' | 'away'

// Line 64: Change LineupSlot.playerId
playerId: number  // was: number | null

// Lines 78-88: Replace Game interface
export interface Game {
  id?: number
  team1Id: number
  team2Id: number
  homeTeamId: number  // must equal team1Id or team2Id
  code: string
  date: Date
  status: GameStatus
  createdAt: Date
  updatedAt: Date
}

// Lines 130-145: Rename GameSnapshot fields
export interface GameSnapshot {
  inning: number
  half: HalfInning
  outs: number
  scoreHome: number
  scoreAway: number
  currentBatterHome: number
  currentBatterAway: number
  baseRunners: BaseRunners
  pitchCountByPitcher: Map<string, number>
  runsPerInningHome: number[]
  runsPerInningAway: number[]
  runsScoredByPositionHome: Map<number, number>
  runsScoredByPositionAway: Map<number, number>
  isGameOver: boolean
}
```

**Step 2: Verify file saves**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Type errors in engine.ts, journeys.ts, and downstream files (this is expected — next tasks fix them).

**Step 3: Commit**

```
feat(types): update data model for symmetric multi-team support

Remove HomeOrAway type, change Side to home/away, update Game to use
team1Id/team2Id/homeTeamId, rename GameSnapshot Us/Them to Home/Away.
```

---

### Task 2: Update Engine Core + Tests

**Files:**
- Modify: `src/engine/engine.ts`
- Modify: `src/engine/__tests__/engine.test.ts`

**Step 1: Update engine.ts**

Key changes:

1. **Remove `HomeOrAway` import** (line 1) — it no longer exists.

2. **Delete `isUsBattingHalf` function** (lines 62-65). Replace all usages with `half === 'bottom'` (home bats bottom).

3. **Update `getBaseRunnerForBatter`** — drop `homeOrAway` param:
```typescript
function getBaseRunnerForBatter(
  batterOrderPosition: number,
  half: HalfInning,
  lineupHome: Lineup,
  lineupAway: Lineup,
): BaseRunner {
  const lineup = half === 'bottom' ? lineupHome : lineupAway
  const slot = lineup.battingOrder.find(s => s.orderPosition === batterOrderPosition)
  return {
    playerName: slot?.playerName ?? `Player${batterOrderPosition}`,
    orderPosition: batterOrderPosition,
  }
}
```

4. **Update `applyBaseRunning`** — drop `homeOrAway` param:
```typescript
function applyBaseRunning(
  snapshot: GameSnapshot,
  play: Play,
  lineupHome: Lineup,
  lineupAway: Lineup,
): { runsScored: number; scorers: number[] } {
  // ...
  const batter = getBaseRunnerForBatter(play.batterOrderPosition, play.half, lineupHome, lineupAway)
  // ... rest unchanged
```

5. **Update `replayGame` signature** — 3 args:
```typescript
export function replayGame(
  plays: Play[],
  lineupHome: Lineup,
  lineupAway: Lineup,
): GameSnapshot {
  const snapshot = initialSnapshot()
  const lineupSizeHome = lineupHome.battingOrder.length
  const lineupSizeAway = lineupAway.battingOrder.length
```

6. **Update `initialSnapshot`** — use Home/Away field names:
```typescript
function initialSnapshot(): GameSnapshot {
  return {
    inning: 1,
    half: 'top',
    outs: 0,
    scoreHome: 0,
    scoreAway: 0,
    currentBatterHome: 1,
    currentBatterAway: 1,
    baseRunners: { first: null, second: null, third: null },
    pitchCountByPitcher: new Map(),
    runsPerInningHome: [],
    runsPerInningAway: [],
    runsScoredByPositionHome: new Map(),
    runsScoredByPositionAway: new Map(),
    isGameOver: false,
  }
}
```

7. **Simplify pitcher lookup** (line ~269):
```typescript
const pitcherLineup = play.half === 'bottom' ? lineupAway : lineupHome
```

8. **Simplify scoring** (lines ~286-301):
```typescript
const isHomeBatting = play.half === 'bottom'
if (isHomeBatting) {
  snapshot.scoreHome += runsScored
  ensureInningArray(snapshot.runsPerInningHome, play.inning)
  snapshot.runsPerInningHome[play.inning - 1] += runsScored
  for (const pos of scorers) {
    snapshot.runsScoredByPositionHome.set(pos, (snapshot.runsScoredByPositionHome.get(pos) ?? 0) + 1)
  }
} else {
  snapshot.scoreAway += runsScored
  ensureInningArray(snapshot.runsPerInningAway, play.inning)
  snapshot.runsPerInningAway[play.inning - 1] += runsScored
  for (const pos of scorers) {
    snapshot.runsScoredByPositionAway.set(pos, (snapshot.runsScoredByPositionAway.get(pos) ?? 0) + 1)
  }
}
```

9. **Simplify batter advance** (lines ~304-310):
```typescript
if (play.isAtBat) {
  if (isHomeBatting) {
    snapshot.currentBatterHome = advanceBatter(snapshot.currentBatterHome, lineupSizeHome)
  } else {
    snapshot.currentBatterAway = advanceBatter(snapshot.currentBatterAway, lineupSizeAway)
  }
}
```

10. **Simplify walk-off** (lines ~314-320):
```typescript
if (snapshot.inning >= 6 && snapshot.half === 'bottom' && runsScored > 0) {
  if (snapshot.scoreHome > snapshot.scoreAway) {
    snapshot.isGameOver = true
  }
}
```

11. **Simplify skip-bottom** (lines ~333-339):
```typescript
else if (snapshot.half === 'bottom' && snapshot.inning >= 6) {
  if (snapshot.scoreHome > snapshot.scoreAway) {
    snapshot.isGameOver = true
  }
}
```

**Step 2: Update engine tests**

Update the fixture builders:
```typescript
function makeLineup(side: 'home' | 'away', count = 9): Lineup {
  const battingOrder: LineupSlot[] = Array.from({ length: count }, (_, i) => ({
    orderPosition: i + 1,
    playerId: i + 1,  // always populated
    playerName: `${side}-Player${i + 1}`,
    jerseyNumber: (i + 1) * 10,
    position: ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'][i] ?? 'DH',
    substitutions: [],
  }))
  return { gameId: 1, side, battingOrder }
}

const lineupHome = makeLineup('home')
const lineupAway = makeLineup('away')
```

For every `replayGame` call, apply the mapping rule from the Global Rename Reference above. Most tests had `homeOrAway: 'away'`, which means `lineupUs` was away. With fresh fixture names:
- All calls become `replayGame(plays, lineupHome, lineupAway)` — 3 args
- `snapshot.scoreUs` → `snapshot.scoreAway` (for tests where "us" was away)
- `snapshot.scoreThem` → `snapshot.scoreHome` (for tests where "them" was home)
- Watch for tests that used `homeOrAway: 'home'` — mapping is reversed

Update player name assertions to match new fixture names (e.g., `'us-Player1'` → `'away-Player1'`).

**Step 3: Run engine tests**

Run: `npx vitest run src/engine/__tests__/engine.test.ts`
Expected: All pass

**Step 4: Commit**

```
refactor(engine): simplify replayGame to use lineupHome/lineupAway

Drop homeOrAway parameter — home always bats bottom, away always bats top.
Rename all Us/Them internal references to Home/Away.
```

---

### Task 3: Update Journeys + Tests

**Files:**
- Modify: `src/engine/journeys.ts`
- Modify: `src/engine/__tests__/journeys.test.ts`

**Step 1: Update journeys.ts**

1. **Remove `HomeOrAway` import** (line 1).

2. **Update `computeRunnerJourneys` signature** — 3 args:
```typescript
export function computeRunnerJourneys(
  plays: Play[],
  lineupHome: Lineup,
  lineupAway: Lineup,
): Map<number, number[]> {
```

3. **Update internal `replayGame` calls** (line 38, 104):
```typescript
const snapshot = replayGame(playSlice, lineupHome, lineupAway)
```

4. **Simplify `getRunsForHalf`** — drop `homeOrAway` param:
```typescript
function getRunsForHalf(snapshot: { scoreHome: number; scoreAway: number }, half: string): number {
  return half === 'bottom' ? snapshot.scoreHome : snapshot.scoreAway
}
```

5. **Update `getRunsForHalf` call sites** (lines 106-108):
```typescript
const runsNow = getRunsForHalf(snapshot, half)
const runsBefore = prevSnapshot ? getRunsForHalf(prevSnapshot, half) : 0
```

**Step 2: Update journey tests**

Apply same fixture mapping as Task 2. Change all `computeRunnerJourneys(plays, lineupUs, lineupThem, homeOrAway)` to `computeRunnerJourneys(plays, lineupHome, lineupAway)`.

**Step 3: Run journey tests**

Run: `npx vitest run src/engine/__tests__/journeys.test.ts`
Expected: All pass

**Step 4: Commit**

```
refactor(journeys): drop homeOrAway param from computeRunnerJourneys

Home/away now implicit from lineup position. Simplify getRunsForHalf.
```

---

## Phase 2: Database & Service Layer

### Task 4: Update Database Schema + Game Service + Tests

**Files:**
- Modify: `src/db/database.ts`
- Modify: `src/db/gameService.ts`
- Modify: `src/db/__tests__/database.test.ts`
- Modify: `src/db/__tests__/gameService.test.ts`

**Step 1: Update database.ts schema**

Bump to version 2. Change `games` index. Change `lineups` compound index to use `'home'`/`'away'` (Dexie stores the side value — the compound index `[gameId+side]` will work with new values).

```typescript
constructor() {
  super('scorekeeper_db')
  this.version(2).stores({
    teams: '++id',
    players: '++id, teamId',
    games: '++id, team1Id, team2Id, code, status',
    lineups: '++id, gameId, [gameId+side]',
    plays: '++id, gameId, sequenceNumber, [gameId+inning+half]',
  })
}
```

Note: No version 1 definition needed since there's no real data to migrate. Just replace the version number and schema.

**Step 2: Update gameService.ts**

1. **Update `createGame`**:
```typescript
export async function createGame(
  team1Id: number,
  team2Id: number,
  homeTeamId: number,
): Promise<Game> {
  const now = new Date()
  const game: Game = {
    team1Id,
    team2Id,
    homeTeamId,
    code: generateGameCode(),
    date: now,
    status: 'in_progress',
    createdAt: now,
    updatedAt: now,
  }
  const id = await db.games.add(game)
  return { ...game, id }
}
```

2. **Update `getGamesForTeam`** — query both team IDs:
```typescript
export async function getGamesForTeam(teamId: number): Promise<Game[]> {
  const byTeam1 = await db.games
    .where('team1Id')
    .equals(teamId)
    .filter(g => g.status !== 'deleted')
    .toArray()
  const byTeam2 = await db.games
    .where('team2Id')
    .equals(teamId)
    .filter(g => g.status !== 'deleted')
    .toArray()
  // Deduplicate (in case team plays itself — unlikely but safe)
  const seen = new Set<number>()
  const result: Game[] = []
  for (const g of [...byTeam1, ...byTeam2]) {
    if (g.id !== undefined && !seen.has(g.id)) {
      seen.add(g.id)
      result.push(g)
    }
  }
  return result
}
```

3. **Add `getAllGames` function** (needed for HomePage showing all games):
```typescript
export async function getAllGames(): Promise<Game[]> {
  return db.games.filter(g => g.status !== 'deleted').toArray()
}
```

4. **Update `saveLineup` side type**:
```typescript
export async function saveLineup(
  gameId: number,
  side: 'home' | 'away',
  battingOrder: LineupSlot[],
): Promise<Lineup> {
```

5. **Remove `HomeOrAway` from imports** and update other type imports as needed.

**Step 3: Update database tests**

Update test fixtures to use new Game shape:
```typescript
const game = await createGame(team1.id!, team2.id!, team1.id!) // team1 is home
```

Update lineup saves to use `'home'`/`'away'` instead of `'us'`/`'them'`.

**Step 4: Update gameService tests**

Rewrite game creation tests, lineup tests, and query tests for new schema. Test `getAllGames` and `getGamesForTeam` (now querying both team columns).

**Step 5: Run database/service tests**

Run: `npx vitest run src/db/__tests__/`
Expected: All pass

**Step 6: Commit**

```
feat(db): update schema for symmetric two-team game model

Dexie v2 schema with team1Id/team2Id. Update createGame, getGamesForTeam,
add getAllGames. Lineup side now 'home'/'away'.
```

---

## Phase 3: Context Layer

### Task 5: Update GameContext + Tests

**Files:**
- Modify: `src/contexts/GameContext.tsx`
- Modify: `src/contexts/__tests__/GameContext.test.tsx`

**Step 1: Update GameContext.tsx**

1. **Update state variables**: `lineupUs` → `lineupHome`, `lineupThem` → `lineupAway`.

2. **Add team state**: Load both Team objects for display:
```typescript
const [homeTeam, setHomeTeam] = useState<Team | null>(null)
const [awayTeam, setAwayTeam] = useState<Team | null>(null)
```

3. **Update `recompute`** — drop `homeOrAway` arg:
```typescript
const recompute = (currentPlays: Play[], lHome: Lineup | null, lAway: Lineup | null) => {
  if (!lHome || !lAway) return
  const snap = replayGame(currentPlays, lHome, lAway)
  setSnapshot(snap)
}
```

4. **Update `loadGame`** — fetch lineups by `'home'`/`'away'`, load team records:
```typescript
const loadGame = async (gameId: number) => {
  const g = await getGame(gameId)
  if (!g) return

  // Load team records
  const homeId = g.homeTeamId
  const awayId = g.team1Id === homeId ? g.team2Id : g.team1Id
  const [ht, at] = await Promise.all([getTeam(homeId), getTeam(awayId)])
  setHomeTeam(ht ?? null)
  setAwayTeam(at ?? null)

  const lineups = await getLineupsForGame(gameId)
  const lHome = lineups.find(l => l.side === 'home') ?? null
  const lAway = lineups.find(l => l.side === 'away') ?? null
  const p = await getPlaysForGame(gameId)

  setGame(g)
  setLineupHome(lHome)
  setLineupAway(lAway)
  setPlays(p)
  recompute(p, lHome, lAway)
}
```

5. **Update all action functions** (`recordPlay`, `undoLastPlay`, `editPlay`, `undoFromPlay`, `updateLineupPositions`) — they all call `recompute`. Drop `homeOrAway` from their recompute calls:
```typescript
// Before: recompute(currentPlays, lusVal, lthVal, game.homeOrAway)
// After:  recompute(currentPlays, lHomeVal, lAwayVal)
```

6. **Update context value** to expose `lineupHome`, `lineupAway`, `homeTeam`, `awayTeam`.

7. **Update `updateLineupPositions`** — change side param from `'us' | 'them'` to `'home' | 'away'`.

**Step 2: Update GameContext tests**

Update test setup to create games with new model:
```typescript
const team1 = await createTeam('Mudcats')
const team2 = await createTeam('Tigers')
await addPlayer(team1.id!, 'Player 1', 1, 'P')
await addPlayer(team2.id!, 'Opp 1', 10, 'P')
const game = await createGame(team1.id!, team2.id!, team1.id!) // team1 is home
await saveLineup(game.id!, 'home', [
  { orderPosition: 1, playerId: 1, playerName: 'Player 1', jerseyNumber: 1, position: 'P', substitutions: [] },
])
await saveLineup(game.id!, 'away', [
  { orderPosition: 1, playerId: 2, playerName: 'Opp 1', jerseyNumber: 10, position: 'P', substitutions: [] },
])
```

Update all snapshot assertions: `scoreUs` → `scoreHome`, etc.

**Step 3: Run context tests**

Run: `npx vitest run src/contexts/__tests__/GameContext.test.tsx`
Expected: All pass

**Step 4: Commit**

```
refactor(context): update GameContext for symmetric two-team model

Store lineupHome/lineupAway, load both Team records.
Drop homeOrAway from recompute calls.
```

---

## Phase 4: Component Updates

### Task 6: Update Components + Tests

**Files:**
- Modify: `src/components/ScoreSummary.tsx`
- Modify: `src/components/Scoresheet.tsx`
- Modify: `src/components/__tests__/ScoreSummary.test.tsx`
- Modify: `src/components/__tests__/Scoresheet.test.tsx`
- Possibly modify: other component test files that use `playerId: null`

**Step 1: Update ScoreSummary.tsx**

The current ScoreSummary uses `homeOrAway` to determine which score is on the left (away) vs right (home). In the new model, the caller passes `scoreHome` and `scoreAway` directly — no conditional needed.

New props:
```typescript
interface ScoreSummaryProps {
  scoreHome: number
  scoreAway: number
  homeTeamName: string
  awayTeamName: string
  // ... other props unchanged
}
```

Rendering becomes simpler — always away on left, home on right:
```typescript
<div className="text-xs ...">{awayTeamName}</div>
<div className="text-2xl ...">{scoreAway}</div>
// divider
<div className="text-xs ...">{homeTeamName}</div>
<div className="text-2xl ...">{scoreHome}</div>
```

Remove `homeOrAway` prop entirely.

**Step 2: Update Scoresheet.tsx**

Change props from `lineupUs`/`lineupThem`/`homeOrAway` to `lineupHome`/`lineupAway`:
```typescript
interface ScoresheetProps {
  lineup: Lineup
  plays: Play[]
  currentBatter: number
  runsMap?: Map<number, number>
  allPlays?: Play[]
  lineupHome?: Lineup
  lineupAway?: Lineup
}
```

Update `computeRunnerJourneys` call:
```typescript
const journeys = allPlays && lineupHome && lineupAway
  ? computeRunnerJourneys(allPlays, lineupHome, lineupAway)
  : new Map<number, number[]>()
```

**Step 3: Update component tests**

- Update `ScoreSummary.test.tsx`: Remove `homeOrAway` prop, use `scoreHome`/`scoreAway`/`homeTeamName`/`awayTeamName`.
- Update `Scoresheet.test.tsx`: Change lineup fixtures (`playerId` always populated, side = `'home'`/`'away'`).
- Scan all component tests for `playerId: null` fixtures and update to use real IDs.

**Step 4: Run component tests**

Run: `npx vitest run src/components/__tests__/`
Expected: All pass

**Step 5: Commit**

```
refactor(components): update ScoreSummary and Scoresheet for home/away model

ScoreSummary takes direct home/away scores and names.
Scoresheet uses lineupHome/lineupAway for journey computation.
```

---

## Phase 5: Page Updates — Existing Pages

### Task 7: Update GamePage + Tests

**Files:**
- Modify: `src/pages/GamePage.tsx`
- Modify: `src/pages/__tests__/GamePage.test.tsx`

This is the most complex page update. The key changes:

**Step 1: Update GamePage.tsx**

1. **Change activeTab type** from `'us' | 'them'` to `'home' | 'away'`:
```typescript
type ActiveTab = 'home' | 'away'
const [activeTab, setActiveTab] = useState<ActiveTab>('away') // away bats first
```

2. **Simplify batting half logic** — no more conditional:
```typescript
// DELETE these lines:
// const usBattingHalf = game.homeOrAway === 'home' ? 'bottom' : 'top'
// const themBattingHalf = usBattingHalf === 'top' ? 'bottom' : 'top'

// Home always bats bottom, away always bats top
const homeBattingHalf: HalfInning = 'bottom'
const awayBattingHalf: HalfInning = 'top'
```

3. **Auto-sync tab to batting team**:
```typescript
// Default to whichever team is currently batting
if (snapshot.half === 'bottom') setActiveTab('home')
else setActiveTab('away')
```

4. **Update active lineup/batter/plays**:
```typescript
const activeLineup = activeTab === 'home' ? lineupHome : lineupAway
const currentBatter = activeTab === 'home' ? snapshot.currentBatterHome : snapshot.currentBatterAway
const activePlays = plays.filter(p =>
  activeTab === 'home' ? p.half === 'bottom' : p.half === 'top'
)
```

5. **Update tab labels** — show team names:
```typescript
// Away tab always on left, home tab always on right
<button onClick={() => setActiveTab('away')}>
  {awayTeam?.name ?? 'Away'} (Away)
</button>
<button onClick={() => setActiveTab('home')}>
  {homeTeam?.name ?? 'Home'} (Home)
</button>
```

6. **Update ScoreSummary props**:
```typescript
<ScoreSummary
  scoreHome={snapshot.scoreHome}
  scoreAway={snapshot.scoreAway}
  homeTeamName={homeTeam?.name ?? 'Home'}
  awayTeamName={awayTeam?.name ?? 'Away'}
  // ... other props
/>
```

7. **Update Scoresheet props**:
```typescript
<Scoresheet
  lineup={activeLineup}
  plays={activePlays}
  currentBatter={currentBatter}
  runsMap={activeTab === 'home' ? snapshot.runsScoredByPositionHome : snapshot.runsScoredByPositionAway}
  allPlays={plays}
  lineupHome={lineupHome}
  lineupAway={lineupAway}
/>
```

8. **Update position change logic** — defensive team is the non-batting team:
```typescript
const defensiveSide: 'home' | 'away' = snapshot.half === 'bottom' ? 'away' : 'home'
```

9. **Update play recording** — determine current batter from snapshot:
```typescript
const battingTeamHalf = snapshot.half
const currentBatterPos = battingTeamHalf === 'bottom'
  ? snapshot.currentBatterHome
  : snapshot.currentBatterAway
const pitcherLineup = battingTeamHalf === 'bottom' ? lineupAway : lineupHome
```

10. **Get `homeTeam` and `awayTeam` from context** (added in Task 5).

**Step 2: Update GamePage tests**

Update `seedFullGame` helper:
```typescript
async function seedFullGame() {
  const team1Id = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
  const team2Id = await db.teams.add({ name: 'Tigers', createdAt: new Date() })
  // Add players to both teams
  for (let i = 0; i < 9; i++) {
    await db.players.add({ teamId: team1Id, name: `Player${i + 1}`, jerseyNumber: (i + 1) * 10, defaultPosition: POSITIONS[i], createdAt: new Date() })
    await db.players.add({ teamId: team2Id, name: `Opp${i + 1}`, jerseyNumber: (i + 1) * 10, defaultPosition: POSITIONS[i], createdAt: new Date() })
  }
  const gameId = await db.games.add({
    team1Id, team2Id, homeTeamId: team1Id,
    code: 'TEST01', date: new Date(),
    status: 'in_progress', createdAt: new Date(), updatedAt: new Date(),
  })
  // Home lineup (team1 = Mudcats)
  await db.lineups.add({
    gameId, side: 'home',
    battingOrder: Array.from({ length: 9 }, (_, i) => ({
      orderPosition: i + 1, playerId: i + 1,
      playerName: `Player${i + 1}`, jerseyNumber: (i + 1) * 10,
      position: POSITIONS[i], substitutions: [],
    })),
  })
  // Away lineup (team2 = Tigers)
  await db.lineups.add({
    gameId, side: 'away',
    battingOrder: Array.from({ length: 9 }, (_, i) => ({
      orderPosition: i + 1, playerId: 10 + i + 1,
      playerName: `Opp${i + 1}`, jerseyNumber: (i + 1) * 10,
      position: POSITIONS[i], substitutions: [],
    })),
  })
  return gameId
}
```

Update tab assertions: Instead of "Us"/"Them", look for team names "Mudcats"/"Tigers" or "Home"/"Away".

Update snapshot field assertions throughout (scoreUs → scoreHome/scoreAway per context).

**Step 3: Run GamePage tests**

Run: `npx vitest run src/pages/__tests__/GamePage.test.tsx`
Expected: All pass

**Step 4: Commit**

```
refactor(GamePage): use home/away tabs with team names

Replace us/them tabs with home/away. Show team names from context.
Simplify batting half logic — home always bottom, away always top.
```

---

### Task 8: Update Stats Pages + Tests

**Files:**
- Modify: `src/pages/GameStatsPage.tsx`
- Modify: `src/pages/SeasonStatsPage.tsx`
- Modify: `src/pages/__tests__/GameStatsPage.test.tsx`
- Modify: `src/pages/__tests__/SeasonStatsPage.test.tsx` (if it exists)

**Step 1: Update GameStatsPage.tsx**

1. **Get teams from context**: Use `homeTeam` and `awayTeam` from GameContext.

2. **Simplify half determination**:
```typescript
// DELETE: const usBattingHalf = game.homeOrAway === 'home' ? 'bottom' : 'top'
// Home always bats bottom
const homePlays = plays.filter(p => p.half === 'bottom')
const awayPlays = plays.filter(p => p.half === 'top')
```

3. **Update replayGame call**:
```typescript
const snapshot = replayGame(plays, lineupHome!, lineupAway!)
```

4. **Show stats for both teams** using `homeTeam.name` and `awayTeam.name` as headers.

5. **Use `runsScoredByPositionHome`/`Away`** for correct R column.

**Step 2: Update SeasonStatsPage.tsx**

1. **Add team selector** — load all teams, dropdown to pick one:
```typescript
const [teams, setTeams] = useState<Team[]>([])
const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null)
```

2. **Load games for selected team**:
```typescript
const games = await getGamesForTeam(selectedTeamId)
```

3. **For each game, determine if selected team is home or away**:
```typescript
const isHome = game.homeTeamId === selectedTeamId
const teamBattingHalf: HalfInning = isHome ? 'bottom' : 'top'
const teamPlays = plays.filter(p => p.half === teamBattingHalf)
```

4. **Update replayGame call** and use `runsScoredByPositionHome`/`Away` based on which side the selected team is:
```typescript
const snapshot = replayGame(plays, homeLineup, awayLineup)
const runsMap = isHome ? snapshot.runsScoredByPositionHome : snapshot.runsScoredByPositionAway
```

**Step 3: Update stats page tests**

Update test fixtures to use new Game shape and lineup sides. Update snapshot field assertions.

**Step 4: Run stats page tests**

Run: `npx vitest run src/pages/__tests__/GameStatsPage.test.tsx`
Expected: All pass

**Step 5: Commit**

```
refactor(stats): update stats pages for symmetric team model

GameStatsPage shows both teams symmetrically.
SeasonStatsPage adds team selector for per-team cumulative stats.
```

---

## Phase 6: Page Redesigns

> **Note:** Use the `ui-ux-pro-max` skill for detailed UX design of these pages. The steps below describe structural/functional requirements; the skill handles visual design.

### Task 9: Redesign HomePage

**Files:**
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/pages/__tests__/HomePage.test.tsx`

**Step 1: Design with UX skill**

Invoke `ui-ux-pro-max` for HomePage redesign. Requirements:
- Show all games across all teams (not filtered to one team)
- Each game row shows: "Team A vs Team B", date, status, score if completed
- "New Game" button that navigates to game setup
- "Manage Teams" link/button that navigates to `/teams`
- Delete game functionality (soft delete, inline confirm — keep existing pattern)
- No team selector needed on home page (games show both team names)

**Step 2: Implement HomePage changes**

Key functional changes:
1. Replace `getGamesForTeam(team.id!)` with `getAllGames()`.
2. For each game, load both team names (or eagerly load all teams into a Map).
3. Remove the "opponent name" input from game creation — game creation now happens on GameSetupPage.
4. The "New Game" button navigates to `/game/new/setup` or similar (see Task 11).

**Step 3: Update HomePage tests**

Test the new layout: multiple games across teams, team names displayed, navigation to teams page.

**Step 4: Run tests**

Run: `npx vitest run src/pages/__tests__/HomePage.test.tsx`
Expected: All pass

**Step 5: Commit**

```
feat(HomePage): show all games across all teams

Replace single-team game list with all-games view.
Display both team names per game. Add Manage Teams link.
```

---

### Task 10: Create TeamsPage + TeamDetailPage

**Files:**
- Create: `src/pages/TeamsPage.tsx`
- Create: `src/pages/TeamDetailPage.tsx`
- Create: `src/pages/__tests__/TeamsPage.test.tsx`
- Create: `src/pages/__tests__/TeamDetailPage.test.tsx`
- Delete or repurpose: `src/pages/TeamPage.tsx` (old single-team page)
- Delete or repurpose: `src/pages/__tests__/TeamPage.test.tsx`

**Step 1: Design with UX skill**

Invoke `ui-ux-pro-max` for teams pages. Requirements:

**TeamsPage (`/teams`):**
- List of all teams with name and player count
- "Add Team" button → creates team, navigates to TeamDetailPage
- Tap a team → navigates to `/teams/:teamId`
- Back navigation to home

**TeamDetailPage (`/teams/:teamId`):**
- Team name (editable)
- Player roster list (name, jersey number, default position)
- Add player form (same as current TeamPage)
- Delete player (same as current TeamPage)
- Back navigation to `/teams`

**Step 2: Implement TeamsPage**

```typescript
export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([])
  // Load all teams on mount
  // "Add Team" handler creates team and navigates
  // List of teams with player counts
}
```

**Step 3: Implement TeamDetailPage**

Reuse most logic from existing `TeamPage.tsx`, but:
- Get `teamId` from URL params (`useParams`)
- Load specific team's roster
- No team creation (that happens on TeamsPage or during game setup)

**Step 4: Write tests for both pages**

Test team list, team creation, player management, navigation.

**Step 5: Run tests**

Run: `npx vitest run src/pages/__tests__/TeamsPage.test.tsx src/pages/__tests__/TeamDetailPage.test.tsx`
Expected: All pass

**Step 6: Commit**

```
feat(teams): add TeamsPage and TeamDetailPage for multi-team management

Replace single TeamPage with team list + team detail pages.
Support creating/viewing/editing multiple team rosters.
```

---

### Task 11: Redesign GameSetupPage

**Files:**
- Modify: `src/pages/GameSetupPage.tsx`
- Modify: `src/pages/__tests__/GameSetupPage.test.tsx`

**Step 1: Design with UX skill**

Invoke `ui-ux-pro-max` for game setup redesign. Requirements:

**Two-phase flow:**

Phase 1 — Team Selection:
- Pick away team (dropdown of existing teams, or "Create New Team" button)
- Pick home team (same dropdown, minus already-selected team)
- "Create New Team" opens inline form: team name → navigate to quick roster entry → return
- "Continue to Lineup" button

Phase 2 — Lineup Setup (existing flow, adapted):
- Two tabs: "Away Lineup" and "Home Lineup"
- Each tab shows the team's roster, drag to set batting order, assign positions
- Both teams use the same lineup builder UI (symmetric)
- "Start Game" button creates the Game record and both Lineup records

**Step 2: Implement team selection phase**

New game creation flow:
```typescript
// Create game record
const game = await createGame(awayTeam.id!, homeTeam.id!, homeTeam.id!)
// Navigate to lineup setup for this game
navigate(`/game/${game.id}/setup`)
```

Wait — this means we need a place to SELECT teams before the game exists. Options:
1. A new `/game/new` route for team selection, then redirect to `/game/:id/setup` for lineups
2. Combine both into GameSetupPage with internal state phases

**Recommended:** Option 2 — keep it all in GameSetupPage. The page has two internal phases: "select teams" and "set lineups". The game record is created when teams are confirmed and we move to lineup phase.

**Step 3: Implement lineup setup phase**

Reuse existing lineup builder, but:
- Pull roster from selected team (both sides)
- Both sides use `playerId` from real roster
- Save as `side: 'home'` and `side: 'away'`

**Step 4: Implement "Create New Team" sub-flow**

When user picks "Create New Team":
- Show inline team name input + "Create" button
- After creation, navigate to TeamDetailPage for roster entry (or inline roster entry)
- On return, select the newly created team

**Step 5: Update tests**

Test: team selection, team creation flow, lineup building for both teams, game creation.

**Step 6: Run tests**

Run: `npx vitest run src/pages/__tests__/GameSetupPage.test.tsx`
Expected: All pass

**Step 7: Commit**

```
feat(GameSetup): two-team picker with on-the-fly team creation

Phase 1: Select away/home teams from roster list or create new.
Phase 2: Build both lineups from team rosters. Symmetric setup.
```

---

## Phase 7: Routes & Integration

### Task 12: Update Routes + AppLayout + Integration

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/layouts/AppLayout.tsx` (if needed)
- Modify: `src/services/__tests__/syncService.test.ts` (if it references old types)
- Modify: `src/__tests__/smoke.test.ts` (if it references old types)

**Step 1: Update routes in App.tsx**

```typescript
const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/teams', element: <TeamsPage /> },
      { path: '/teams/:teamId', element: <TeamDetailPage /> },
      { path: '/game/:gameId/setup', element: <GameSetupPage /> },
      { path: '/game/:gameId', element: <GamePage /> },
      { path: '/game/:gameId/stats', element: <GameStatsPage /> },
      { path: '/stats', element: <SeasonStatsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
```

Key changes:
- `/team` → `/teams` (plural)
- Add `/teams/:teamId`
- Remove old `/team` route

**Step 2: Update AppLayout if needed**

Update navigation links:
- "Teams" link → `/teams`

**Step 3: Update remaining test files**

Scan for any remaining references to old types/patterns:
- `syncService.test.ts` — update if it creates Game objects
- `smoke.test.ts` — update if it creates Game objects
- Any component tests not yet updated in Task 6

**Step 4: Run full test suite**

Run: `npm run test`
Expected: All tests pass (249+ tests)

**Step 5: Run build**

Run: `npm run build`
Expected: Clean build, no TypeScript errors

**Step 6: Run lint**

Run: `npm run lint`
Expected: No lint errors

**Step 7: Update CLAUDE.md**

Update the following sections:
- **Current Status**: Note multi-team support phase
- **Data Model**: Update Game, Lineup, LineupSlot descriptions
- **Key Design Decisions**: Update us/them → home/away, remove single-team references
- **Routes**: Update route table
- **Project Structure**: Update page file names

**Step 8: Commit**

```
feat: wire up multi-team routes and verify full integration

Update App.tsx routes, fix remaining test files, verify build and lint.
Update CLAUDE.md for new multi-team architecture.
```
