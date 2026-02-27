# Beginner UX Improvements Design

**Date:** 2026-02-26
**Status:** Approved

## Overview

Five targeted UX improvements for beginner scorekeepers, identified through a full end-user review of the app. No schema changes required.

---

## 1. Start Game Without Opponent Lineup

**Problem:** The "Start Game" button is disabled until at least one opponent player is entered. At a real game, the scorekeeper may not have the opposing lineup card yet.

**Solution:** Remove `opponents.length === 0` from the `disabled` condition on the Start Game button. The button enables as soon as our batting order has at least one player. `saveLineup` is called with an empty `oppSlots` array when no opponents are entered — the engine handles this gracefully (empty scoresheet rows for "them", score still tracked correctly).

**Affected files:** `src/pages/GameSetupPage.tsx`

---

## 2. BeginnerGuide — Post-Record Card

**Problem:** The `BeginnerGuide` component (which renders a Diamond diagram + plain-English explanation for every play type) exists but is not wired into any screen.

**Solution:** After `finalizePlay` commits a play, store `{ playType, notation }` in a new `lastRecordedPlay` state on `GamePage`. Render `BeginnerGuide` as a card just above the bottom action bar (between the scrollable scoresheet and the Record Play / Undo buttons). Auto-dismiss after 5 seconds via `setTimeout`; also dismissible immediately via a × button. Clearing `lastRecordedPlay` (setting to null) removes the card.

No changes to `BeginnerGuide` itself — purely wiring and layout in `GamePage`.

**Affected files:** `src/pages/GamePage.tsx`

---

## 3. End-of-Game Screen

**Problem:** When the final out is recorded the "Record Play" button silently goes grey. No confirmation that the game is over; users may think the app crashed.

**Solution:** When `snapshot.isGameOver` is true and the scorekeeper has not dismissed the overlay (`gameOverDismissed` local state, default false), show a full-screen overlay on `GamePage`:

- Large final score: "Us 5 — Cardinals 3"
- Result line: "We won!" or "They won." or "Tie game." (compare scoreUs vs scoreThem)
- Primary button: "View Stats" → navigates to `/game/:id/stats`
- Secondary text link: "Back to scoresheet" → sets `gameOverDismissed = true`, dismisses overlay

**Affected files:** `src/pages/GamePage.tsx`

---

## 4. RunnerConfirmation — Clearer Instruction

**Problem:** The modal title "Confirm Runners" gives a beginner no hint about what they're supposed to do or why the modal appeared.

**Solution:** Change the title to **"Where did they end up?"** and add a subtitle: *"The app made its best guess — tap to correct any runner."*

**Affected files:** `src/components/RunnerConfirmation.tsx`

---

## 5. Batting Order Drag-to-Reorder

**Problem:** Reordering the batting order requires repeated taps on small ↑↓ arrow buttons — painful when the coach is calling out the order quickly at the field.

**Solution:** Install `@dnd-kit/core` and `@dnd-kit/sortable`. Replace the arrow buttons in `GameSetupPage` with a drag-handle (≡) on each player row. Wrap the list in `<SortableContext items={battingOrder}>`. Each row is a `<SortableItem>`. On drag-end, update `battingOrder` with `arrayMove`. Remove the `handleMoveUp` / `handleMoveDown` functions.

**Affected files:** `src/pages/GameSetupPage.tsx`

---

## Non-Goals

- No schema changes
- No new routes
- No Supabase changes
- No changes to the BeginnerGuide component itself
- No opponent-player editing post-game-start
