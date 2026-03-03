import { useState } from 'react'
import type { PitchResult } from '../engine/types'
import { BottomSheet } from './BottomSheet'

interface PlayDetailPopoverProps {
  play: {
    id?: number
    playType: string
    notation: string
    basesReached: number[]
    pitches: PitchResult[]
    runsScoredOnPlay: number
  }
  playsAfterCount?: number
  onUndo: (playId: number) => void
  onClose: () => void
}

export function PlayDetailPopover({ play, playsAfterCount = 0, onUndo, onClose }: PlayDetailPopoverProps) {
  const [confirmUndo, setConfirmUndo] = useState(false)

  // Compute pitch count summary
  let b = 0, s = 0
  for (const p of play.pitches) {
    if (p === 'B') b++
    else if (p === 'S') s = Math.min(s + 1, 2)
    else if (p === 'F') s = Math.min(s + 1, 2)
  }

  return (
    <BottomSheet onClose={onClose} title="Play Details">
      <div className="text-2xl font-bold text-slate-900 mb-1">{play.notation}</div>
      <div className="text-sm text-slate-500 mb-4">
        Count: {b}-{s} ({play.pitches.length} pitches)
      </div>

      {!confirmUndo ? (
        <button
          onClick={() => playsAfterCount > 0 ? setConfirmUndo(true) : (play.id !== undefined && onUndo(play.id))}
          className="w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg font-bold text-sm transition-all duration-150 active:scale-95"
        >
          Undo
        </button>
      ) : (
        <div>
          <p className="text-sm text-red-600 font-semibold mb-3">
            This will also remove {playsAfterCount} subsequent plays.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmUndo(false)}
              className="flex-1 bg-slate-200 text-slate-700 py-3 rounded-lg font-bold text-sm transition-all duration-150 active:scale-95"
            >
              Cancel
            </button>
            <button
              onClick={() => play.id !== undefined && onUndo(play.id)}
              className="flex-1 bg-red-600 text-white py-3 rounded-lg font-bold text-sm transition-all duration-150 active:scale-95"
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </BottomSheet>
  )
}
