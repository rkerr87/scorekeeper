# UX Polish & Phone-First Redesign

**Date:** 2026-03-02
**Target device:** Phone-first (works on tablet/desktop too)
**Accessibility:** Deferred to a future pass

## 1. Toast/Notification System

Lightweight toast component at the bottom of the screen (above any bottom sheet). Auto-dismisses after 3 seconds, swipe to dismiss on mobile. Three variants: success (green), error (red), info (blue).

Simple context provider: any component calls `showToast('Player added', 'success')`.

No third-party library — small component + context.

**Where toasts fire:**
- Add player/team: "Player added" / "Team created"
- Delete player/team/game: "Player deleted" / "Team deleted" / "Game deleted"
- Record play: "Play recorded — K" (includes play type)
- Position change: "Position change saved"
- Undo: "Play undone"
- Shorthand error: "Unrecognized notation — try 6-3, 1B7, or F8"

## 2. Empty States

Centered text block with short message and CTA where applicable. Consistent style: slate-400 text, slightly larger than body.

| Location | Message | CTA |
|----------|---------|-----|
| HomePage — no games | "No games yet" | "Start New Game" button (exists, add message above) |
| HomePage — no teams | "Create at least 2 teams to start a game" | Link to /teams |
| TeamsPage — no teams | "No teams yet. Create your first team to get started." | Form is right there |
| TeamDetailPage — no players | "No players on the roster yet. Add your first player above." | None |
| SeasonStatsPage — no games | "No completed games yet for this team." | None |
| GameStatsPage — empty | "No stats available." | Link back to game |

## 3. Form Validation & Confirmation Dialogs

### Validation
- **Jersey number:** Reject non-numeric input. Inline red text "Jersey # must be a number".
- **Duplicate team names:** Check on submit. "A team with this name already exists".
- **Player name required:** Red border + "Name is required" on empty submit.
- **Shorthand errors:** Improved message: "Unrecognized notation. Try: 6-3 (groundout), 1B7 (single to left), F8 (flyout to center)".

### Confirmation dialogs
- **Delete player:** "Delete [name] from the roster?" Cancel / Delete
- **Delete team:** "Delete [team name]? This cannot be undone." Cancel / Delete
- **Delete game:** Keep existing inline confirm
- **Clear pitches:** Simplify to single confirm: "Clear [N] pitches?" Cancel / Clear

**No confirmation on:** Record play (too frequent), position changes (already multi-step).

## 4. Team Management Gaps

### Team deletion
- "Delete Team" button at bottom of TeamDetailPage (red, outlined)
- Blocked if team has non-deleted games: "Can't delete — this team has games. Delete those games first."
- Uses confirmation dialog from Section 3

### Team rename
- Tap team name header on TeamDetailPage to enter inline edit (input replaces text, Enter/blur to save)
- Small pencil icon as affordance

### Player editing
- Tap player row to expand inline edit form (name, jersey #, position dropdown)
- Same position dropdown rules (assigned positions disabled)
- Save / Cancel buttons in expanded row

## 5. Dead UI & Dev Tools Cleanup

- **Edit button:** Remove from PlayDetailPopover entirely. Add back when edit-play is implemented.
- **Dev tools:** Hide behind small "Dev" link at bottom of HomePage in gray text. In production, hide via `import.meta.env.DEV`.
- **Stats link:** Disable "Season Stats" on HomePage when no completed games. Gray out with message: "Complete a game to see stats".

## 6. Loading States

- Simple CSS-only spinner component (animated circle). Centered with optional label.
- Replace all "Loading..." text with spinner.
- Pages: TeamDetailPage, GameSetupPage, GamePage, GameStatsPage, SeasonStatsPage.
- No skeleton screens — single consistent spinner.

## 7. Phone-First Layout Improvements

### 7a. Touch Targets (44px minimum)
- **FieldDiagram:** Increase button hit areas to 44px. Spread positions further. Fill available width instead of fixed 288px.
- **PitchTracker dots:** Increase to 32px minimum. Remove tap-to-delete (accidental hits). Use Clear/Undo buttons for removal.
- **Play entry buttons:** Minimum 44px height with more padding.
- **Position dropdowns in GameSetupPage:** Increase to 44px height.

### 7b. Play Entry Panel — Tabbed Layout
- Currently shows all sections requiring scrolling.
- Redesign as tabbed layout: "Hit" | "Out" | "Special" | "Shorthand"
- Each tab shows only relevant buttons, keeping content above the fold.
- Tabs are large, easy to tap.

### 7c. Bottom Sheets for Dialogs
- All modals (PlayDetailPopover, RunnerConfirmation, PositionChangeDialog, SubstitutionDialog) become bottom sheets on phone.
- Slide up from bottom, full-width, drag handle to dismiss.
- Max height 80vh with scroll on overflow.
- On tablet/desktop, keep as centered modals.

### 7d. Scoresheet on Phone
- Keep horizontal scroll (grid is fundamental to scorebook).
- Narrower sticky left column: jersey # + abbreviated name (e.g., "12 J.Smith").
- Slightly increased cell height for easier tap targets.
- Subtle scroll indicator (gradient fade on right edge).

## 8. Visual Polish

### Score header (ScoreSummary)
- Replace ▲▼ with "TOP" / "BOT" text.
- Show team names in score: "Tigers 3 — Lions 2".

### GamePage navigation
- Add "Home" button (house icon or "< Home") in top-left corner.

### Game-over overlay
- Simplify to: final score, "View Stats" button, "Back to Home" button.
- Remove "Back to scoresheet" (dismissing overlay shows scoresheet already).

### Beginner guide
- Persistent until manually dismissed (X button) instead of auto-dismiss.
- After user dismisses 3 times, stop showing (localStorage counter).
