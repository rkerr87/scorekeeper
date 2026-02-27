# Game Deletion — Design Doc

**Date:** 2026-02-26
**Status:** Approved

## Summary

Add the ability to delete games from the home page game list. Deletion is a soft delete (game record preserved in IndexedDB with `status = 'deleted'`). Deleted games are hidden from the UI with no restore UI — records remain recoverable by a developer if needed.

## Approach

Extend the existing `GameStatus` union type with `'deleted'`. Use the existing `updateGameStatus` helper to perform the soft delete. No Dexie schema version bump is needed — the `status` field is already indexed.

## Data Layer

- **`src/engine/types.ts`:** Add `'deleted'` to `GameStatus`
  ```ts
  export type GameStatus = 'draft' | 'in_progress' | 'completed' | 'deleted'
  ```
- **`src/db/gameService.ts`:**
  - Add `deleteGame(id: number): Promise<void>` — calls `updateGameStatus(id, 'deleted')`
  - Update `getGamesForTeam` to filter out deleted games (`.filter(g => g.status !== 'deleted')`)

## UI

**Location:** Home page game list (both In Progress and Completed sections).

**Normal row state:** The game info area is a `<Link>` for navigation. A small delete button (`✕`) sits at the right end of the row inside a flex container.

**Confirming state:** A single `confirmDeleteId: number | null` state variable in `HomePage` tracks which game is pending confirmation. When set, that row switches to show inline Cancel + Yes Delete buttons instead of the navigation link and delete icon. Clicking Cancel resets `confirmDeleteId` to `null`. Clicking Yes Delete calls `deleteGame`, then removes the game from local `games` state.

```
Normal:
┌─────────────────────────────────────────────┐
│  [vs Cardinals ──────────────────────] [✕]  │
│   Home · ABC123                             │
└─────────────────────────────────────────────┘

Confirming:
┌─────────────────────────────────────────────┐
│  vs Cardinals                               │
│  Home · ABC123        [Cancel] [Yes, delete]│
└─────────────────────────────────────────────┘
```

## Error Handling

`deleteGame` is a local IndexedDB operation. Failures are rare; catch and log only — no UI error state.

## Testing

- **Unit test (gameService):** `deleteGame` sets `status = 'deleted'`; `getGamesForTeam` excludes deleted games.
- **Component test (HomePage):** Clicking ✕ shows inline confirm; Cancel restores normal state; confirming removes the game from the rendered list.
