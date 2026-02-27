import type { LineupSlot, Play } from '../engine/types'
import { AtBatCell } from './AtBatCell'
import { computePlayerStats } from '../engine/stats'

interface ScoresheetProps {
  lineup: LineupSlot[]
  plays: Play[]
  currentInning: number
  currentBatterPosition: number
  maxInnings: number
  onCellClick: (batterPosition: number, inning: number) => void
  runsMap?: Map<number, number>
}

export function Scoresheet({
  lineup,
  plays,
  currentInning,
  currentBatterPosition,
  maxInnings,
  onCellClick,
  runsMap,
}: ScoresheetProps) {
  const innings = Array.from({ length: Math.max(maxInnings, currentInning) }, (_, i) => i + 1)

  const getPlayForCell = (batterPosition: number, inning: number): Play | undefined => {
    return plays.find(p => p.batterOrderPosition === batterPosition && p.inning === inning && p.isAtBat)
  }

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-sm min-w-full">
        <thead>
          <tr className="bg-slate-100">
            <th className="sticky left-0 z-10 bg-slate-100 border border-slate-200 px-2 py-1.5 text-left min-w-[140px]">
              Batter
            </th>
            {innings.map(inn => (
              <th key={inn} className="border border-slate-200 px-1 py-1.5 text-center min-w-[76px] font-bold">
                {inn}
              </th>
            ))}
            <th className="border border-slate-200 px-2 py-1.5 text-center w-10 text-xs font-semibold text-slate-500">AB</th>
            <th className="border border-slate-200 px-2 py-1.5 text-center w-10 text-xs font-semibold text-slate-500">R</th>
            <th className="border border-slate-200 px-2 py-1.5 text-center w-10 text-xs font-semibold text-slate-500">H</th>
            <th className="border border-slate-200 px-2 py-1.5 text-center w-10 text-xs font-semibold text-slate-500">RBI</th>
            <th className="border border-slate-200 px-2 py-1.5 text-center w-10 text-xs font-semibold text-slate-500">BB</th>
            <th className="border border-slate-200 px-2 py-1.5 text-center w-10 text-xs font-semibold text-slate-500">K</th>
          </tr>
        </thead>
        <tbody>
          {lineup.map(slot => {
            const playerPlays = plays.filter(p => p.batterOrderPosition === slot.orderPosition && p.isAtBat)
            const stats = computePlayerStats(playerPlays, slot.orderPosition, runsMap?.get(slot.orderPosition) ?? 0)

            return (
              <tr key={slot.orderPosition}>
                {/* Player info — sticky left column */}
                <td className="sticky left-0 z-10 bg-white border border-slate-200 px-2 py-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-mono w-4">{slot.orderPosition}.</span>
                    <span className="text-xs text-slate-500 font-mono w-6">#{slot.jerseyNumber}</span>
                    <span className="text-xs text-slate-500 w-6">{slot.position}</span>
                    <span className="font-semibold text-slate-800 truncate">{slot.playerName}</span>
                  </div>
                  {/* Substitution rows */}
                  {slot.substitutions.map((sub, si) => (
                    <div key={si} className="flex items-center gap-2 mt-0.5 text-xs text-slate-400 border-t border-dashed border-slate-200 pt-0.5">
                      <span className="w-4"></span>
                      <span className="font-mono w-6">#{sub.newJerseyNumber}</span>
                      <span className="w-6">{sub.newPosition}</span>
                      <span className="truncate">{sub.newPlayerName}</span>
                      <span className="text-[10px]">({sub.half === 'top' ? 'T' : 'B'}{sub.inning})</span>
                    </div>
                  ))}
                </td>

                {/* At-bat cells per inning */}
                {innings.map(inn => {
                  const play = getPlayForCell(slot.orderPosition, inn)
                  return (
                    <td key={inn} className="border border-slate-200 p-0">
                      <AtBatCell
                        play={play ? {
                          playType: play.playType,
                          notation: play.notation,
                          basesReached: play.basesReached,
                          runsScoredOnPlay: play.runsScoredOnPlay,
                          pitches: play.pitches,
                        } : null}
                        isCurrentBatter={slot.orderPosition === currentBatterPosition && inn === currentInning}
                        onClick={() => onCellClick(slot.orderPosition, inn)}
                      />
                    </td>
                  )
                })}

                {/* Summary stats */}
                <td className="border border-slate-200 px-2 py-1 text-center text-xs font-mono">{stats.atBats}</td>
                <td className="border border-slate-200 px-2 py-1 text-center text-xs font-mono">{stats.runs}</td>
                <td className="border border-slate-200 px-2 py-1 text-center text-xs font-mono">{stats.hits}</td>
                <td className="border border-slate-200 px-2 py-1 text-center text-xs font-mono">{stats.rbis}</td>
                <td className="border border-slate-200 px-2 py-1 text-center text-xs font-mono">{stats.walks}</td>
                <td className="border border-slate-200 px-2 py-1 text-center text-xs font-mono">{stats.strikeouts}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
