# Little League Scorekeeper App — Design Document v2

**Date:** 2026-02-22
**Status:** Approved
**Supersedes:** 2026-02-21-scorekeeper-design.md
**Target Users:** Primary scorekeeper (experienced) + volunteer scorekeepers (varying experience)
**Division:** Little League Major (10-12 years old)

---

## Overview

A Progressive Web App that mirrors the Glover's paper scorebook, enabling fast, intuitive scorekeeping for both teams during a game. Designed for mixed device use (tablets, laptops, phones), offline-first operation, and easy handoffs between volunteers via game codes.

---

## Technology Stack

- **React 19** + TypeScript
- **Vite** (bundler & dev server)
- **Tailwind CSS v4** (CSS-native config, `@import "tailwindcss"`)
- **Dexie.js** (IndexedDB wrapper for offline persistence)
- **react-router-dom** (URL-based routing with history support)
- **vite-plugin-pwa** (service worker, offline caching, install prompt)
- **vitest** + @testing-library/react (testing)
- **SVG** for diamond/baserunning/field rendering

**State management:** Game engine (pure functions) + Dexie (persistence) + React Context (component distribution). No external state library.

**Not included yet:** @supabase/supabase-js (sync interface is built but transport is stubbed until Supabase project is set up)

---

## Architecture: Game Engine + Event Log

### Core Pattern

All game logic lives in a pure **game engine** module — no React, no Dexie, no UI. The engine takes a list of plays and lineups, replays them, and returns the current game state.

```
replayGame(plays: Play[], lineupUs: Lineup, lineupThem: Lineup) → GameSnapshot
```

### Play Event Log

Plays are stored as an ordered event log with a `sequenceNumber` for global ordering. The current game state (GameSnapshot) is always computed by replaying all plays through the engine. No stale snapshots.

### Undo / Edit

- **Undo:** Remove last play from the list, call `replayGame()` with the shorter list.
- **Edit:** Replace a play at its sequence position, call `replayGame()` to recompute from scratch.
- A 6-inning LL game has ~60-80 plays max. Replay is instant.

### Data Flow

```
User records play → Validate → Save Play to Dexie → Replay all plays through engine → GameSnapshot → React Context → UI re-renders
```

---

## Data Model

### Team
- id, name, createdAt

### Player
- id, teamId, name, jerseyNumber, defaultPosition, createdAt

### Game
- id, teamId, code (6-char share code), date, opponentName, homeOrAway, status (draft / in_progress / completed), createdAt, updatedAt

### Lineup
- id, gameId, side ("us" | "them"), battingOrder (array of LineupSlot)

### LineupSlot
- orderPosition (1-9+), playerId (nullable — opponent players are inline), playerName, jerseyNumber, position, substitutions (array of Substitution)

### Substitution
- inning, half, newPlayerName, newJerseyNumber, newPosition

### Play (Event Log)
- id, gameId, sequenceNumber (global ordering), inning, half, batterOrderPosition, playType, notation (display string like "6-3"), fieldersInvolved (position numbers), basesReached (bases the batter reached), runsScoredOnPlay, rbis, pitches (array of "B" | "S" | "F"), pitchCount (derived from pitches.length), isAtBat (false for SB/WP/PB/BK), timestamp

### GameSnapshot (Computed — never stored)
- inning, half, outs, scoreUs, scoreThem, currentBatterOrderPositionUs, currentBatterOrderPositionThem, baseRunners ({first, second, third} — each nullable player reference), pitchCountByPitcher (map of pitcher → cumulative count), runsPerInning (array)

### Key Design Decisions

- **Lineup is separate from Roster.** Batting order is set per-game. Opponents have lineups too.
- **Opponent players are inline.** No separate opponent table — just name/number/position in lineup slots. We don't track opponent stats across seasons.
- **GameSnapshot is computed, not stored.** Derived by replaying plays through the engine. Single source of truth.
- **`isAtBat` flag** distinguishes plays that advance the batting order (K, 1B, BB, etc.) from mid-at-bat events (SB, WP, PB, BK).

---

## Game Engine Details

### What the Engine Handles

**Batting order cycling:**
- Tracks current batter position per side (us/them)
- Advances to next batter after each at-bat play (not after SB/WP/PB/BK)
- Wraps from position 9 → 1 (or handles continuous batting order)

**Out tracking & inning advancement:**
- Counts outs per half-inning
- On 3rd out: clears bases, resets outs to 0, flips half-inning
- Bottom → top advances the inning number

**Base runner management:**
- Tracks who's on first, second, third
- Applies default advancement rules per play type:
  - Single: batter to 1st, force-advance runners
  - Double: batter to 2nd, score runners from 2nd/3rd
  - Triple: batter to 3rd, score all runners
  - HR: everyone scores
  - Walk/HBP: batter to 1st, force-advance only
  - SB/WP/PB: advance specified runner(s)
- Clears runners who score

**Run scoring:**
- Counts runs as runners cross home
- Attributes RBIs to batter where applicable
- Updates per-inning run totals and running score

**Pitch count:**
- Per-pitch B/S/F tracking during at-bats
- Per-at-bat pitch arrays stored on Play records
- Cumulative per-pitcher totals computed by summing across plays

### What the Engine Does NOT Handle

- UI rendering
- Database persistence
- Input validation (separate validation layer)
- Complex judgment-call baserunner scenarios (scorekeeper adjusts via confirm runners step)

### Baserunner Confirmation

After recording a play, engine applies default runner advancement. A "confirm runners" step shows the scorekeeper where runners were placed. Scorekeeper can adjust before finalizing. This keeps the engine simple while giving full control.

---

## UI Architecture

### Routing

```
/                   → Home (start game, resume game, enter game code, manage roster)
/team               → Team roster management
/game/:id/setup     → Pre-game setup (batting order, positions, opponent lineup)
/game/:id           → Main scoresheet (primary view during a game)
/game/:id/stats     → Post-game / season stats view
```

### Main Scoresheet Layout (Mirrors Glover's Scorebook)

**Top bar:**
- Inning indicator (e.g., "Top of 3")
- Outs (visual dots)
- Running score
- Current pitcher + cumulative pitch count
- Home/Away tab toggle to switch scoresheets

**Left column:**
- Batting order: # | Pos | Name
- Substitution rows below each slot

**Grid:**
- One column per inning (starts at 6, auto-expands to 7+)
- Each cell contains:
  - SVG diamond with baserunner paths drawn
  - Play notation text (1B, 6-3, K, etc.)
  - Pitch tracking dots (B/S indicators matching Glover's)
  - Filled/colored diamond when run scored

**Right summary columns:** AB, R, H, RBI, BB, K (computed live from plays)

**Bottom row:** Runs per inning totals, running game score

**Bottom action area:** Record Play button, Undo button, current batter indicator

### Play Entry Flow

1. Tap "Record Play" (or tap current batter's cell)
2. **Pitch tracking panel** — B/S buttons to count pitches in real-time as they're thrown
3. **Outcome buttons:**
   - Row 1 (common): K, backwards-K, BB, HBP, 1B, 2B, 3B, HR
   - Row 2 (fielding): Ground out, Fly out, Line out, Pop out → field diagram
   - Row 3 (special): FC, E, DP, SB, WP, PB, BK → guided sub-flows
4. For fielding plays: field diagram with 9 positions, tap fielder → tap throw target → notation generated (e.g., "6-3")
5. **Confirm runners step** — shows engine's default runner placement, scorekeeper adjusts if needed
6. Play saved, scoresheet updates, advance to next batter

**Shorthand input:** Text field for experienced scorekeepers to type "6-3", "1B7", etc. Parser converts to structured play data.

### Beginner Mode

Togglable in settings. When enabled:
- After each play, enlarged annotation panel shows what was recorded
- Labels explain notation (e.g., "6-3 means groundout, shortstop to first baseman")
- Panel stays visible until dismissed

### Responsive Design

- **Tablet/laptop (primary):** Full scoresheet visible, play entry as right sidebar
- **Phone:** Horizontal scroll on grid, play entry slides up from bottom, current at-bat cell auto-focused

---

## Substitution Tracking

Full substitution support:
- Mid-game, scorekeeper can substitute a player at any lineup position
- Records: inning, half, new player name/number/position
- Scoresheet shows substitution notation in the lineup column (matching Glover's style)
- Original player tracked for re-entry eligibility (LL allows one re-entry)

---

## Offline & Sync Strategy

### Offline-First

- Dexie (IndexedDB) is the primary data store — everything works with zero network
- Service worker caches app shell on first visit
- Full game can be scored, saved, and resumed without ever going online

### Game Code Sync (Interface Built, Transport Stubbed)

**SyncService interface:**
- `uploadGame(gameId) → gameCode` — serializes game data to JSON, returns 6-char code
- `downloadGame(gameCode) → gameData` — fetches game data by code, imports into local IndexedDB
- `generateGameCode() → string` — produces codes like "MUDH-0421"

Currently serializes to JSON locally. When Supabase is set up, swap the transport layer without touching game logic or UI.

**Conflict resolution:** Last-write-wins by timestamp. Warn user if conflicts detected. No merge UI.

### PWA Setup

- vite-plugin-pwa with registerType: 'autoUpdate'
- Manifest with proper icons (192x192, 512x512)
- Installable to home screen

### What Doesn't Sync

- UI preferences (beginner mode, theme) — localStorage only

---

## Season Stats

All stats derived from the play event log — no separate stats tables.

### Per-Player Batting Stats
- G, AB, R, H, 2B, 3B, HR, RBI, BB, K, AVG, OBP, SLG
- AB excludes walks, HBP, sacrifices (computed from `isAtBat` flag)

### Per-Game Stats
- Live in scoresheet right summary columns (AB, R, H, RBI, BB, K)
- Update as plays are recorded

### Game History
- Home screen lists past games (date, opponent, score, status)
- Tap completed game for read-only scoresheet
- Tap in-progress game to resume

### Season View
- Cumulative stats table for all players across all games
- Sortable by any stat column
- Your team only (opponents are ephemeral)

---

## Pitch Count Tracking

- Every pitch tracked as B (ball), S (strike), or F (foul) during at-bat
- Play entry panel has B/S buttons for real-time tracking
- Per-at-bat pitch array stored on Play record
- Cumulative per-pitcher total computed and displayed in top bar
- Scoresheet cells show pitch sequence dots (matching Glover's B/S boxes)
- Does NOT enforce LL pitch count limits or rest day rules

---

## Undo & Error Recovery

### Undo Last Play
- Always-visible button
- Removes last play from event log, engine recomputes snapshot
- Instant, works offline

### Edit Any Cell
- Tap any past at-bat cell to reopen play entry
- Pre-fills with recorded play data
- Modify and confirm → replaces play in event log → engine recomputes entire game state
- Downstream runner positions recomputed automatically (advantage of event-log architecture)

---

## MVP Scope

**Included:**
- Single-team roster management
- New game creation, in-progress game resumption
- Full play-by-play scoring for both teams
- High-fidelity Glover's-style scoresheet cells (SVG diamond, paths, pitch dots, notation)
- Visual field diagram for fielding plays
- Common-play buttons + field diagram + shorthand input
- Per-pitch tracking (B/S/F) with cumulative pitcher count
- Full substitution tracking
- Baserunner tracking with confirmation step
- Undo last play + edit any cell (event-log replay)
- Beginner mode with notation explanations
- Game code sync interface (transport stubbed)
- Offline-first with IndexedDB + service worker
- Season cumulative stats (AB, R, H, 2B, 3B, HR, RBI, BB, K, AVG, OBP, SLG)
- Responsive design (tablet-first, phone-usable)

**Not included:**
- Multiple teams
- Supabase backend (interface ready, transport stubbed)
- Real-time multi-user scoring
- Chat/comments
- Photo uploads
- Export to PDF/MLB box scores
- LL rule enforcement (pitch limits, rest days)

---

## Reference Materials

- `docs/scoresheet_layout.jpeg` — Glover's scorebook layout
- `docs/scoring_guide.jpeg` — Glover's scoring symbols and examples
