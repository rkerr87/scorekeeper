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
- **Scoresheet reference:** `docs/scoresheet_layout.jpeg` — Glover's scorebook layout; use as the visual target for the Scoresheet, AtBatCell, and Diamond components
- **Scoring symbols:** `docs/scoring_guide.jpeg` — Glover's notation symbols; use as reference for play notation rendering

## Current Status

- **Phase:** Phase 3 complete (Tasks 2-6 done)
- **Next step:** Phase 4, Task 7 — React Router setup and app layout
- **Test runner:** vitest configured and passing (56 tests)

## Architecture

**Pattern: Pure Game Engine + Event Log (A+C Hybrid)**

- All game logic lives in a pure game engine module — no React, no Dexie, no UI
- `replayGame(plays, lineupUs, lineupThem) → GameSnapshot`
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

> **Source of truth:** See the design doc (`docs/plans/2026-02-22-scorekeeper-design-v2.md`) for complete field definitions. Note: `GameSnapshot` field names in the design doc are superseded by the implementation plan — use `currentBatterUs`/`currentBatterThem` and `runsPerInningUs`/`runsPerInningThem` (see `src/engine/types.ts`).

- **Team** — roster container
- **Player** — belongs to a team, has default position
- **Game** — single game instance with status lifecycle (draft → in_progress → completed)
- **Lineup** — per-game batting order for "us" or "them", contains LineupSlots
- **LineupSlot** — one spot in the batting order, with substitution history
- **Play** — single event in the game log (at-bat result or baserunning event)
- **GameSnapshot** — computed by replaying plays, never stored

## Project Structure (Target)

> **Currently:** Scaffold cleaned up. `App.tsx`, `main.tsx`, `index.css` are minimal placeholders. Structure below will be created incrementally across Phases 2-10.

```
src/
  engine/          # Pure game logic — no React, no Dexie
    types.ts       # All TypeScript types/interfaces
    engine.ts      # replayGame(), processPlay(), etc.
    notation.ts    # Shorthand parser ("6-3" → structured play)
    stats.ts       # Stat computation from play log
  db/
    database.ts    # Dexie schema & instance
    gameService.ts # CRUD operations for games, teams, players
  contexts/
    GameContext.tsx # Game state provider (engine + Dexie bridge)
  components/
    Diamond.tsx          # SVG diamond with baserunner paths
    AtBatCell.tsx        # Single scoresheet cell (Glover's style)
    ScoreSummary.tsx     # Right-side stat columns
    Scoresheet.tsx       # Full grid (lineup + innings + summary)
    PitchTracker.tsx     # B/S/F pitch tracking buttons
    FieldDiagram.tsx     # SVG field position picker
    PlayEntryPanel.tsx   # Play recording flow
    RunnerConfirmation.tsx # Post-play baserunner adjustment
    SubstitutionDialog.tsx # Player substitution UI
    BeginnerGuide.tsx    # Notation explanation overlay
  layouts/
    AppLayout.tsx  # Shared layout wrapper
  pages/
    HomePage.tsx
    TeamPage.tsx
    GameSetupPage.tsx
    GamePage.tsx
    GameStatsPage.tsx
    SeasonStatsPage.tsx
  services/
    syncService.ts # Game code sync (transport stubbed for Supabase)
```

## Key Design Decisions

- **Lineup is separate from Roster.** Batting order set per-game, not on the player record.
- **Opponent players are inline.** No separate opponent table — name/number/position stored directly in lineup slots. Opponent stats not tracked across seasons.
- **Per-pitch tracking.** Each at-bat stores a `pitches: PitchResult[]` array of `'B' | 'S' | 'F'`. Pitcher totals derived by summing across plays.
- **`isAtBat` flag** on Play records distinguishes batting order plays (K, 1B, BB, etc.) from mid-at-bat events (SB, WP, PB, BK).
- **Baserunner confirmation step.** Engine applies default advancement, scorekeeper can adjust before finalizing.
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
/                   → Home (start game, resume game, enter game code, manage roster)
/team               → Team roster management
/game/:id/setup     → Pre-game setup (batting order, positions, opponent lineup)
/game/:id           → Main scoresheet (primary view during a game)
/game/:id/stats     → Post-game stats view
/stats              → Season cumulative stats
```

## MVP Scope Boundaries

**Included:** Single-team roster, full play-by-play scoring for both teams, Glover's-style scoresheet (SVG diamonds, paths, pitch dots, notation), field diagram, per-pitch tracking, full substitutions, baserunner tracking with confirmation, undo/edit via event-log replay, beginner mode, game code sync (stubbed transport), offline-first PWA, season stats.

**Not included:** Multiple teams, Supabase backend, real-time multi-user scoring, chat, photos, PDF export, LL rule enforcement (pitch limits, rest days).
