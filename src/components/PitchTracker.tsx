import { useState } from 'react'
import type { PitchResult } from '../engine/types'

interface PitchTrackerProps {
  pitches: PitchResult[]
  onAddPitch: (pitch: PitchResult) => void
  onRemovePitch: () => void
  onClear: () => void
}

export function PitchTracker({ pitches, onAddPitch, onRemovePitch, onClear }: PitchTrackerProps) {
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  // Fill boxes left-to-right as pitches accumulate.
  // 3 ball boxes: the 4th ball triggers auto-walk (no 4th box needed).
  // 2 strike boxes: the 3rd S triggers auto-K confirmation (no 3rd box needed).
  // F fills a strike box only if below 2 strikes (can't foul into K).
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
    <div className="bg-slate-100 rounded-lg p-3">
      {/* Two-row box display */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 w-12 shrink-0">Balls</span>
          <div className="flex gap-1.5">
            {ballBoxes.map((filled, i) => (
              <div
                key={i}
                data-testid={filled ? 'ball-box-filled' : 'ball-box-empty'}
                className={`w-9 h-8 rounded border-2 flex items-center justify-center text-sm font-bold ${
                  filled ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white border-slate-300'
                }`}
              >
                {filled && 'B'}
              </div>
            ))}
          </div>
          <span className="text-xs text-slate-400 ml-1">{pitches.length > 0 ? `${pitches.length} pitches` : ''}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 w-12 shrink-0">Strikes</span>
          <div className="flex gap-1.5">
            {strikeBoxes.map((filled, i) => (
              <div
                key={i}
                data-testid={filled ? 'strike-box-filled' : 'strike-box-empty'}
                className={`w-9 h-8 rounded border-2 flex items-center justify-center text-sm font-bold ${
                  filled === 'S' ? 'bg-red-500 border-red-500 text-white' :
                  filled === 'F' ? 'bg-amber-500 border-amber-500 text-white' :
                  'bg-white border-slate-300'
                }`}
              >
                {filled ?? ''}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pitch entry buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => onAddPitch('B')}
          className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-bold text-sm"
        >
          Ball
        </button>
        <button
          onClick={() => onAddPitch('S')}
          className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg font-bold text-sm"
        >
          Strike
        </button>
        <button
          onClick={() => onAddPitch('F')}
          className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-lg font-bold text-sm"
        >
          Foul
        </button>
        {pitches.length > 0 && (
          <button
            onClick={onRemovePitch}
            className="bg-slate-300 hover:bg-slate-400 text-slate-700 py-3 px-3 rounded-lg font-bold text-sm"
          >
            Undo
          </button>
        )}
      </div>

      {showClearConfirm ? (
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-slate-600">Clear {pitches.length} pitches?</span>
          <button
            onClick={() => { onClear(); setShowClearConfirm(false) }}
            className="text-red-600 font-bold text-xs"
          >
            Clear
          </button>
          <button
            onClick={() => setShowClearConfirm(false)}
            className="text-slate-500 text-xs"
          >
            Cancel
          </button>
        </div>
      ) : (
        pitches.length > 0 && (
          <button
            onClick={() => setShowClearConfirm(true)}
            className="mt-2 text-xs text-slate-500 hover:text-slate-700"
          >
            Clear pitches
          </button>
        )
      )}
    </div>
  )
}
