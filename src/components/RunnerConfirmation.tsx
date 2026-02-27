import { useState } from 'react'
import type { BaseRunners } from '../engine/types'

interface RunnerConfirmationProps {
  runners: BaseRunners
  onConfirm: (runners: BaseRunners) => void
  onCancel: () => void
}

export function RunnerConfirmation({ runners, onConfirm, onCancel }: RunnerConfirmationProps) {
  const [current, setCurrent] = useState<BaseRunners>({ ...runners })

  const clearBase = (base: 'first' | 'second' | 'third') => {
    setCurrent({ ...current, [base]: null })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Confirm Runners</h3>

        <div className="space-y-3 mb-6">
          {/* Third base */}
          <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-2">
            <span className="text-sm font-semibold text-slate-600">3rd</span>
            {current.third ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{current.third.playerName}</span>
                <button onClick={() => clearBase('third')} className="text-red-400 hover:text-red-600 text-xs transition-all duration-150 ease-in-out active:scale-95">clear</button>
              </div>
            ) : (
              <span className="text-xs text-slate-400">empty</span>
            )}
          </div>

          {/* Second base */}
          <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-2">
            <span className="text-sm font-semibold text-slate-600">2nd</span>
            {current.second ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{current.second.playerName}</span>
                <button onClick={() => clearBase('second')} className="text-red-400 hover:text-red-600 text-xs transition-all duration-150 ease-in-out active:scale-95">clear</button>
              </div>
            ) : (
              <span className="text-xs text-slate-400">empty</span>
            )}
          </div>

          {/* First base */}
          <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-2">
            <span className="text-sm font-semibold text-slate-600">1st</span>
            {current.first ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{current.first.playerName}</span>
                <button onClick={() => clearBase('first')} className="text-red-400 hover:text-red-600 text-xs transition-all duration-150 ease-in-out active:scale-95">clear</button>
              </div>
            ) : (
              <span className="text-xs text-slate-400">empty</span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 py-2.5 rounded-lg font-semibold transition-all duration-150 ease-in-out active:scale-95"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(current)}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg font-semibold transition-all duration-150 ease-in-out active:scale-95"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}
