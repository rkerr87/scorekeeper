# Field Diagram Redesign — Design

## Problem

The current FieldDiagram component looks schematic/abstract — a green triangle with a yellow circle and dark buttons. It doesn't read as a real baseball field. The reference image (Glover's aerial view) looks accurate and intuitive.

## Approach

Redesign the SVG background to look like a clean, flat-illustrated aerial view of a baseball field. Keep the same component API and circular button overlay pattern.

## SVG Field Layers (back to front)

1. **Outfield grass** — rounded shield/wedge shape in flat green (`#2d8a4e`). Bottom edge curves inward toward home plate (arc, not a sharp point like current). Clipped to the field boundary.
2. **Infield dirt** — brown arc/circle (`#c4956a`) centered around the pitcher's mound, covering the area between the bases.
3. **Infield grass** — green diamond inside the dirt, matching the base path area.
4. **Base paths** — white lines connecting 1B, 2B, 3B, and home in a diamond.
5. **Bases** — small white squares at 1B, 2B, 3B; pentagon at home plate.
6. **Pitcher's mound** — small brown circle at center of the diamond.
7. **Foul lines** — white lines from home plate extending to the outfield edges.

## Key Geometry Improvements

- Rounded outfield boundary (arc) instead of straight line
- Brown dirt infield ring instead of yellow circle
- White base paths with visible base markers
- More accurate fielder positioning (SS properly between 2B and 3B, outfielders spread wider)
- Home plate area with proper shape

## Color Palette

| Element | Color | Hex |
|---------|-------|-----|
| Outfield grass | Forest green | `#2d8a4e` |
| Infield grass | Slightly lighter green | `#3a9d5e` |
| Infield dirt | Warm brown | `#c4956a` |
| Base paths | White | `#ffffff` |
| Bases | White | `#ffffff` |
| Pitcher's mound | Brown | `#b8845a` |
| Foul lines | White | `#ffffff` |

## Buttons

- Same size: w-10 h-10 (40px) for touch targets
- **Unselected:** `bg-white/90` with dark text — better field contrast than current dark slate
- **Selected:** `bg-amber-400` with `ring-2 ring-amber-600` — same highlight, pops well against green/brown
- Label: abbreviation on top, number below (unchanged)
- Same aria-labels: `"{num} {label}"` (e.g. "6 SS")

## API

No changes. Same props:
- `selectedPositions: number[]`
- `onPositionClick: (position: number) => void`

Existing tests should pass without modification.

## Testing

- Existing 3 tests should pass unchanged (same button count, same aria-labels, same data-selected attribute)
- Visual verification via dev server
