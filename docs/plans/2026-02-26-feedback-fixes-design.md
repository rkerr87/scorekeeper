# Feedback Fixes Design

**Date:** 2026-02-26
**Status:** Approved

## Overview

Eight UX/bug fixes based on user testing feedback. All changes are UI-layer or engine-light — no schema changes required.

---

## 1. Runner Confirmation — Full Runner Placement

**Problem:** The current modal only lets scorekeepers clear individual bases. There is no way to move a runner from one base to another.

**Solution:** Replace the per-base "clear" buttons with a full runner placement grid. Each occupied runner gets a row showing their name and buttons for every valid destination: **1st · 2nd · 3rd · Scored · Out**. The current base is highlighted. Tapping a destination moves that runner.

**Also fixes "runners can't advance on outs":** RunnerConfirmation currently only appears when a hit/walk advances runners. It will now also appear after any play that recorded an out while runners were on base (K, GO, FO, LO, PO, etc.), enabling sac fly scoring, runners advancing on fielder's choice, etc.

**Affected files:** `src/components/RunnerConfirmation.tsx`, `src/pages/GamePage.tsx`

---

## 2. Field Diagram — Proper Fan Shape

**Problem:** Current diagram is a generic semicircle with a floating diamond — does not look like a baseball field.

**Solution:** Replace the SVG with a proper 90° wedge fan shape:
- Home plate at bottom center
- Two foul lines extending up-left and up-right at ~45° each
- Outfield arc connecting foul line endpoints
- Infield diamond in the lower third
- Dirt-circle suggestion around the infield
- All 9 fielder buttons repositioned to correct relative locations

Style: clean lines, no textures (stylized but recognizable).

**Affected files:** `src/components/FieldDiagram.tsx`

---

## 3. Stolen Base — Runner Selection

**Problem:** When multiple runners are on base, SB only advances the lead runner instead of letting the scorekeeper choose who is stealing.

**Solution:** When SB is tapped in PlayEntryPanel, show a sub-step: **"Who is stealing?"** with one button per occupied base (e.g. "Runner on 1st — Smith", "Runner on 2nd — Jones"). The selected runner advances one base; others stay. If only one runner is on base, skip the sub-step and advance them directly (no change from current behavior).

**Affected files:** `src/components/PlayEntryPanel.tsx`, engine may need a `stolenBaseRunner` field on the play

---

## 4. Inning Transition — Auto-Switch + Toast

**Problem:** After the 3rd out, the UI doesn't react. The tab stays on the retiring team; the scorekeeper is confused about whose turn it is.

**Solution:** GamePage detects when `snapshot.half` has changed after a play is recorded (compare previous snapshot half to new). When detected:
1. Automatically switch `activeTab` to the now-batting team
2. Show a non-blocking toast (3 seconds, top of screen) e.g. **"Side retired — Bottom 3rd"**

No confirmation required — clean and immediate.

**Affected files:** `src/pages/GamePage.tsx`

---

## 5. Batting Around the Order — Extra Inning Columns

**Problem:** When the batting order wraps within a single inning (9+ batters in one half-inning), the scoresheet only shows the last at-bat for each batter. The first at-bat is hidden.

**Solution:** Add computed "pass" columns at render time. Walk through the inning's plays in sequence order and detect when `batterOrderPosition` resets (goes lower than the previous batter). Each wrap starts a new pass. Pass 1 = normal inning column ("3"), pass 2 = "3b", pass 3 = "3c", etc.

No schema change needed — purely a display-layer computation in Scoresheet. Each pass column renders exactly like a normal inning column but filters to its pass number.

**Affected files:** `src/components/Scoresheet.tsx`

---

## 6. Button Transitions — Smooth Animations

**Problem:** Button interactions feel jarring with no visual feedback or animation.

**Solution:** Sweep Tailwind transition classes across interactive elements:
- All buttons: `transition-all duration-150 ease-in-out`
- Press feedback: `active:scale-95`
- PlayEntryPanel slide-up: `transition-transform duration-200`
- Mode transitions within PlayEntryPanel (outcome → fielding sub-steps): fade/slide

**Affected files:** `src/components/PlayEntryPanel.tsx`, `src/components/RunnerConfirmation.tsx`, `src/pages/GamePage.tsx`

---

## 7. Backwards K for Strikeout Looking

**Problem:** KL (strikeout looking) displays as "KL" text. Traditional scoring notation uses a backwards K.

**Solution:** In `AtBatCell`/`Diamond`, when the notation string is `"KL"`, render it as a CSS-mirrored K:

```tsx
<span style={{ display: 'inline-block', transform: 'scaleX(-1)' }}>K</span>
```

No font or Unicode dependency — works everywhere and is immediately recognizable.

**Affected files:** `src/components/Diamond.tsx` (notation rendering), possibly `src/components/AtBatCell.tsx`

---

## 8. Pitch Count — Always Visible in Status Bar

**Problem:** The current pitcher's pitch count exists in ScoreSummary but is not prominent or always visible during a game.

**Solution:** Add the current pitcher's total pitch count to the persistent game status bar at the top of `GamePage` (alongside inning, outs, and score). Display as **"PC: 47"** always visible without opening any panel.

The current at-bat's pitch sequence (B/S/F dots) remains in the PlayEntryPanel pitch tracker as-is.

**Affected files:** `src/pages/GamePage.tsx` (status bar)

---

## Non-Goals

- No schema changes to Play, Game, Lineup, or any DB tables
- No Supabase or sync changes
- No new routes
