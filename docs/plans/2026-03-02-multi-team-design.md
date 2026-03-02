# Multi-Team Support Design

> **Date:** 2026-03-02
> **Status:** Approved

## Overview

Evolve the app from a single "home team" model to a symmetric multi-team model. Any number of teams can be managed, and games are scored between any two of them. This supports the **league scorekeeper** use case — an independent scorekeeper managing rosters and games for an entire league.

## Key Decisions

- **League scorekeeper model:** All teams are equal. No "my team" vs "opponent" distinction.
- **Every game has two real teams:** Both sides reference managed team rosters. No more ad-hoc inline opponents.
- **Create teams on-the-fly:** During game setup, a new team can be created if it doesn't already exist. Quick roster entry, then return to setup.
- **Per-team stats:** Each team has its own season stats page. No "favorite" or "primary" team concept.
- **No data migration needed:** Only test data exists. Fresh schema with Dexie version bump.

## Data Model Changes

### Game

```
Before:
  teamId: number              // "our" team
  opponentName: string        // opponent as a string
  homeOrAway: 'home' | 'away' // relative to "us"

After:
  team1Id: number             // first team
  team2Id: number             // second team
  homeTeamId: number          // which team is home (must be team1Id or team2Id)
```

`team1Id` and `team2Id` are interchangeable — neither is privileged. `homeTeamId` determines batting order (home bats bottom).

### Lineup.side

```
Before: 'us' | 'them'
After:  'home' | 'away'
```

Home/away has inherent meaning: home always bats bottom half, away always bats top half. This eliminates the need for a `homeOrAway` field on Game.

### LineupSlot

`playerId` is always populated. Both teams have real rosters — no more `null` playerIds for opponent players.

### Team, Player, Play

No structural changes. Team and Player types remain as-is. Play still uses `half: 'top' | 'bottom'`.

## Engine Changes

### replayGame signature

```
Before: replayGame(plays, lineupUs, lineupThem, homeOrAway)
After:  replayGame(plays, lineupHome, lineupAway)
```

The 4th `homeOrAway` parameter is eliminated. The lineup positions inherently carry home/away information:
- `lineupHome` → bats bottom
- `lineupAway` → bats top

### GameSnapshot renames

All `Us`/`Them` suffixed fields rename to `Home`/`Away`:
- `currentBatterUs` → `currentBatterHome`
- `currentBatterThem` → `currentBatterAway`
- `runsPerInningUs` → `runsPerInningHome`
- `runsPerInningThem` → `runsPerInningAway`
- `outsUs` → `outsHome`
- `outsThem` → `outsAway`
- etc.

### Other engine functions

- `computeRunnerJourneys` drops `homeOrAway` param, takes `(plays, lineupHome, lineupAway)`
- Walk-off and skip-bottom logic unchanged (already keyed off top/bottom halves)
- `computePlayerStats` unchanged (operates per order position)

## GameContext Changes

- Stores `lineupHome` and `lineupAway` (not `lineupUs`/`lineupThem`)
- `loadGame` fetches lineups by `side: 'home' | 'away'`
- `recompute` passes `lineupHome`, `lineupAway` — no 4th arg
- Also loads both `Team` objects so UI can display team names

## Database Changes

### Schema (Dexie version 2)

```
games: '++id, team1Id, team2Id, code, status'
```

Replace `teamId` index with `team1Id` and `team2Id`.

### Querying games for a team

`getGamesForTeam(teamId)` needs to match where `team1Id === teamId || team2Id === teamId`. Dexie supports this via `.where('team1Id').equals(teamId).or('team2Id').equals(teamId)`.

### No migration

Only test data exists. Bump Dexie version, define new schema, start fresh.

## Game Service Changes

- `createGame(team1Id, team2Id, homeTeamId)` — replaces `createGame(teamId, opponentName, homeOrAway)`
- `getGamesForTeam(teamId)` — query across both `team1Id` and `team2Id`
- Team CRUD unchanged
- Player CRUD unchanged

## Game Setup Flow

1. User taps "New Game"
2. Picks **away team** (from team list, or "Create New Team")
3. Picks **home team** (from team list, or "Create New Team")
4. "Create New Team": enter name → quick roster entry (name, number, position per player) → save → return to game setup
5. Game created with `team1Id`, `team2Id`, `homeTeamId`

### Lineup setup

- Two tabs/sections: "Away Lineup" and "Home Lineup"
- Each pulls from its team's roster
- Drag to reorder batting order, assign positions
- Both teams treated identically

## Page & Route Changes

### Routes

```
/                       → Home (all games, team management entry)
/teams                  → Team list
/teams/:teamId          → Single team roster management
/game/:gameId/setup     → Game setup (pick teams, build lineups)
/game/:gameId           → Scoresheet
/game/:gameId/stats     → Post-game stats
/stats                  → Season stats (with team selector)
```

### Page changes

- **HomePage:** Shows all games across all teams (Team A vs Team B). Link to team management.
- **TeamPage → TeamsPage + TeamDetailPage:** Multi-team list with tap-to-edit roster.
- **GameSetupPage:** Pick two teams, build both lineups from rosters.
- **GamePage:** Tabs show team names instead of "Us"/"Them". Scoring logic unchanged.
- **SeasonStatsPage:** Team selector dropdown. Shows cumulative stats for selected team.
- **GameStatsPage:** Already shows both teams' stats — no change needed.

### UX details

Detailed navigation layout and component design will be refined using the UX skill during implementation.

## What Doesn't Change

- **Play type** — still uses `half: 'top' | 'bottom'`, no team references
- **Scoring engine logic** — same event-log replay, just renamed parameters
- **Pitch tracking** — unchanged
- **Substitutions** — unchanged (both teams already support subs)
- **Runner confirmation** — unchanged
- **Undo/edit** — unchanged (event-log replay)
- **PWA/offline** — unchanged
- **Game code sync** — unchanged
