# Scorekeeper — Little League Scorekeeping PWA

> **IMPORTANT: This is a living document.** Update this file whenever:
> - A phase or task is completed (update "Current Status" with phase/task numbers)
> - A new architectural decision is made or an existing one changes
> - New patterns or conventions are established during implementation
> - The project structure changes (new directories, renamed files)
> - Dependencies are added or removed (update "Tech Stack" accordingly)
> - MVP scope changes
> - Target sections become reality (remove "after Task 1" qualifiers once Task 1 is done)
>
> Commit CLAUDE.md updates alongside the code changes they describe.

## What This Is

A Progressive Web App that mirrors the Glover's paper scorebook for Little League Major division (ages 10-12). Offline-first, designed for tablets/laptops at the field, usable on phones. Supports both experienced and volunteer scorekeepers.

## Development Workflow

Use the `superpowers` skills for all development work:

- **`superpowers:executing-plans`** — Execute the implementation plan task-by-task with review checkpoints
- **`superpowers:test-driven-development`** — TDD for every feature/bugfix: tests first, then implementation
- **`superpowers:brainstorming`** — Before any creative work, new features, or behavior changes
- **`superpowers:writing-plans`** — When planning multi-step tasks
- **`superpowers:systematic-debugging`** — When encountering bugs or test failures
- **`superpowers:dispatching-parallel-agents`** — When facing 2+ independent tasks
- **`superpowers:verification-before-completion`** — Before claiming any work is done
- **`superpowers:requesting-code-review`** — After completing major features
- **`superpowers:finishing-a-development-branch`** — When ready to integrate work

**Common commands:**
- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — run ESLint
- `npm run test` — run vitest
- `npm run test:watch` — vitest watch mode

## Reference Documents

- **Design doc:** `docs/plans/2026-02-22-scorekeeper-design-v2.md` — contains the canonical data model (all entity fields), UI layout details, and play entry flows
- **Implementation plan:** `docs/plans/2026-02-22-scorekeeper-implementation.md` (26 tasks, 10 phases)
- **Multi-team design:** `docs/plans/2026-03-02-multi-team-design.md` — symmetric two-team model design
- **Multi-team plan:** `docs/plans/2026-03-02-multi-team-implementation.md` (12 tasks, 7 phases)
- **Scoresheet reference:** `docs/scoresheet_layout.jpeg` — Glover's scorebook layout; use as the visual target for the Scoresheet, AtBatCell, and Diamond components
- **Scoring symbols:** `docs/scoring_guide.jpeg` — Glover's notation symbols; use as reference for play notation rendering

## Current Status

- **Phase:** All phases complete + post-review bug fixes + 17 UX feedback fixes + multi-team support
- **Next step:** None — multi-team support complete
- **Test runner:** vitest configured and passing (268 tests across 27 test files)
- **UX feedback design:** `docs/plans/2026-02-26-ux-feedback-design.md`
- **UX feedback plan:** `docs/plans/2026-02-26-ux-feedback-implementation.md` (15 tasks, all complete)
- **Multi-team support:** `docs/plans/2026-03-02-multi-team-implementation.md` (12 tasks, all complete)

## Architecture

**Pattern: Pure Game Engine + Event Log (A+C Hybrid)**

- All game logic lives in a pure game engine module — no React, no Dexie, no UI
- `replayGame(plays, lineupHome, lineupAway) → GameSnapshot`
- Plays stored as an ordered event log; current state always computed by replay
- Undo = pop last play and recompute. Edit = replace play and recompute
- A 6-inning LL game has ~60-80 plays max — replay is instant

**State management:**
- Game engine (pure functions) for game logic
- Dexie.js (IndexedDB) for persistence
- React Context for distributing state to components
- `useState` for local UI state
- No external state library (no Zustand, no Redux)

**GameSnapshot is computed, never stored.** Always derived by replaying plays through the engine.

## Tech Stack

| Tool | Version | Notes |
|------|---------|-------|
| React | 19 | |
| TypeScript | ~5.9 | Strict mode, see TS rules below |
| Vite | 7 | Bundler & dev server |
| Tailwind CSS | v4 | Uses `@tailwindcss/vite` plugin, CSS-native config |
| Dexie.js | 4 | IndexedDB wrapper for offline persistence |
| react-router-dom | 7 | Client-side routing |
| vite-plugin-pwa | | Service worker, offline caching, install prompt |
| vitest | 4 | Test runner, configured with jsdom environment |
| @testing-library/react | | Component testing |
| fake-indexeddb | | Dexie testing in jsdom |
| ESLint | 9 | typescript-eslint, react-hooks, react-refresh plugins. Config: `eslint.config.js` |

## TypeScript Rules

These are enforced in `tsconfig.app.json`:

- `verbatimModuleSyntax: true` — use `import type { Foo }` for type-only imports
- `erasableSyntaxOnly: true` — **NO enums**, use string union types instead (e.g., `type PlayType = '1B' | '2B' | '3B' | 'HR'`)
- `noUnusedLocals: true` — no unused variables
- `noUnusedParameters: true` — no unused function parameters
- `noFallthroughCasesInSwitch: true` — every switch case must break/return
- `strict: true` — strict null checks, strict function types, etc.

## Tailwind CSS v4 Setup

Tailwind v4 uses CSS-native configuration:

- Plugin: `@tailwindcss/vite` added to `vite.config.ts`
- CSS entry: `@import "tailwindcss";` in `src/index.css`
- **No** `tailwind.config.js` — use `@theme` blocks in CSS if needed
- **No** `postcss.config.js` — the Vite plugin handles everything

## Data Model

> **Source of truth:** See `src/engine/types.ts` for complete field definitions. Multi-team design: `docs/plans/2026-03-02-multi-team-design.md`.

- **Team** — roster container (multiple teams supported)
- **Player** — belongs to a team, has default position
- **Game** — `team1Id`, `team2Id`, `homeTeamId` (symmetric — neither team is privileged). Status lifecycle: draft → in_progress → completed
- **Lineup** — per-game batting order with `side: 'home' | 'away'`, contains LineupSlots. Both teams have real rosters.
- **LineupSlot** — one spot in the batting order, `playerId` always populated (both teams have real players)
- **Play** — single event in the game log (at-bat result or baserunning event), uses `half: 'top' | 'bottom'`
- **GameSnapshot** — computed by `replayGame(plays, lineupHome, lineupAway)`, never stored. Fields use Home/Away naming: `scoreHome`, `scoreAway`, `currentBatterHome`, `currentBatterAway`, `runsPerInningHome`, `runsPerInningAway`, `runsScoredByPositionHome`, `runsScoredByPositionAway`

## Project Structure (Target)

```
src/
  engine/          # Pure game logic — no React, no Dexie
    types.ts       # All TypeScript types/interfaces
    engine.ts      # replayGame(), processPlay(), walk-off/skip-bottom logic
    notation.ts    # Shorthand parser ("6-3" → structured play)
    stats.ts       # Stat computation from play log
    journeys.ts    # computeRunnerJourneys() — track base advancement across plays
  db/
    database.ts    # Dexie schema & instance
    gameService.ts # CRUD operations for games, teams, players, plays
  contexts/
    GameContext.tsx # Game state provider (engine + Dexie bridge)
  components/
    Diamond.tsx            # SVG diamond with baserunner paths + continuation lines
    AtBatCell.tsx          # Single scoresheet cell (Glover's style)
    ScoreSummary.tsx       # Right-side stat columns
    Scoresheet.tsx         # Full grid (lineup + innings + summary + journey integration)
    PitchTracker.tsx       # B/S/F pitch tracking buttons with clear/edit
    FieldDiagram.tsx       # SVG field position picker
    PlayEntryPanel.tsx     # Play recording flow (pitches lifted to GamePage)
    PlayDetailPopover.tsx  # Tap-on-cell popover with play info, edit, undo
    PositionChangeDialog.tsx # Defensive position swap dialog
    RunnerConfirmation.tsx # Post-play baserunner adjustment (pre-play positions)
    SubstitutionDialog.tsx # Player substitution UI
    BeginnerGuide.tsx      # Notation explanation overlay
  layouts/
    AppLayout.tsx  # Shared layout wrapper
  pages/
    HomePage.tsx
    TeamsPage.tsx           # Multi-team list (/teams)
    TeamDetailPage.tsx      # Single team roster (/teams/:teamId)
    GameSetupPage.tsx
    GamePage.tsx       # Manages pitch state, auto-walk/strikeout, popover, pos change
    GameStatsPage.tsx
    SeasonStatsPage.tsx
  services/
    syncService.ts # Game code sync (transport stubbed for Supabase)
```

## Key Design Decisions

- **Symmetric multi-team model.** All teams are equal — no "my team" vs "opponent" distinction. Games reference two team IDs (`team1Id`, `team2Id`) plus `homeTeamId`. Both sides have real rosters.
- **Home/Away, not Us/Them.** `Lineup.side` is `'home' | 'away'`. Home always bats bottom, away always bats top. Engine takes 3 args: `replayGame(plays, lineupHome, lineupAway)`.
- **Lineup is separate from Roster.** Batting order set per-game, not on the player record.
- **Per-pitch tracking.** Each at-bat stores a `pitches: PitchResult[]` array of `'B' | 'S' | 'F'`. Pitcher totals derived by summing across plays.
- **`isAtBat` flag** on Play records distinguishes batting order plays (K, 1B, BB, etc.) from mid-at-bat events (SB, WP, PB, BK).
- **Baserunner confirmation step.** Engine applies default advancement, scorekeeper can adjust before finalizing. Shows pre-play positions with post-play defaults.
- **Pitch state in GamePage.** `currentAtBatPitches` lives in GamePage (not PlayEntryPanel) to survive panel close/reopen. Auto-walk on 4th ball, auto-strikeout confirmation on 3rd strike (S only, not F).
- **Runner continuation lines.** `computeRunnerJourneys()` tracks each batter's full base journey across subsequent plays. Diamond renders dashed lines for advancement beyond the original hit.
- **Play detail popover.** Tapping a filled cell shows notation, pitch summary, Edit (placeholder), and Undo (with confirmation for subsequent plays). Tapping current batter cell opens Record Play. Empty cells do nothing.
- **Position change dialog.** "Pos Change" button opens dialog for defensive changes with auto-swap detection. Records substitution entries with inning/half metadata.
- **Walk-off / skip bottom.** Engine ends game immediately on walk-off in bottom 6th+, and skips bottom half when home team already leads after top of final inning.
- **No Supabase yet.** Sync interface is built with JSON export/import. Transport stubbed for future Supabase backend.
- **Conflict resolution:** Last-write-wins by timestamp. Warn user if conflicts detected. No merge UI.
- **Game code format:** 6-char codes like "MUDH-0421" for sharing games between devices.
- **Shorthand input:** Experienced scorekeepers can type notation directly (e.g., "6-3", "1B7") — parser converts to structured play data.
- **Responsive design:** Tablet-first layout. Phone uses horizontal scroll on grid, play entry slides up from bottom.
- **Substitution re-entry:** LL allows one re-entry per player — tracked in substitution history.

## Testing Approach

- **TDD:** Tests written before implementation for every task
- **Engine tests:** Pure function tests with vitest (no DOM needed)
- **Component tests:** @testing-library/react with jsdom
- **Database tests:** Dexie tests use `fake-indexeddb` package

## Routes

```
/                       → Home (all games, team management entry)
/teams                  → Team list (multi-team management)
/teams/:teamId          → Single team roster management
/game/:gameId/setup     → Game setup (pick teams, build lineups)
/game/:gameId           → Main scoresheet (primary view during a game)
/game/:gameId/stats     → Post-game stats view
/stats                  → Season stats (with team selector)
```

## MVP Scope Boundaries

**Included:** Multi-team roster management, symmetric two-team game model, full play-by-play scoring for both teams, Glover's-style scoresheet (SVG diamonds, paths, pitch dots, notation), field diagram, per-pitch tracking, full substitutions, baserunner tracking with confirmation, undo/edit via event-log replay, beginner mode, game code sync (stubbed transport), offline-first PWA, per-team season stats.

**Not included:** Supabase backend, real-time multi-user scoring, chat, photos, PDF export, LL rule enforcement (pitch limits, rest days).
