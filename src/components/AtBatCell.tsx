import { Diamond } from './Diamond'
import type { PitchResult } from '../engine/types'

interface CellPlayData {
  playType: string
  notation: string
  basesReached: number[]
  runsScoredOnPlay: number
  pitches: PitchResult[]
}

interface AtBatCellProps {
  play: CellPlayData | null
  isCurrentBatter: boolean
  onClick: () => void
}

export function AtBatCell({ play, isCurrentBatter, onClick }: AtBatCellProps) {
  return (
    <div
      data-testid="atbat-cell"
      onClick={onClick}
      className={`
        min-h-[72px] min-w-[72px] flex items-center justify-center cursor-pointer
        border border-slate-200 transition-colors
        ${isCurrentBatter ? 'bg-amber-50 ring-2 ring-amber-400 ring-inset' : 'bg-white hover:bg-slate-50'}
      `}
    >
      {play ? (
        <Diamond
          basesReached={play.basesReached}
          runScored={play.runsScoredOnPlay > 0}
          notation={play.notation}
          pitches={play.pitches}
          size={56}
        />
      ) : null}
    </div>
  )
}
