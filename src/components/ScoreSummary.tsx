import type { HalfInning } from '../engine/types'

interface ScoreSummaryProps {
  inning: number
  half: HalfInning
  outs: number
  scoreUs: number
  scoreThem: number
  pitchCount: number
  pitcherName: string
}

export function ScoreSummary({
  inning,
  half,
  outs,
  scoreUs,
  scoreThem,
  pitchCount,
  pitcherName,
}: ScoreSummaryProps) {
  const halfLabel = half === 'top' ? '\u25B2' : '\u25BC' // ▲ ▼

  return (
    <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between gap-4">
      {/* Inning */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs">{halfLabel}</span>
        <span className="text-lg font-bold">{half === 'top' ? 'Top' : 'Bot'} {inning}</span>
      </div>

      {/* Outs */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-slate-400 mr-1">OUT</span>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            data-testid={i < outs ? 'out-filled' : 'out-empty'}
            className={`w-3 h-3 rounded-full ${
              i < outs ? 'bg-amber-400' : 'bg-slate-600'
            }`}
          />
        ))}
      </div>

      {/* Score */}
      <div className="flex items-center gap-2">
        <div className="text-center">
          <div className="text-xs text-slate-400">US</div>
          <div className="text-2xl font-bold">{scoreUs}</div>
        </div>
        <div className="text-slate-500">-</div>
        <div className="text-center">
          <div className="text-xs text-slate-400">THEM</div>
          <div className="text-2xl font-bold">{scoreThem}</div>
        </div>
      </div>

      {/* Pitcher + pitch count */}
      <div className="text-right">
        <div className="text-xs text-slate-400">{pitcherName}</div>
        <div className="text-lg font-mono font-bold">{pitchCount}</div>
      </div>
    </div>
  )
}
