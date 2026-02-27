import { useState } from 'react'
import type { PitchResult } from '../engine/types'

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
  onEdit: (playId: number) => void
  onUndo: (playId: number) => void
  onClose: () => void
}

export function PlayDetailPopover({ play, playsAfterCount = 0, onEdit, onUndo, onClose }: PlayDetailPopoverProps) {
  const [confirmUndo, setConfirmUndo] = useState(false)

  // Compute pitch count summary
  let b = 0, s = 0
  for (const p of play.pitches) {
    if (p === 'B') b++
    else if (p === 'S') s = Math.min(s + 1, 2)
    else if (p === 'F') s = Math.min(s + 1, 2)
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-5 max-w-xs w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="text-2xl font-bold text-slate-900 mb-1">{play.notation}</div>
        <div className="text-sm text-slate-500 mb-4">
          Count: {b}-{s} ({play.pitches.length} pitches)
        </div>

        {!confirmUndo ? (
          <div className="flex gap-2">
            <button
              onClick={() => play.id !== undefined && onEdit(play.id)}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-bold text-sm transition-all duration-150 active:scale-95"
            >
              Edit
            </button>
            <button
              onClick={() => playsAfterCount > 0 ? setConfirmUndo(true) : (play.id !== undefined && onUndo(play.id))}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg font-bold text-sm transition-all duration-150 active:scale-95"
            >
              Undo
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-red-600 font-semibold mb-3">
              This will also remove {playsAfterCount} subsequent plays.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmUndo(false)}
                className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg font-bold text-sm transition-all duration-150 active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={() => play.id !== undefined && onUndo(play.id)}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg font-bold text-sm transition-all duration-150 active:scale-95"
              >
                Confirm
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
