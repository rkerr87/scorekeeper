const POSITIONS = [
  { num: 1, label: 'P',  x: 50, y: 57 },  // pitcher — center mound
  { num: 2, label: 'C',  x: 50, y: 91 },  // catcher — behind home plate
  { num: 3, label: '1B', x: 72, y: 67 },  // first base
  { num: 4, label: '2B', x: 60, y: 44 },  // second base — right of 2nd
  { num: 5, label: '3B', x: 28, y: 67 },  // third base
  { num: 6, label: 'SS', x: 38, y: 47 },  // shortstop — left of 2nd
  { num: 7, label: 'LF', x: 15, y: 25 },  // left field
  { num: 8, label: 'CF', x: 50, y: 13 },  // center field
  { num: 9, label: 'RF', x: 85, y: 25 },  // right field
]

interface FieldDiagramProps {
  selectedPositions: number[]
  onPositionClick: (position: number) => void
}

export function FieldDiagram({ selectedPositions, onPositionClick }: FieldDiagramProps) {
  // Key geometry points
  // Home plate: (50, 82)
  // 1B: (71, 60), 2B: (50, 40), 3B: (29, 60)
  // Pitcher's mound: (50, 58)

  return (
    <div className="relative w-72 h-72 mx-auto">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
        {/* Outfield grass — smooth rounded shape */}
        <path
          d="M 50 85 L 5 38 C 5 8 50 2 50 2 C 50 2 95 8 95 38 Z"
          fill="#2d8a4e"
        />

        {/* Foul lines — from home plate to outfield edges */}
        <line x1="50" y1="82" x2="5" y2="38" stroke="rgba(255,255,255,0.5)" strokeWidth="0.6" />
        <line x1="50" y1="82" x2="95" y2="38" stroke="rgba(255,255,255,0.5)" strokeWidth="0.6" />

        {/* Infield dirt — smooth arc from 3B side to 1B side, curving up behind 2B */}
        <path
          d="M 20 68 C 20 34 50 28 50 28 C 50 28 80 34 80 68 L 71 60 L 50 82 L 29 60 Z"
          fill="#c4956a"
        />

        {/* Infield grass — diamond shape */}
        <polygon
          points="50,82 71,60 50,40 29,60"
          fill="#3a9d5e"
        />

        {/* Base paths — white lines */}
        <line x1="50" y1="82" x2="71" y2="60" stroke="#fff" strokeWidth="0.8" />
        <line x1="71" y1="60" x2="50" y2="40" stroke="#fff" strokeWidth="0.8" />
        <line x1="50" y1="40" x2="29" y2="60" stroke="#fff" strokeWidth="0.8" />
        <line x1="29" y1="60" x2="50" y2="82" stroke="#fff" strokeWidth="0.8" />

        {/* Bases — white diamond squares */}
        <rect x="69.5" y="58.5" width="3" height="3" fill="#fff" transform="rotate(45 71 60)" />
        <rect x="48.5" y="38.5" width="3" height="3" fill="#fff" transform="rotate(45 50 40)" />
        <rect x="27.5" y="58.5" width="3" height="3" fill="#fff" transform="rotate(45 29 60)" />

        {/* Home plate area — dirt circle behind home */}
        <circle cx="50" cy="82" r="6" fill="#c4956a" />

        {/* Home plate — white pentagon */}
        <polygon points="50,83.5 52,82 52,80 48,80 48,82" fill="#fff" />

        {/* Pitcher's mound — dirt circle + rubber */}
        <circle cx="50" cy="55" r="4" fill="#c4956a" />
        <rect x="48.5" y="54.5" width="3" height="1" fill="#fff" />
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
