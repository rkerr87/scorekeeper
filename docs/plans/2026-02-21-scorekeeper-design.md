# Little League Scorekeeper App - Design Document

**Date:** 2026-02-21
**Status:** Approved
**Target Users:** Primary scorekeeper (experienced) + volunteer scorekeepers (varying experience)
**Division:** Little League Major (10-12 years old)

---

## Overview

A Progressive Web App (PWA) that mirrors the Glover's paper scorebook, enabling fast, intuitive scorekeeping for both teams during a game. Designed for mixed device use (tablets, laptops, phones), offline-first operation, and easy handoffs between volunteers via game codes.

---

## Platform & Architecture

### Technology Stack

**Frontend:**
- React 18 + TypeScript
- Vite (bundler & dev server)
- Tailwind CSS (utility styling)
- vite-plugin-pwa (service worker, offline caching, install prompt)
- SVG for diamond/baserunning rendering

**Backend:**
- Supabase (hosted Postgres + REST API)
- No authentication — game codes are the access mechanism
- Tables: `teams`, `players`, `games`, `game_state`

**Offline & Sync:**
- IndexedDB for local game state (via Dexie.js or native `idb`)
- Service worker caches app shell on first visit
- Manual sync via game codes (upload/download triggers)

### Responsive Design

- **Tablet/laptop-first:** Scoresheet mirrors paper layout almost 1:1
- **Phone:** Horizontal scroll on grid, current at-bat cell auto-focused, larger touch targets
- Works across all screen sizes without breaking functionality

---

## Core User Flows

### 1. Game Manager (Home Screen)

Users can:
- Start a new game
- Resume in-progress game (from local storage)
- Enter game code to load a shared game from another scorekeeper
- Access team roster management
- View past game history and season cumulative stats

### 2. Pre-Game Setup

1. Select home or away for your team
2. Load saved team roster; set batting order and positions for today
3. Enter opponent team lineup (last name, jersey number, position only)
4. Confirm and start game

---

## Main Scoresheet UI

### Layout (Mirrors Glover's Scorebook)

**Header:**
- Inning indicator (e.g., "Top of 3")
- Outs (0, 1, or 2)
- Running score (Your Team vs. Opponent)
- Pitcher pitch count (e.g., "P: 47")
- Home/Away toggle tabs to switch between scoresheets

**Main Grid:**
- **Left column:** Current batting team's lineup (name, jersey #, position)
- **Grid columns:** One column per inning (1-6, expandable to 7+ if needed)
- **Grid rows:** One row per batter in the lineup
- **Cells:** Each at-bat cell contains:
  - SVG diamond for baserunning paths
  - Play notation (1B, 6-3, K, etc.)
  - Pitch tracking dots/checkboxes (optional)
  - Runs indicator (filled diamond = run scored)

**Right-side summary columns:**
- AB (at-bats), R (runs), H (hits), RBI, BB (walks), K (strikeouts)

**Bottom row:**
- Runs per inning summary
- Running game score

### Cell Details

Each at-bat cell displays:
- **Baserunning path:** SVG lines drawn from home plate showing which bases reached
- **Result notation:** K, 1B, 2B, 1B7 (single to RF), 6-3 (groundout SS to 1B), etc.
- **Pitch tracking (optional toggle):** Small boxes for B/S tracking within each cell
- **Run scoring:** Filled/colored diamond indicates run scored, with notation of who drove it in

### Current Batter Highlight

The batter currently at the plate has their row highlighted or enlarged slightly for visibility.

---

## Play Entry Interface

### Layout

- **Mobile:** Slides up from bottom as a modal/panel
- **Tablet/Laptop:** Sidebar on right side or modal overlay

### Entry Options (In Order of Frequency)

**Row 1 — Common Outcomes (most games use these heavily):**
- K (strikeout)
- ꓘ (strikeout looking / called third strike)
- BB (walk)
- HBP (hit by pitch)
- 1B (single)
- 2B (double)
- 3B (triple)
- HR (home run)

**Row 2 — Fielding Plays:**
- "Ground out" → visual field diagram
- "Fly out" → visual field diagram
- "Line out" → visual field diagram
- "Pop out" → visual field diagram

**Row 3 — Special Plays:**
- FC (fielder's choice)
- E (error)
- DP (double play) → guided flow
- SB (stolen base)
- WP (wild pitch)
- PB (passed ball)
- BK (balk)

### Visual Field Diagram (For Fielding Plays)

When scorekeeper taps a fielding play:
1. Baseball diamond appears with 9 labeled positions (1-9)
2. **First tap:** Select fielder who fielded the ball
3. **Second tap (optional):** Select fielder ball was thrown to
4. **Confirm:** App translates position taps to notation (e.g., 6 → 3 = "6-3")
5. If only one fielder tapped (e.g., caught flyball), play is recorded with just that position

### Optional Shorthand Input

Text field allows experienced scorekeepers to type directly:
- "6-3" (groundout SS to 1B)
- "K" (strikeout)
- "1B7" (single to RF)
- "2-6-3" (double play catcher to SS to 1B)

Parser converts shorthand to structured play data.

### Undo & Edit

**Undo button:**
- Always visible in top bar or play panel
- Reverts the most recent play entry
- One tap, instant

**Edit any cell:**
- Tap any past at-bat cell to re-open play entry
- Cell pre-fills with recorded play
- User modifies and confirms
- Updates game state immediately

---

## Beginner Mode & Paper Guidance

### Togglable Beginner Mode

When enabled:
- After each play entry, a guidance panel appears
- Shows an SVG diamond with exactly what was just recorded
- **Example:** If single to right field entered, shows line from home → first, with "1B9" label
- Panel auto-hides after 3 seconds (or user dismisses) when off
- Panel stays visible for every play when beginner mode is on

### Purpose

Helps new scorekeepers learn paper notation in real-time. If they need to keep a paper record alongside the app, they can reference the digital marking and copy it.

---

## Data Model

### Database (Supabase)

**teams**
- id, name, created_at

**players**
- id, team_id, name, jersey_number, position, created_at

**games**
- id, team_id, code (6-char shareable code), date, opponent_name, home_or_away, final_score_us, final_score_them, status (draft / in_progress / completed), created_at, updated_at

**game_state**
- id, game_id, inning, half (top / bottom), batter_player_id, play_type (K, 1B, 2B, 3B, HR, FC, E, DP, SB, WP, PB, BK, etc.), fielders_involved (array of position numbers, e.g., [6, 3]), result_bases_reached (array of positions runners reached), runs_scored, rbi_count, pitch_count, timestamp

### Local Storage (IndexedDB)

Mirrors the above schema for offline use. Syncs bidirectionally with Supabase when online.

### Season Stats (Computed)

Per-player cumulative stats computed from all games:
- AB, R, H, RBI, BB, K, AVG, OBP, SLG
- Displayed on season overview and game history screens

---

## Offline & Sync Strategy

### Offline-First

- App shell cached by service worker on first visit
- All game state lives in IndexedDB while playing
- No network required to score a full game
- Works seamlessly at fields with zero connectivity

### Game Code Sync

**Upload (Share a game):**
1. Scorekeeper finishes inning or session
2. Taps "Save & Share Game" button
3. App generates 6-character code (e.g., "MUDH-0421")
4. Code is displayed and copied to clipboard
5. Scorekeeper shares code with next volunteer (via text, Slack, etc.)
6. Game state uploads to Supabase

**Download (Resume a game):**
1. Volunteer opens app, sees "Enter Game Code" field
2. Types in code
3. App fetches game state from Supabase
4. Merges with local data (timestamp-based conflict resolution)
5. Scorekeeper picks up where previous scorer left off

### Conflict Resolution

If both scorekeepers edited the same inning offline:
- Most recent timestamp wins (last write wins)
- User warned if conflicts detected
- No formal merge UI — keeping it simple

### What Syncs

- Complete game state (all plays, runs, pitch counts, outs)
- Player roster and batting order
- Game metadata (opponent, date, score, inning)

### What Doesn't Sync

- Session preferences (beginner mode on/off, theme) — local only per device

---

## Pitch Count Tracking

**Scope:** MVP tracks pitch counts; does NOT enforce Little League limits.

### Implementation

- Every pitch (ball, strike, foul) increments current pitcher's total
- Running pitch count displayed in top bar (e.g., "P: 47")
- Per-game pitch count stored in `game_state`
- Per-pitcher cumulative pitch counts available in season stats

---

## Undo & Error Recovery

### Undo Last Play

- Always-visible button (top bar or play entry area)
- Reverts most recent play entry immediately
- Works offline and syncs when online

### Edit Any Cell

- Tap any past at-bat cell to reopen play entry flow
- Cell pre-fills with the recorded play (e.g., "1B" or "6-3")
- User modifies and confirms
- Updates game state immediately
- No formal change log; just overwrite previous entry

### Edge Cases

- If edited play changes a baserunner result (e.g., single → double), downstream runner positions are NOT auto-corrected
- Scorekeeper must manually fix runner positions if play changes
- Keeps logic simple; scorekeeping is inherently manual

---

## Design Decisions & Rationale

### Why PWA?

- Zero friction for volunteers (just share a link, no app store)
- Offline support for spotty field connectivity
- Works on any device (phone, tablet, laptop)
- Can be "installed" to home screen
- One codebase, no separate iOS/Android builds

### Why React + Supabase?

- React's component model fits the interactive grid UI naturally
- Tailwind enables responsive design without custom CSS
- Supabase provides auth-free backend (game codes as keys) with minimal setup
- Dexie.js simplifies IndexedDB for offline state

### Why Paper-First Design?

- Parity with official scorebook helps experienced scorekeepers verify data
- Visual consistency reduces learning curve for beginners
- Can be used as reference while keeping a paper backup

### Why Game Codes Instead of Accounts?

- No login friction — critical for one-game volunteers
- Simple, memorable, shareable
- Works with offline-first model (code is lookup key, not session token)

### Why Beginner Mode?

- Builds confidence in new scorekeepers by showing them paper notation in real-time
- Optional and dismissible — doesn't slow down experienced users
- Encourages volunteers to keep learning

---

## MVP Scope (Phase 1)

**Included:**
- Single-team roster management
- New game creation, in-progress game resumption
- Full play-by-play scoring for both teams
- Visual field diagram for fielding plays
- Common-play buttons + guided flows + optional shorthand input
- Pitch count tracking (no limits)
- Undo last play + edit any cell
- Beginner mode with paper guidance
- Game code sync (manual upload/download)
- Offline-first with IndexedDB + service worker
- Season cumulative stats (simple: AB, R, H, RBI, BB, K)
- Responsive design (tablet-first, phone-usable)

**Not Included:**
- Multiple teams
- Chat/comments on games
- Photo uploads of lineups
- Detailed play-by-play replays
- Real-time multi-user scoring (only handoff via code)
- Export to MLB-style box scores
- Little League rule enforcement (pitch count limits, rest days)
- Mobile-only optimized layout (phone works, but not first-class)

---

## Success Criteria

1. ✓ Scorekeeper can complete a full 6-inning game without network
2. ✓ Both experienced and first-time volunteers can record plays intuitively
3. ✓ Game state can be handed off mid-game via game code
4. ✓ Paper scoresheet parity — digital record matches paper layout
5. ✓ Pitch counts are accurately tracked
6. ✓ Team roster and stats persist across multiple games in a season

---

## Open Questions / Future Enhancements

- Player photos for easier lineup reference?
- Export to PDF scorebook page?
- Real-time game score display (scoreboard integration)?
- Mobile app notification for game updates?
- League standings/standings management?

---

## Appendix: Reference Materials

- `docs/scoresheet_layout.jpeg` — Glover's scorebook layout
- `docs/scoring_guide.jpeg` — Glover's scoring symbols and examples
- `docs/ll_scoring_guide.txt` — Comprehensive Little League scoring rules
