import type { PitchResult } from '../engine/types'

interface DiamondProps {
  basesReached: number[]
  continuationBases?: number[]
  runScored?: boolean
  notation?: string
  pitches?: PitchResult[]
  size?: number
}

export function Diamond({
  basesReached,
  continuationBases = [],
  runScored = false,
  notation = '',
  pitches = [],
  size = 60,
}: DiamondProps) {
  // Diamond coordinates (in a 100x100 viewBox)
  const home = { x: 50, y: 88 }
  const first = { x: 85, y: 50 }
  const second = { x: 50, y: 12 }
  const third = { x: 15, y: 50 }

  const baseCoord = (n: number) => {
    if (n === 1) return first
    if (n === 2) return second
    if (n === 3) return third
    return home // 0 or 4
  }

  const hasBase = (n: number) => basesReached.includes(n)

  // Build path segments for bases reached
  const segments: string[] = []
  if (hasBase(1)) segments.push(`M ${home.x} ${home.y} L ${first.x} ${first.y}`)
  if (hasBase(2)) segments.push(`M ${first.x} ${first.y} L ${second.x} ${second.y}`)
  if (hasBase(3)) segments.push(`M ${second.x} ${second.y} L ${third.x} ${third.y}`)
  if (hasBase(4)) segments.push(`M ${third.x} ${third.y} L ${home.x} ${home.y}`)

  // Build continuation path segments (dashed lines for subsequent advancement)
  const continuationSegments: string[] = []
  if (continuationBases.length > 0) {
    // Start from the last base the batter originally reached, or home if empty
    const startBase = basesReached.length > 0 ? Math.max(...basesReached) : 0
    let prevBase = startBase
    for (const nextBase of continuationBases) {
      const from = baseCoord(prevBase)
      const to = baseCoord(nextBase)
      continuationSegments.push(`M ${from.x} ${from.y} L ${to.x} ${to.y}`)
      prevBase = nextBase
    }
  }

  // Compute pitch boxes: 3 for balls, 2 for strikes (mirrors PitchTracker logic)
  const ballBoxes: ('B' | null)[] = [null, null, null]
  const strikeBoxes: ('S' | 'F' | null)[] = [null, null]
  let bIdx = 0
  let sIdx = 0
  for (const p of pitches) {
    if (p === 'B' && bIdx < 3) {
      ballBoxes[bIdx++] = 'B'
    } else if (p === 'S' && sIdx < 2) {
      strikeBoxes[sIdx++] = 'S'
    } else if (p === 'F' && sIdx < 2) {
      strikeBoxes[sIdx++] = 'F'
    }
  }

  return (
    <div className="flex flex-col items-center" style={{ width: size, height: size + 20 }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className="block"
      >
        {/* Diamond outline */}
        <polygon
          points={`${home.x},${home.y} ${first.x},${first.y} ${second.x},${second.y} ${third.x},${third.y}`}
          fill="none"
          stroke="#94a3b8"
          strokeWidth="1"
        />

        {/* Run scored: filled diamond */}
        {runScored && (
          <polygon
            data-testid="run-scored"
            points={`${home.x},${home.y} ${first.x},${first.y} ${second.x},${second.y} ${third.x},${third.y}`}
            fill="#fbbf24"
            fillOpacity="0.4"
            stroke="#f59e0b"
            strokeWidth="1.5"
          />
        )}

        {/* Base runner paths */}
        {segments.map((d, i) => (
          <path
            key={i}
            data-testid="base-path"
            d={d}
            fill="none"
            stroke="#1e40af"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        ))}

        {/* Continuation paths (solid lines for subsequent advancement) */}
        {continuationSegments.map((d, i) => (
          <path
            key={`cont-${i}`}
            data-testid="continuation-path"
            d={d}
            fill="none"
            stroke="#1e40af"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        ))}

        {/* Base markers */}
        {[first, second, third].map((base, i) => (
          <rect
            key={i}
            x={base.x - 3}
            y={base.y - 3}
            width={6}
            height={6}
            transform={`rotate(45 ${base.x} ${base.y})`}
            fill={hasBase(i + 1) ? '#1e40af' : '#e2e8f0'}
            stroke="#94a3b8"
            strokeWidth="0.5"
          />
        ))}

        {/* Notation text */}
        {notation && (
          notation === 'KL' ? (
            <foreignObject x="25" y="42" width="50" height="20">
              <span
                data-testid="backwards-k"
                style={{ display: 'block', transform: 'scaleX(-1)', textAlign: 'center', width: '100%', fontSize: '11px', fontWeight: 'bold', color: '#1e293b' }}
              >
                K
              </span>
            </foreignObject>
          ) : (
            <text
              x="50"
              y="54"
              textAnchor="middle"
              className="text-[10px] font-bold"
              fill="#1e293b"
            >
              {notation}
            </text>
          )
        )}
      </svg>

      {/* Pitch count boxes: 3 balls (top row) + 2 strikes (bottom row) */}
      <div className="flex flex-col items-center gap-0.5 mt-1">
        <div className="flex gap-0.5">
          {ballBoxes.map((filled, i) => (
            <div
              key={i}
              data-testid={filled ? 'ball-box-filled' : 'ball-box-empty'}
              className={`rounded-sm border ${filled ? 'bg-blue-500 border-blue-500' : 'bg-white border-slate-300'}`}
              style={{ width: 8, height: 5 }}
            />
          ))}
        </div>
        <div className="flex gap-0.5">
          {strikeBoxes.map((filled, i) => (
            <div
              key={i}
              data-testid={filled ? 'strike-box-filled' : 'strike-box-empty'}
              className={`rounded-sm border ${
                filled === 'S' ? 'bg-red-500 border-red-500' :
                filled === 'F' ? 'bg-amber-500 border-amber-500' :
                'bg-white border-slate-300'
              }`}
              style={{ width: 8, height: 5 }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
