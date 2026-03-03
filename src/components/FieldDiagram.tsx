// Fielder positions as percentages of the container (0-100)
const POSITIONS = [
  { num: 1, label: 'P',  x: 50, y: 60 },  // pitcher — centered on mound
  { num: 2, label: 'C',  x: 50, y: 82 },  // catcher — on home plate
  { num: 3, label: '1B', x: 68, y: 63 },  // first base — near the bag
  { num: 4, label: '2B', x: 61, y: 50 },  // second base — between 1B and 2B bag, upper infield
  { num: 5, label: '3B', x: 32, y: 63 },  // third base — near the bag
  { num: 6, label: 'SS', x: 39, y: 50 },  // shortstop — between 3B and 2B bag, upper infield
  { num: 7, label: 'LF', x: 17, y: 27 },  // left field
  { num: 8, label: 'CF', x: 50, y: 12 },  // center field
  { num: 9, label: 'RF', x: 83, y: 27 },  // right field
]

// Diamond geometry (SVG coordinates)
// Home: (50,82)  1B: (68,64)  2B: (50,46)  3B: (32,64)

interface FieldDiagramProps {
  selectedPositions: number[]
  onPositionClick: (position: number) => void
}

export function FieldDiagram({ selectedPositions, onPositionClick }: FieldDiagramProps) {
  return (
    <div className="relative w-full max-w-72 aspect-square mx-auto">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
        {/* Outfield grass — straight foul lines with curved outfield wall */}
        <path
          d="M 50 82
             L 5 36
             C 0.5 23 20 4 50 4
             C 80 4 99.5 23 95 36
             L 50 82 Z"
          fill="#2d8a4e"
        />

        {/* Foul lines — subtle white from home to outfield boundary */}
        <line x1="50" y1="82" x2="5" y2="36" stroke="rgba(255,255,255,0.35)" strokeWidth="0.6" />
        <line x1="50" y1="82" x2="95" y2="36" stroke="rgba(255,255,255,0.35)" strokeWidth="0.6" />

        {/* Infield dirt — arc from outside-3B, curving above 2B, to outside-1B,
            then V-lines down to home plate. Green diamond overlays the V. */}
        <path
          d="M 30 66 C 24 30 76 30 70 66 L 50 82 Z"
          fill="#c4956a"
        />

        {/* Infield grass diamond — sits inside the dirt */}
        <polygon
          points="50,82 68,64 50,46 32,64"
          fill="#3a9d5e"
        />

        {/* Base paths — white lines along the diamond edges */}
        <line x1="50" y1="82" x2="68" y2="64" stroke="#fff" strokeWidth="0.8" />
        <line x1="68" y1="64" x2="50" y2="46" stroke="#fff" strokeWidth="0.8" />
        <line x1="50" y1="46" x2="32" y2="64" stroke="#fff" strokeWidth="0.8" />
        <line x1="32" y1="64" x2="50" y2="82" stroke="#fff" strokeWidth="0.8" />

        {/* Dirt patches at each base */}
        <circle cx="68" cy="64" r="3.5" fill="#c4956a" />
        <circle cx="50" cy="46" r="3.5" fill="#c4956a" />
        <circle cx="32" cy="64" r="3.5" fill="#c4956a" />

        {/* Home plate dirt area — larger circle for batter's box area */}
        <circle cx="50" cy="82" r="6" fill="#c4956a" />

        {/* Bases — white diamonds */}
        <rect x="66.75" y="62.75" width="2.5" height="2.5" fill="#fff" transform="rotate(45 68 64)" />
        <rect x="48.75" y="44.75" width="2.5" height="2.5" fill="#fff" transform="rotate(45 50 46)" />
        <rect x="30.75" y="62.75" width="2.5" height="2.5" fill="#fff" transform="rotate(45 32 64)" />

        {/* Home plate — pentagon shape */}
        <polygon points="50,83.5 52,82 52,80.5 48,80.5 48,82" fill="#fff" />

        {/* Pitcher's mound — dirt circle with rubber */}
        <circle cx="50" cy="62" r="3.5" fill="#b8845a" />
        <rect x="48.8" y="61.5" width="2.4" height="1" fill="#fff" rx="0.3" />
      </svg>

      {/* Position buttons */}
      {POSITIONS.map(pos => {
        const isSelected = selectedPositions.includes(pos.num)
        return (
          <button
            key={pos.num}
            data-selected={isSelected}
            onClick={() => onPositionClick(pos.num)}
            aria-label={`${pos.num} ${pos.label}`}
            className={`
              absolute w-12 h-12 rounded-full flex flex-col items-center justify-center
              text-xs font-bold transition-all duration-150 active:scale-95 transform -translate-x-1/2 -translate-y-1/2
              shadow-md border
              ${isSelected
                ? 'bg-amber-400 text-amber-900 ring-2 ring-amber-600 scale-110 border-amber-600'
                : 'bg-white/90 text-slate-800 hover:bg-white border-slate-300'
              }
            `}
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          >
            <span className="text-[11px] leading-none">{pos.label}</span>
            <span className="text-xs leading-none">{pos.num}</span>
          </button>
        )
      })}
    </div>
  )
}
