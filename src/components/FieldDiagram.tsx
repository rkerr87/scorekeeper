const POSITIONS = [
  { num: 1, label: 'P', x: 50, y: 62 },
  { num: 2, label: 'C', x: 50, y: 88 },
  { num: 3, label: '1B', x: 78, y: 68 },
  { num: 4, label: '2B', x: 62, y: 45 },
  { num: 5, label: '3B', x: 22, y: 68 },
  { num: 6, label: 'SS', x: 38, y: 45 },
  { num: 7, label: 'LF', x: 15, y: 22 },
  { num: 8, label: 'CF', x: 50, y: 10 },
  { num: 9, label: 'RF', x: 85, y: 22 },
]

interface FieldDiagramProps {
  selectedPositions: number[]
  onPositionClick: (position: number) => void
}

export function FieldDiagram({ selectedPositions, onPositionClick }: FieldDiagramProps) {
  return (
    <div className="relative w-72 h-72 mx-auto">
      {/* Green field background */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
        {/* Outfield arc */}
        <path d="M 5 50 Q 5 5 50 5 Q 95 5 95 50" fill="#86efac" fillOpacity="0.3" stroke="#16a34a" strokeWidth="0.5" />
        {/* Infield diamond */}
        <polygon points="50,85 78,55 50,25 22,55" fill="#fde68a" fillOpacity="0.3" stroke="#ca8a04" strokeWidth="0.5" />
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
              text-xs font-bold transition-all transform -translate-x-1/2 -translate-y-1/2
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
