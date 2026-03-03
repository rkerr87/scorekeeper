import { useState } from 'react'
import type { BaseRunners, BaseRunner } from '../engine/types'

type OrigBase = 'first' | 'second' | 'third'
type RunnerDest = 'first' | 'second' | 'third' | 'scored' | 'out'

interface RunnerConfirmationProps {
  runners: BaseRunners
  prePlayRunners?: BaseRunners
  onConfirm: (result: { runners: BaseRunners; runsScored: number }) => void
  onCancel: () => void
  initialRunsScored?: number
}

const DEST_LABELS: { dest: RunnerDest; label: string }[] = [
  { dest: 'first', label: '1st' },
  { dest: 'second', label: '2nd' },
  { dest: 'third', label: '3rd' },
  { dest: 'scored', label: 'Scored' },
  { dest: 'out', label: 'Out' },
]

const BASE_LABELS: Record<OrigBase, string> = {
  first: '1st',
  second: '2nd',
  third: '3rd',
}

const BASE_ORDER: Record<OrigBase, number> = { first: 1, second: 2, third: 3 }
const DEST_ORDER: Record<RunnerDest, number> = { first: 1, second: 2, third: 3, scored: 4, out: 0 }

function isValidDest(orig: OrigBase, dest: RunnerDest): boolean {
  if (dest === 'out') return true
  if (dest === 'scored') return true
  return DEST_ORDER[dest] >= BASE_ORDER[orig]
}

function initAssignments(preRunners: BaseRunners, postRunners: BaseRunners): Map<OrigBase, RunnerDest> {
  const m = new Map<OrigBase, RunnerDest>()
  const BASES: OrigBase[] = ['first', 'second', 'third']
  for (const orig of BASES) {
    const runner = preRunners[orig]
    if (!runner) continue
    // Find where this runner ended up in post-play state
    let dest: RunnerDest = 'scored' // default: not found on any base = scored
    for (const base of BASES) {
      if (postRunners[base]?.orderPosition === runner.orderPosition) {
        dest = base
        break
      }
    }
    m.set(orig, dest)
  }
  return m
}

function computeResult(
  sourceRunners: BaseRunners,
  assignments: Map<OrigBase, RunnerDest>,
  initialRunsScored: number,
): { runners: BaseRunners; runsScored: number } {
  const result: BaseRunners = { first: null, second: null, third: null }
  let runsScored = initialRunsScored

  const ORIG_BASES: OrigBase[] = ['third', 'second', 'first']
  for (const orig of ORIG_BASES) {
    const runner: BaseRunner | null = sourceRunners[orig]
    if (!runner) continue
    const dest = assignments.get(orig)
    if (!dest || dest === 'out') continue
    if (dest === 'scored') {
      runsScored++
    } else {
      result[dest] = runner
    }
  }

  return { runners: result, runsScored }
}

export function RunnerConfirmation({ runners, prePlayRunners, onConfirm, onCancel, initialRunsScored = 0 }: RunnerConfirmationProps) {
  // Use prePlayRunners for runner identity/labels; fall back to runners (post-play) for backward compat
  const sourceRunners = prePlayRunners ?? runners
  const [assignments, setAssignments] = useState<Map<OrigBase, RunnerDest>>(() => initAssignments(sourceRunners, runners))
  const [error, setError] = useState<string | null>(null)

  const setDest = (orig: OrigBase, dest: RunnerDest) => {
    setError(null)
    setAssignments(prev => new Map(prev).set(orig, dest))
  }

  const handleConfirm = () => {
    // Check for base collisions (two runners assigned to same base)
    const baseDests = Array.from(assignments.values()).filter(
      d => d !== 'scored' && d !== 'out'
    )
    const uniqueBaseDests = new Set(baseDests)
    if (baseDests.length !== uniqueBaseDests.size) {
      setError('Two runners cannot share the same base')
      return
    }
    setError(null)
    onConfirm(computeResult(sourceRunners, assignments, initialRunsScored))
  }

  const occupiedBases: OrigBase[] = (['third', 'second', 'first'] as OrigBase[]).filter(b => sourceRunners[b] !== null)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-slate-900">Where did they end up?</h3>
          <p className="text-xs text-slate-500 mt-0.5">The app made its best guess — tap to correct any runner.</p>
        </div>

        <div className="space-y-4 mb-6">
          {occupiedBases.map(orig => {
            const runner = sourceRunners[orig]!
            const currentDest = assignments.get(orig) ?? orig
            return (
              <div key={orig} className="bg-slate-50 rounded-lg p-3">
                <div className="text-xs font-semibold text-slate-500 mb-2">
                  {runner.playerName} <span className="text-slate-400">(was on {BASE_LABELS[orig]})</span>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {DEST_LABELS.map(({ dest, label }) => {
                    const valid = isValidDest(orig, dest)
                    return (
                      <button
                        key={dest}
                        onClick={() => setDest(orig, dest)}
                        disabled={!valid}
                        className={`px-3.5 py-2.5 rounded text-xs font-bold transition-all duration-150 ${
                          !valid
                            ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                            : currentDest === dest
                              ? dest === 'scored'
                                ? 'bg-green-600 text-white ring-2 ring-green-800 active:scale-95'
                                : dest === 'out'
                                  ? 'bg-red-500 text-white ring-2 ring-red-700 active:scale-95'
                                  : 'bg-blue-600 text-white ring-2 ring-blue-800 active:scale-95'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300 active:scale-95'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {occupiedBases.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-2">No runners on base</p>
          )}
        </div>

        {error && (
          <p className="text-red-600 text-sm font-semibold mb-3">{error}</p>
        )}

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 py-2.5 rounded-lg font-semibold transition-all duration-150 active:scale-95"
          >
            Cancel Play
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg font-semibold transition-all duration-150 active:scale-95"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}
