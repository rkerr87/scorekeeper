import type { HalfInning } from '../engine/types'

interface ScoreSummaryProps {
  inning: number
  half: HalfInning
  outs: number
  scoreHome: number
  scoreAway: number
  homeTeamName: string
  awayTeamName: string
  pitchCount: number
  pitcherName: string
}

export function ScoreSummary({
  inning,
  half,
  outs,
  scoreHome,
  scoreAway,
  homeTeamName,
  awayTeamName,
  pitchCount,
  pitcherName,
}: ScoreSummaryProps) {
  return (
    <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between gap-4">
      {/* Inning */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-bold text-amber-400">{half === 'top' ? 'TOP' : 'BOT'}</span>
        <span className="text-lg font-bold">{inning}</span>
      </div>

      {/* Outs */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-slate-300 mr-1">OUT</span>
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

      {/* Score — away first, home second (sports convention) */}
      <div className="flex items-center gap-2">
        <div className="text-center">
          <div className="text-xs text-slate-300 uppercase truncate max-w-[60px] font-heading tracking-wider">{awayTeamName}</div>
          <div className="text-2xl font-bold font-heading">{scoreAway}</div>
        </div>
        <div className="text-slate-500">-</div>
        <div className="text-center">
          <div className="text-xs text-slate-300 uppercase truncate max-w-[60px] font-heading tracking-wider">{homeTeamName}</div>
          <div className="text-2xl font-bold font-heading">{scoreHome}</div>
        </div>
      </div>

      {/* Pitcher + pitch count */}
      <div className="text-right">
        <div className="text-xs text-slate-300">{pitcherName}</div>
        <div className="text-lg font-mono font-bold">PC: {pitchCount}</div>
      </div>
    </div>
  )
}
