import { useState } from 'react'
import type { PitchResult, PlayType, BaseRunner, BaseRunners } from '../engine/types'
import { PitchTracker } from './PitchTracker'
import { FieldDiagram } from './FieldDiagram'
import { parseShorthand, generateNotation } from '../engine/notation'

interface PlayRecordedData {
  playType: PlayType
  notation: string
  fieldersInvolved: number[]
  basesReached: number[]
  pitches: PitchResult[]
  isAtBat: boolean
  runnerOverrides?: { first: BaseRunner | null; second: BaseRunner | null; third: BaseRunner | null }
}

interface PlayEntryPanelProps {
  batterName: string
  baseRunners?: BaseRunners
  onPlayRecorded: (data: PlayRecordedData) => void
  onClose: () => void
}

type PanelMode = 'select' | 'fielding' | 'sb-runner-select'

const COMMON_PLAYS: { label: string; playType: PlayType; basesReached: number[] }[] = [
  { label: 'K', playType: 'K', basesReached: [] },
  { label: 'KL', playType: 'KL', basesReached: [] },
  { label: 'BB', playType: 'BB', basesReached: [1] },
  { label: 'HBP', playType: 'HBP', basesReached: [1] },
  { label: '1B', playType: '1B', basesReached: [1] },
  { label: '2B', playType: '2B', basesReached: [1, 2] },
  { label: '3B', playType: '3B', basesReached: [1, 2, 3] },
  { label: 'HR', playType: 'HR', basesReached: [1, 2, 3, 4] },
]

const FIELDING_PLAYS: { label: string; playType: PlayType }[] = [
  { label: 'Ground Out', playType: 'GO' },
  { label: 'Fly Out', playType: 'FO' },
  { label: 'Line Out', playType: 'LO' },
  { label: 'Pop Out', playType: 'PO' },
]

const SPECIAL_PLAYS: { label: string; playType: PlayType; basesReached: number[]; isAtBat: boolean }[] = [
  { label: 'FC', playType: 'FC', basesReached: [1], isAtBat: true },
  { label: 'E', playType: 'E', basesReached: [1], isAtBat: true },
  { label: 'DP', playType: 'DP', basesReached: [], isAtBat: true },
  { label: 'SAC', playType: 'SAC', basesReached: [], isAtBat: true },
  { label: 'SB', playType: 'SB', basesReached: [], isAtBat: false },
  { label: 'WP', playType: 'WP', basesReached: [], isAtBat: false },
  { label: 'PB', playType: 'PB', basesReached: [], isAtBat: false },
  { label: 'BK', playType: 'BK', basesReached: [], isAtBat: false },
]

export function PlayEntryPanel({ batterName, baseRunners, onPlayRecorded, onClose }: PlayEntryPanelProps) {
  const [pitches, setPitches] = useState<PitchResult[]>([])
  const [mode, setMode] = useState<PanelMode>('select')
  const [fieldingPlayType, setFieldingPlayType] = useState<PlayType>('GO')
  const [selectedPositions, setSelectedPositions] = useState<number[]>([])
  const [shorthand, setShorthand] = useState('')
  const [shorthandError, setShorthandError] = useState('')

  const handleAddPitch = (p: PitchResult) => setPitches([...pitches, p])
  const handleRemovePitch = () => setPitches(pitches.slice(0, -1))

  const recordSimplePlay = (playType: PlayType, basesReached: number[], isAtBat = true) => {
    onPlayRecorded({
      playType,
      notation: generateNotation(playType, []),
      fieldersInvolved: [],
      basesReached,
      pitches,
      isAtBat,
    })
  }

  const handleFieldingPlaySelect = (playType: PlayType) => {
    setFieldingPlayType(playType)
    setSelectedPositions([])
    setMode('fielding')
  }

  const handlePositionClick = (pos: number) => {
    if (selectedPositions.includes(pos)) {
      setSelectedPositions(selectedPositions.filter(p => p !== pos))
    } else {
      setSelectedPositions([...selectedPositions, pos])
    }
  }

  const handleConfirmFielding = () => {
    const notation = generateNotation(fieldingPlayType, selectedPositions)
    onPlayRecorded({
      playType: fieldingPlayType,
      notation,
      fieldersInvolved: selectedPositions,
      basesReached: [],
      pitches,
      isAtBat: true,
    })
  }

  const handleShorthandSubmit = () => {
    if (!shorthand.trim()) return
    const parsed = parseShorthand(shorthand)
    if (!parsed) {
      setShorthandError(`Unrecognized shorthand: "${shorthand}"`)
      return
    }
    setShorthandError('')
    onPlayRecorded({
      ...parsed,
      notation: generateNotation(parsed.playType, parsed.fieldersInvolved),
      pitches,
    })
    setShorthand('')
  }

  const handleSbClick = () => {
    const runners = baseRunners ?? { first: null, second: null, third: null }
    const occupied = (['third', 'second', 'first'] as const).filter(b => runners[b] !== null)
    if (occupied.length <= 1) {
      recordSimplePlay('SB', [], false)
    } else {
      setMode('sb-runner-select')
    }
  }

  const computeSbOverride = (stealing: 'first' | 'second') => {
    const runners = baseRunners ?? { first: null, second: null, third: null }
    const result = { first: runners.first, second: runners.second, third: runners.third }
    const runner = runners[stealing]
    if (!runner) return result
    result[stealing] = null
    if (stealing === 'first') result.second = runner
    else result.third = runner  // stealing === 'second'
    return result
  }

  const handleSbRunnerSelect = (stealing: 'first' | 'second' | 'third') => {
    if (stealing === 'third') {
      // Stealing home — no override; engine advances the 3rd-base runner to score
      onPlayRecorded({ playType: 'SB', notation: 'SB', fieldersInvolved: [], basesReached: [], pitches, isAtBat: false })
      return
    }
    onPlayRecorded({
      playType: 'SB',
      notation: 'SB',
      fieldersInvolved: [],
      basesReached: [],
      pitches,
      isAtBat: false,
      runnerOverrides: computeSbOverride(stealing),
    })
  }

  return (
    <div className="fixed inset-x-0 bottom-0 bg-white border-t-2 border-slate-300 shadow-2xl max-h-[80vh] overflow-y-auto z-50" style={{ animation: 'slideUp 200ms ease-out' }}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-sm text-slate-500">At bat:</span>
            <span className="ml-2 font-bold text-slate-900">{batterName}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none transition-colors duration-150">&times;</button>
        </div>

        {/* Pitch tracker */}
        <div className="mb-4">
          <PitchTracker pitches={pitches} onAddPitch={handleAddPitch} onRemovePitch={handleRemovePitch} />
        </div>

        {mode === 'select' && (
          <>
            {/* Common plays */}
            <div className="mb-3">
              <div className="text-xs font-semibold text-slate-500 mb-1.5">OUTCOME</div>
              <div className="grid grid-cols-4 gap-1.5">
                {COMMON_PLAYS.map(play => (
                  <button
                    key={play.label}
                    onClick={() => recordSimplePlay(play.playType, play.basesReached)}
                    className="bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-bold text-sm transition-all duration-150 ease-in-out active:scale-95"
                    {...(play.playType === 'KL' ? { 'aria-label': 'Strikeout looking' } : {})}
                  >
                    {play.playType === 'KL' ? (
                      <span data-testid="backwards-k-button" style={{ display: 'inline-block', transform: 'scaleX(-1)' }}>K</span>
                    ) : (
                      play.label
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Fielding plays */}
            <div className="mb-3">
              <div className="text-xs font-semibold text-slate-500 mb-1.5">FIELDING</div>
              <div className="grid grid-cols-2 gap-1.5">
                {FIELDING_PLAYS.map(play => (
                  <button
                    key={play.label}
                    onClick={() => handleFieldingPlaySelect(play.playType)}
                    className="bg-green-600 hover:bg-green-700 text-white py-2 rounded font-bold text-sm transition-all duration-150 ease-in-out active:scale-95"
                  >
                    {play.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Special plays */}
            <div className="mb-3">
              <div className="text-xs font-semibold text-slate-500 mb-1.5">SPECIAL</div>
              <div className="grid grid-cols-4 gap-1.5">
                {SPECIAL_PLAYS.map(play => (
                  <button
                    key={play.label}
                    onClick={() => play.playType === 'SB' ? handleSbClick() : recordSimplePlay(play.playType, play.basesReached, play.isAtBat)}
                    className="bg-amber-600 hover:bg-amber-700 text-white py-2 rounded font-bold text-sm transition-all duration-150 ease-in-out active:scale-95"
                  >
                    {play.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Shorthand input */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Shorthand (e.g. 6-3, 1B7, F8)"
                value={shorthand}
                onChange={e => { setShorthand(e.target.value); setShorthandError('') }}
                onKeyDown={e => e.key === 'Enter' && handleShorthandSubmit()}
                className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm font-mono"
              />
              <button
                onClick={handleShorthandSubmit}
                disabled={!shorthand.trim()}
                className="bg-slate-700 hover:bg-slate-800 disabled:bg-slate-300 text-white px-4 py-2 rounded text-sm font-bold transition-all duration-150 ease-in-out active:scale-95"
              >
                Enter
              </button>
            </div>
            {shorthandError && (
              <p className="text-red-600 text-xs mt-1">{shorthandError}</p>
            )}
          </>
        )}

        {mode === 'fielding' && (
          <div>
            <div className="text-sm font-semibold text-slate-700 mb-2 text-center">
              Tap fielders in order: {selectedPositions.join(' → ') || '(none selected)'}
            </div>
            <FieldDiagram selectedPositions={selectedPositions} onPositionClick={handlePositionClick} />
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { setMode('select'); setSelectedPositions([]) }}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 py-2 rounded font-bold text-sm transition-all duration-150 ease-in-out active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmFielding}
                disabled={selectedPositions.length === 0}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white py-2 rounded font-bold text-sm transition-all duration-150 ease-in-out active:scale-95"
              >
                Confirm
              </button>
            </div>
          </div>
        )}

        {mode === 'sb-runner-select' && baseRunners && (
          <div>
            <div className="text-sm font-semibold text-slate-700 mb-3 text-center">Who is stealing?</div>
            <div className="space-y-2">
              {(['third', 'second', 'first'] as const).map(base => {
                const runner = baseRunners[base]
                if (!runner) return null
                const baseLabel = base === 'first' ? '1st' : base === 'second' ? '2nd' : '3rd'
                return (
                  <button
                    key={base}
                    onClick={() => handleSbRunnerSelect(base)}
                    aria-label={`${runner.playerName} on ${baseLabel}`}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2.5 rounded-lg font-bold text-sm transition-all duration-150 active:scale-95"
                  >
                    {runner.playerName} ({baseLabel})
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => setMode('select')}
              className="w-full mt-2 bg-slate-200 hover:bg-slate-300 text-slate-700 py-2 rounded font-bold text-sm transition-all duration-150"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
