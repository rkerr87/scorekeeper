const POSITIONS = [
  { num: 1, label: 'P',  x: 50, y: 60 },  // pitcher — center mound
  { num: 2, label: 'C',  x: 50, y: 90 },  // catcher — behind home plate
  { num: 3, label: '1B', x: 73, y: 66 },  // first base
  { num: 4, label: '2B', x: 58, y: 45 },  // second base — right of 2nd
  { num: 5, label: '3B', x: 27, y: 66 },  // third base
  { num: 6, label: 'SS', x: 38, y: 48 },  // shortstop — left of 2nd
  { num: 7, label: 'LF', x: 16, y: 24 },  // left field
  { num: 8, label: 'CF', x: 50, y: 12 },  // center field
  { num: 9, label: 'RF', x: 84, y: 24 },  // right field
]

interface FieldDiagramProps {
  selectedPositions: number[]
  onPositionClick: (position: number) => void
}

export function FieldDiagram({ selectedPositions, onPositionClick }: FieldDiagramProps) {
  return (
    <div className="relative w-72 h-72 mx-auto">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
        {/* Outfield grass — rounded shield shape */}
        <path
          d="M 50 92 L 3 30 Q 3 5 50 3 Q 97 5 97 30 Z"
          fill="#2d8a4e"
        />

        {/* Infield dirt — arc behind bases */}
        <path
          d="M 22 72 Q 22 38 50 35 Q 78 38 78 72 Z"
          fill="#c4956a"
        />

        {/* Infield grass — diamond inside dirt */}
        <polygon
          points="50,78 72,58 50,40 28,58"
          fill="#3a9d5e"
        />

        {/* Base paths — white lines */}
        <line x1="50" y1="80" x2="72" y2="58" stroke="#fff" strokeWidth="0.7" />
        <line x1="72" y1="58" x2="50" y2="38" stroke="#fff" strokeWidth="0.7" />
        <line x1="50" y1="38" x2="28" y2="58" stroke="#fff" strokeWidth="0.7" />
        <line x1="28" y1="58" x2="50" y2="80" stroke="#fff" strokeWidth="0.7" />

        {/* Foul lines — from home plate to outfield edges */}
        <line x1="50" y1="80" x2="3" y2="30" stroke="#fff" strokeWidth="0.6" />
        <line x1="50" y1="80" x2="97" y2="30" stroke="#fff" strokeWidth="0.6" />

        {/* Bases — white squares */}
        <rect x="70" y="56" width="4" height="4" fill="#fff" transform="rotate(45 72 58)" />
        <rect x="48" y="36" width="4" height="4" fill="#fff" transform="rotate(45 50 38)" />
        <rect x="26" y="56" width="4" height="4" fill="#fff" transform="rotate(45 28 58)" />

        {/* Home plate */}
        <polygon points="50,82 52.5,80 52.5,78 47.5,78 47.5,80" fill="#fff" />

        {/* Pitcher's mound */}
        <circle cx="50" cy="58" r="2.5" fill="#b8845a" />

        {/* Dirt cutouts at bases */}
        <circle cx="72" cy="58" r="4" fill="#c4956a" />
        <circle cx="28" cy="58" r="4" fill="#c4956a" />
        <circle cx="50" cy="38" r="4" fill="#c4956a" />

        {/* Home plate dirt area */}
        <path
          d="M 42 78 Q 42 86 50 88 Q 58 86 58 78 Z"
          fill="#c4956a"
        />
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
              shadow-md border
              ${isSelected
                ? 'bg-amber-400 text-amber-900 ring-2 ring-amber-600 scale-110 border-amber-600'
                : 'bg-white/90 text-slate-800 hover:bg-white border-slate-300'
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
