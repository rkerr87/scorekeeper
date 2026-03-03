# Lineup Editing at Game Setup — Design

## Problem

When starting a new game, the setup page auto-includes every roster player with their default position. There's no way to:
- Exclude absent players
- Change defensive positions before the game starts
- Add a guest or new player who isn't on the roster

## Approach

Enhance the existing `GameSetupPage` with inline editing. No modals, no new pages.

## Data Model

**No changes to `LineupSlot`, `Lineup`, or any engine types.** The lineup already stores exactly the players who are playing — excluded players simply don't get a slot.

**Guest (game-only) players** get a temporary negative ID (e.g. `-Date.now()`) as their `playerId` in the `LineupSlot`. The engine and scoresheet work with `playerId` as a number and don't care whether it's a real DB ID.

**"Save to roster" players** get added via `addPlayer()` first, yielding a real DB ID for the `LineupSlot`.

## UI Changes

### Player Row

Each row in the batting order displays:
- Drag handle (existing)
- Order number (existing)
- Player name (existing)
- Jersey # (existing)
- **Position abbreviation** — tappable. Opens a small dropdown with the 9 standard positions (P, C, 1B, 2B, 3B, SS, LF, CF, RF). Selecting one updates that player's position for this game only.
- **Remove button** (X icon) — moves the player to the bench section

### Bench Section

Appears below each team's batting order when at least one player is excluded:
- Header: "Not Playing (N)" with count
- Each benched player shows: name, jersey #, and an add-back button (+ icon)
- Clicking add back appends the player to the bottom of the batting order

### Add Player

Button at the bottom of each team's column, below the bench:
- Opens an inline form: name, jersey #, position dropdown
- Checkbox: "Add to team roster" (checked by default)
- Save creates the player and appends them to the batting order

### Warnings

Shown above the Start Game button, yellow non-blocking style:
- "No pitcher assigned" if no active player has position P
- "Duplicate position: XX" if two active players share a position

## State Management

All new state is local to `GameSetupPage`:

| State | Type | Purpose |
|-------|------|---------|
| `homeBench` / `awayBench` | `number[]` | Player IDs excluded from lineup |
| `homePositions` / `awayPositions` | `Map<number, string>` | Position overrides (playerId → position) |
| `homeGuestPlayers` / `awayGuestPlayers` | `Player[]` | Temp players with negative IDs |
| `addingPlayerSide` | `'home' \| 'away' \| null` | Which add-player form is open |

### Start Game Flow

1. For each guest player with "save to roster" checked: call `addPlayer()`, get real DB ID, update `LineupSlot.playerId`
2. Build `LineupSlot[]` from batting order, using position overrides (falling back to `defaultPosition`)
3. Guest players without "save to roster" keep their negative temp ID
4. Save lineups and start game (existing flow)

## No Changes Needed

- `gameService.ts` — `saveLineup` already accepts arbitrary `LineupSlot[]`
- `engine.ts` — `replayGame` doesn't reference player IDs
- `GameContext` — unchanged
- `Scoresheet` / `AtBatCell` — read from `LineupSlot`, which has correct data

## Testing

Component tests for:
- Remove player → appears in bench, batting order shrinks
- Add back from bench → returns to batting order
- Position tap → dropdown appears, selecting updates position
- Add guest player → appears in batting order
- Warnings display for missing pitcher and duplicate positions
