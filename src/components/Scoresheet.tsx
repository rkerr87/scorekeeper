import type { LineupSlot, Play, Lineup } from '../engine/types'
import { AtBatCell } from './AtBatCell'
import { computePlayerStats } from '../engine/stats'
import { computeRunnerJourneys } from '../engine/journeys'

interface ScoresheetProps {
  lineup: LineupSlot[]
  plays: Play[]
  allPlays?: Play[]
  lineupHome?: Lineup
  lineupAway?: Lineup
  currentInning: number
  currentBatterPosition: number
  maxInnings: number
  onCellClick: (batterPosition: number, inning: number, play?: Play) => void
  runsMap?: Map<number, number>
}

// --- Pass computation for batting-around-the-order ---

interface InningColumn {
  inning: number
  pass: number
  label: string
}

function computePassMap(plays: Play[]): Map<number, number> {
  const passMap = new Map<number, number>()
  const byInning = new Map<number, Play[]>()

  for (const p of plays) {
    if (!p.isAtBat || p.id === undefined) continue
    if (!byInning.has(p.inning)) byInning.set(p.inning, [])
    byInning.get(p.inning)!.push(p)
  }

  for (const [, inningPlays] of byInning) {
    const sorted = [...inningPlays].sort((a, b) => a.sequenceNumber - b.sequenceNumber)
    let pass = 1
    const seenInPass = new Set<number>()
    for (const play of sorted) {
      if (seenInPass.has(play.batterOrderPosition)) {
        pass++
        seenInPass.clear()
      }
      seenInPass.add(play.batterOrderPosition)
      passMap.set(play.id!, pass)
    }
  }

  return passMap
}

function buildColumns(
  plays: Play[],
  passMap: Map<number, number>,
  maxInnings: number,
  currentInning: number,
  currentPass: number,
): InningColumn[] {
  const maxPassByInning = new Map<number, number>()
  for (const play of plays) {
    if (!play.isAtBat || play.id === undefined) continue
    const pass = passMap.get(play.id) ?? 1
    const cur = maxPassByInning.get(play.inning) ?? 0
    if (pass > cur) maxPassByInning.set(play.inning, pass)
  }
  // Ensure a column exists for the current batter's pass (bat-around before first play in new pass)
  const curMax = maxPassByInning.get(currentInning) ?? 1
  if (currentPass > curMax) maxPassByInning.set(currentInning, currentPass)

  const highestInning = Math.max(maxInnings, currentInning)
  const cols: InningColumn[] = []
  for (let inn = 1; inn <= highestInning; inn++) {
    const maxPass = maxPassByInning.get(inn) ?? 1
    for (let p = 1; p <= maxPass; p++) {
      const suffix = p === 1 ? '' : String.fromCharCode(96 + p) // '', 'b', 'c', ...
      cols.push({ inning: inn, pass: p, label: `${inn}${suffix}` })
    }
  }
  return cols
}

function getCurrentPass(
  plays: Play[],
  passMap: Map<number, number>,
  currentInning: number,
  currentBatterPosition: number,
): number {
  const inningPlays = plays.filter(p => p.isAtBat && p.inning === currentInning && p.id !== undefined)
  if (inningPlays.length === 0) return 1

  const sorted = [...inningPlays].sort((a, b) => b.sequenceNumber - a.sequenceNumber)
  const lastPass = passMap.get(sorted[0].id!) ?? 1
  const lastPassPlays = inningPlays.filter(p => (passMap.get(p.id!) ?? 1) === lastPass)
  const seenInLastPass = new Set(lastPassPlays.map(p => p.batterOrderPosition))

  return seenInLastPass.has(currentBatterPosition) ? lastPass + 1 : lastPass
}

export function Scoresheet({
  lineup,
  plays,
  allPlays,
  lineupHome,
  lineupAway,
  currentInning,
  currentBatterPosition,
  maxInnings,
  onCellClick,
  runsMap,
}: ScoresheetProps) {
  const journeys = allPlays && lineupHome && lineupAway
    ? computeRunnerJourneys(allPlays, lineupHome, lineupAway)
    : new Map<number, number[]>()

  const passMap = computePassMap(plays)
  const currentPass = getCurrentPass(plays, passMap, currentInning, currentBatterPosition)
  const columns = buildColumns(plays, passMap, maxInnings, currentInning, currentPass)

  const getPlayForCell = (batterPosition: number, inning: number, pass: number): Play | undefined => {
    return plays.find(
      p => p.isAtBat &&
        p.batterOrderPosition === batterPosition &&
        p.inning === inning &&
        p.id !== undefined &&
        (passMap.get(p.id) ?? 1) === pass
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-sm min-w-full">
        <thead>
          <tr className="bg-slate-100">
            <th className="sticky left-0 z-10 bg-slate-100 border border-slate-200 px-2 py-1.5 text-left min-w-[140px]">
              Batter
            </th>
            {columns.map(col => (
              <th key={`${col.inning}-${col.pass}`} className="border border-slate-200 px-1 py-1.5 text-center min-w-[76px] font-bold">
                {col.label}
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
                <td className="sticky left-0 z-10 bg-white border border-slate-200 px-2 py-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-mono w-4">{slot.orderPosition}.</span>
                    <span className="text-xs text-slate-500 font-mono w-6">#{slot.jerseyNumber}</span>
                    <span className="text-xs text-slate-500 w-6">{slot.position}</span>
                    <span className="font-semibold text-slate-800 truncate">{slot.playerName}</span>
                  </div>
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

                {columns.map(col => {
                  const play = getPlayForCell(slot.orderPosition, col.inning, col.pass)
                  const isCurrentBatter =
                    slot.orderPosition === currentBatterPosition &&
                    col.inning === currentInning &&
                    col.pass === currentPass

                  // Compute continuation bases from journey data
                  const journey = play?.id !== undefined ? journeys.get(play.id) : undefined
                  const continuationBases = journey && play
                    ? journey.filter(b => !play.basesReached.includes(b))
                    : undefined

                  return (
                    <td key={`${col.inning}-${col.pass}`} className="border border-slate-200 p-0">
                      <AtBatCell
                        play={play ? {
                          playType: play.playType,
                          notation: play.notation,
                          basesReached: play.basesReached,
                          continuationBases,
                          runsScoredOnPlay: play.runsScoredOnPlay,
                          pitches: play.pitches,
                        } : null}
                        isCurrentBatter={isCurrentBatter}
                        onClick={() => onCellClick(slot.orderPosition, col.inning, play)}
                      />
                    </td>
                  )
                })}

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
