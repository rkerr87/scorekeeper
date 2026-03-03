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

  let b = 0
  let s = 0
  for (const p of pitches) {
    if (p === 'B') b++
    else if (p === 'S') s = Math.min(s + 1, 2)
    else if (p === 'F') s = Math.min(s + 1, 2) // foul can bring to 2 but not 3
  }

  return (
    <div className="bg-slate-100 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-lg font-mono font-bold text-slate-800">{b}-{s}</div>
        <div className="text-xs text-slate-500">{pitches.length} pitches</div>
      </div>

      <div className="flex items-center gap-1 mb-3">
        {pitches.map((p, i) => (
          <div
            key={i}
            data-testid="pitch-dot"
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${
              p === 'B' ? 'bg-blue-500' : p === 'S' ? 'bg-red-500' : 'bg-amber-500'
            }`}
          >
            {p}
          </div>
        ))}
      </div>

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
