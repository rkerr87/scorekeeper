# Error Play Redesign

## Problem

Errors in baseball don't always result in the batter reaching base. Currently, recording an E always sets `isAtBat: true` and `basesReached: [1]`. In reality:

1. **Non-at-bat errors** — e.g., catcher overthrows back to the pitcher; runners advance but the batter stays at bat with the same count and pitch history.
2. **Batter-reaching errors** — batter reaches 1st, 2nd, or 3rd on the error.

## Design

### Flow

1. User taps **E** in the Special tab
2. User taps the fielder who committed the error (existing fielding mode)
3. New step: a "batter outcome" screen asks what happened:
   - **"Stayed at bat"** — `isAtBat: false`, `basesReached: []`. RunnerConfirmation appears if runners on base. Pitches preserved.
   - **"Reached base"** — `isAtBat: true`, `basesReached: [1]`. RunnerConfirmation appears (with batter section for advancement to 1st/2nd/3rd), even with empty bases.

### Data Model

No changes. The existing `isAtBat` flag and `basesReached` handle both cases. A "stayed at bat" error is functionally identical to WP/PB/BK from the engine's perspective.

### Pitch Preservation

When "Stayed at bat" is chosen, `GamePage` must not clear `currentAtBatPitches`. Non-at-bat plays already skip pitch clearing — the key is that the E play carries `isAtBat: false`.

### Shorthand

`parseShorthand("E6")` keeps current behavior: batter reaches 1st. Experienced scorekeepers using shorthand can type what they need.

### Files Changed

- `PlayEntryPanel.tsx` — add `'error-batter-outcome'` panel mode after fielder selection; two buttons for the outcome
- `GamePage.tsx` — include E in `isHitReachingBase` check (renamed) so RunnerConfirmation shows with batter section; preserve pitches for non-at-bat E
- `PlayEntryPanel.test.tsx` — test both E outcomes
- `GamePage.test.tsx` — test pitch preservation for non-at-bat E

## Implementation Tasks

### Task 1: Add batter outcome step to PlayEntryPanel

- Add `'error-batter-outcome'` to `PanelMode` union
- After fielder confirmed for E, transition to `error-batter-outcome` mode instead of calling `onPlayRecorded`
- Store selected fielder positions in state for use after outcome choice
- "Stayed at bat" calls `onPlayRecorded` with `isAtBat: false, basesReached: []`
- "Reached base" calls `onPlayRecorded` with `isAtBat: true, basesReached: [1]`

### Task 2: Wire GamePage for E batter advancement and pitch preservation

- Include E in the condition that triggers RunnerConfirmation with batter section (when `isAtBat: true`)
- Ensure non-at-bat E (`isAtBat: false`) does not clear `currentAtBatPitches`
- Non-at-bat E with runners on base still shows RunnerConfirmation (already handled — E is in `affectsRunners` list)
