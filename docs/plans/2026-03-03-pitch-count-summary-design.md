# Pitch Count Summary

## Problem

Umpires and coaches frequently ask how many pitches a pitcher has thrown. The app currently shows only the current pitcher's count in the header. There's no way to see counts for all pitchers who have thrown in the game.

## Design

### Access

Tap the pitch count area in the ScoreSummary header (pitcher name + "PC: 47"). Opens a BottomSheet.

### Content

A list of all pitchers who have thrown, grouped by team. Each row shows player name and pitch count. The current pitcher is highlighted.

### Data Source

`snapshot.pitchCountByPitcher` (Map<string, number>) already tracks counts for every pitcher. Cross-reference with lineups to determine team grouping.

### Files Changed

- `ScoreSummary.tsx` — add `onPitchCountClick` callback prop, make pitch count area tappable
- `GamePage.tsx` — manage show/hide state, render BottomSheet with pitcher list grouped by team

### Implementation Tasks

#### Task 1: Make ScoreSummary pitch count tappable

Add `onPitchCountClick?: () => void` prop. Wrap the pitch count area in a button. Tests: verify callback fires on click.

#### Task 2: Add pitch count summary BottomSheet to GamePage

When `onPitchCountClick` fires, show a BottomSheet listing all pitchers from `pitchCountByPitcher`, grouped by team (home/away), with the current pitcher highlighted. Tests: verify sheet appears with pitcher data, grouped correctly.
