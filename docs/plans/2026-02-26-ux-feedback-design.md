# UX Feedback Design — 2026-02-26

User testing revealed 17 issues across runner tracking, pitch management, play recording, position changes, and game flow. This document captures the approved design for all fixes.

## Section 1: Runner Tracking & Visualization

### 1a. Glover's Continuation Lines in Runner Cells

When a runner advances on a subsequent batter's play, the runner's own scoresheet cell must show continuation lines tracing their full journey around the bases.

**Example:** Player A singles (cell shows `home → 1st`). Player B singles, A advances to 2nd — A's cell now shows `home → 1st → 2nd`. Player C doubles, A scores — A's cell: `home → 1st → 2nd → 3rd → home` with yellow diamond fill.

**Implementation:**
- After `replayGame()`, compute a "runner journey" for each at-bat play: track every base the batter subsequently reaches (via other players' hits, SB, WP, etc.)
- `CellPlayData` gains `advancedTo: number[]` — full base sequence including initial reach and all subsequent advancement
- Diamond component draws the full path:
  - Original path (from batter's hit): solid blue line
  - Continuation path (from later advancement): dashed/lighter blue line
- If the runner scores at any point, diamond fills yellow

### 1b. RunnerConfirmation Shows Correct Initial Positions

Pass actual `baseRunners` from the snapshot *before* the pending play is applied. The modal must show where runners truly are before the play, not after default advancement.

### 1c. Prevent Backward Runner Movement

In RunnerConfirmation, disable destination base buttons that are "behind" the runner's current position. A runner on 2nd can go to 3rd, Home (scored), or Out — not back to 1st.

### 1d. Score Must Match Filled Diamonds

Investigate and fix score computation to ensure `scoreUs`/`scoreThem` on the snapshot match the count of yellow-filled diamonds on the scoresheet. Likely a bug in how `runsScoredOnPlay` or runner overrides factor into the total.

## Section 2: Cell Interaction — Play Detail Popover

### Behavior by Cell State

| Cell State | Tap Action |
|---|---|
| Filled (past play) | Show play detail popover |
| Current batter (highlighted) | Open Record Play panel |
| Empty (future) | No action |

### Play Detail Popover

New `PlayDetailPopover` component showing:
- Play notation in large text (e.g., "1B to RF")
- Pitch count summary (e.g., "1-2, 5 pitches")
- Runner movement on this play (e.g., "Runner A: 1st → 3rd")
- **Edit** button: Opens PlayEntryPanel pre-populated with the play's data
- **Undo** button: Removes this play and all subsequent plays (event-sourced) with confirmation dialog warning how many plays will be affected

Popover positioned relative to the tapped cell. Dismisses on outside tap. Only one popover open at a time.

## Section 3: Pitch Tracking Overhaul

### 3a. Persistent Pitch State in GamePage

- `currentAtBatPitches: PitchResult[]` lives in GamePage state (not PlayEntryPanel)
- Passed to PlayEntryPanel as prop with `onAddPitch`/`onRemovePitch` callbacks
- Survives PlayEntryPanel open/close cycles
- Cleared when: play is recorded OR current batter changes (half-inning change / batting order advance)
- Any recorded play (1B, GO, DP, etc.) carries the accumulated pitches with it

### 3b. Auto-Walk on 4th Ball

When pitch count reaches 4 balls:
- Automatically record BB with accumulated pitches
- No user interaction needed — walk is final

### 3c. Auto-Strikeout on 3rd Strike

When a `'S'` pitch brings the count to 3 strikes:
- Show quick confirmation: "Strikeout looking (ꓘ) or swinging (K)?"
- User picks → auto-record with accumulated pitches
- Fouls on 2 strikes do NOT trigger this — only `'S'` pitches

### 3d. Clear Count with Confirmation

"Clear Count" button in PitchTracker. On tap: "Are you sure? This clears X tracked pitches." with Confirm/Cancel. Resets `currentAtBatPitches` to `[]`.

### 3e. Editable Pitch Count

- Individual pitch dots tappable to remove (small "x" on hover/tap)
- Edit icon next to count opens edit mode:
  - Full sequence visible (B, S, F, B, S...)
  - Tap any pitch to cycle type (B → S → F → B) or remove
  - Add pitches at any position
- Full control over pitch accuracy

## Section 4: Contextual Play Options & Rules

### 4a. Disable Impossible Plays (No Runners)

When bases are empty, disable (gray out, not hide) these buttons:
- FC, SAC, DP, SB, WP, PB, BK

Disabled buttons show tooltip on tap: "Requires runners on base"

### 4b. Error Asks for Position

Tapping **E** button opens FieldDiagram immediately (same as fielding plays). User taps the position that made the error. Single position only. Notation becomes "E6", "E4", etc.

### 4c. Sac Fly Cannot Be Third Out

SAC button disabled when `snapshot.outs === 2`. In LL (and MLB), a sacrifice fly resulting in the third out is scored as a fly out, not a sacrifice.

### 4d. DP Requires Runners

Covered by 4a — DP disabled when bases empty.

## Section 5: Position Changes & Pitcher Tracking

### 5a. Dedicated Position Change Button

Add "Pos Change" button in game action bar alongside Record Play and Substitution.

### 5b. Position Change Dialog Flow

1. Select player from dropdown/list (shows current position)
2. Select new position via FieldDiagram
3. Auto-detect who holds the target position
4. Show swap confirmation: "Smith (#12) P → SS, Jones (#7) SS → P — Confirm?"
5. Record on both players' lineup slots with inning/half metadata

### 5c. Pitcher Change Impact

- ScoreSummary updates to show new pitcher name
- Pitch count reflects new pitcher's count (already tracked per pitcher in `pitchCountByPitcher` map)
- `currentAtBatPitches` NOT cleared (at-bat still in progress)

### 5d. Data Model

Position changes stored as entries in lineup slot's `substitutions` array with `positionOnly: true` flag. Reuses existing substitution infrastructure.

## Section 6: Game Flow Fixes

### 6a. Backwards K on Button

"KL" button in PlayEntryPanel renders as mirrored K using CSS `transform: scaleX(-1)`. Internal value remains 'KL'.

### 6b. Walk-Off / Skip Bottom of Last Inning

After 3rd out in top of final inning (6+): if home team is already winning, game ends immediately — no bottom half played. `isGameOver = true` set in engine.

Walk-off during bottom half: if home team takes the lead during bottom of 6th+, game ends immediately after that play.

### 6c. Navigation After Game Over

- Add "Home" button to game-over overlay (alongside View Stats, Back to Scoresheet)
- Add persistent back-arrow/Home button in game header bar (always visible, not just on overlay)
