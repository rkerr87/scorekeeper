const POSITIONS = [
  { num: 1, label: 'P',  x: 50, y: 58 },  // pitcher — center of infield
  { num: 2, label: 'C',  x: 50, y: 88 },  // catcher — below home plate
  { num: 3, label: '1B', x: 74, y: 68 },  // first base — right of diamond
  { num: 4, label: '2B', x: 60, y: 44 },  // second base — upper right infield
  { num: 5, label: '3B', x: 26, y: 68 },  // third base — left of diamond
  { num: 6, label: 'SS', x: 40, y: 50 },  // shortstop — upper left infield
  { num: 7, label: 'LF', x: 18, y: 28 },  // left field
  { num: 8, label: 'CF', x: 50, y: 12 },  // center field — top
  { num: 9, label: 'RF', x: 82, y: 28 },  // right field
]

interface FieldDiagramProps {
  selectedPositions: number[]
  onPositionClick: (position: number) => void
}

export function FieldDiagram({ selectedPositions, onPositionClick }: FieldDiagramProps) {
  return (
    <div className="relative w-72 h-72 mx-auto">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
        {/* Foul lines from home plate (50,95) extending to upper-left and upper-right */}
        <line x1="50" y1="95" x2="5" y2="5" stroke="#4ade80" strokeWidth="0.5" opacity="0.6" />
        <line x1="50" y1="95" x2="95" y2="5" stroke="#4ade80" strokeWidth="0.5" opacity="0.6" />

        {/* Fair territory fill (90° wedge) */}
        <path
          d="M 50 95 L 5 5 Q 50 2 95 5 Z"
          fill="#86efac"
          fillOpacity="0.2"
          stroke="none"
        />

        {/* Outfield arc */}
        <path
          d="M 8 8 Q 50 2 92 8"
          fill="none"
          stroke="#16a34a"
          strokeWidth="1"
        />

        {/* Infield dirt circle */}
        <circle cx="50" cy="68" r="20" fill="#fde68a" fillOpacity="0.25" stroke="#ca8a04" strokeWidth="0.5" />

        {/* Infield diamond */}
        <polygon
          points="50,85 74,68 50,51 26,68"
          fill="#fef9c3"
          fillOpacity="0.4"
          stroke="#ca8a04"
          strokeWidth="0.8"
        />

        {/* Home plate */}
        <polygon points="50,95 53,92 53,89 47,89 47,92" fill="#fff" stroke="#94a3b8" strokeWidth="0.5" />
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
              absolute w-10 h-10 rounded-full flex flex-col items-center justify-center
              text-xs font-bold transition-all duration-150 active:scale-95 transform -translate-x-1/2 -translate-y-1/2
              ${isSelected
                ? 'bg-amber-400 text-amber-900 ring-2 ring-amber-600 scale-110'
                : 'bg-slate-700 text-white hover:bg-slate-600'
              }
            `}
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          >
            <span className="text-[9px] leading-none">{pos.label}</span>
            <span className="text-xs leading-none">{pos.num}</span>
          </button>
        )
      })}
    </div>
  )
}
