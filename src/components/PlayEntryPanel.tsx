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
  pitches: PitchResult[]
  outs?: number
  onAddPitch: (pitch: PitchResult) => void
  onRemovePitch: () => void
  onClear: () => void
  onPlayRecorded: (data: PlayRecordedData) => void
  onClose: () => void
}

type PanelMode = 'select' | 'fielding' | 'sb-runner-select' | 'error-batter-outcome'
type TabType = 'hit' | 'out' | 'special' | 'shorthand'

const HIT_PLAYS: { label: string; playType: PlayType; basesReached: number[] }[] = [
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

const RUNNER_REQUIRED: PlayType[] = ['FC', 'DP', 'SAC', 'SB', 'WP', 'PB', 'BK']

export function PlayEntryPanel({ batterName, baseRunners, pitches, outs, onAddPitch, onRemovePitch, onClear, onPlayRecorded, onClose }: PlayEntryPanelProps) {
  const [mode, setMode] = useState<PanelMode>('select')
  const [tab, setTab] = useState<TabType>('hit')
  const hasRunners = !!(baseRunners?.first || baseRunners?.second || baseRunners?.third)
  const [fieldingPlayType, setFieldingPlayType] = useState<PlayType>('GO')
  const [selectedPositions, setSelectedPositions] = useState<number[]>([])
  const [shorthand, setShorthand] = useState('')
  const [shorthandError, setShorthandError] = useState('')
  const [pendingErrorNotation, setPendingErrorNotation] = useState('')
  const [pendingErrorFielders, setPendingErrorFielders] = useState<number[]>([])

  const recordSimplePlay = (playType: PlayType, basesReached: number[], isAtBat = true) => {
    onPlayRecorded({
      playType,
      notation: generateNotation(playType, []),
      fieldersInvolved: [],
      basesReached,
      pitches: isAtBat ? pitches : [],
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
    if (fieldingPlayType === 'E') {
      setPendingErrorNotation(notation)
      setPendingErrorFielders([...selectedPositions])
      setMode('error-batter-outcome')
      return
    } else {
      onPlayRecorded({
        playType: fieldingPlayType,
        notation,
        fieldersInvolved: selectedPositions,
        basesReached: [],
        pitches,
        isAtBat: true,
      })
    }
  }

  const handleShorthandSubmit = () => {
    if (!shorthand.trim()) return
    const parsed = parseShorthand(shorthand)
    if (!parsed) {
      setShorthandError('Unrecognized notation. Try: 6-3 (groundout), 1B7 (single to left), F8 (flyout to center)')
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
      onPlayRecorded({ playType: 'SB', notation: 'SB', fieldersInvolved: [], basesReached: [], pitches: [], isAtBat: false })
      return
    }
    onPlayRecorded({
      playType: 'SB',
      notation: 'SB',
      fieldersInvolved: [],
      basesReached: [],
      pitches: [],
      isAtBat: false,
      runnerOverrides: computeSbOverride(stealing),
    })
  }

  const TABS: { key: TabType; label: string }[] = [
    { key: 'hit', label: 'Hit' },
    { key: 'out', label: 'Out' },
    { key: 'special', label: 'Special' },
    { key: 'shorthand', label: 'Shorthand' },
  ]

  return (
    <div className="fixed inset-x-0 bottom-0 bg-white border-t-2 border-slate-300 shadow-2xl max-h-[80vh] overflow-y-auto z-50" style={{ animation: 'slideUp 200ms ease-out' }}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-sm text-slate-500">At bat:</span>
            <span className="ml-2 font-bold text-slate-900">{batterName}</span>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700 text-2xl leading-none transition-colors duration-150"><span aria-hidden="true">&times;</span></button>
        </div>

        {/* Pitch tracker */}
        <div className="mb-4">
          <PitchTracker pitches={pitches} onAddPitch={onAddPitch} onRemovePitch={onRemovePitch} onClear={onClear} />
        </div>

        {mode === 'select' && (
          <>
            {/* Tab bar */}
            <div className="flex gap-1 mb-3">
              {TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold ${
                    tab === t.key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Hit tab */}
            {tab === 'hit' && (
              <div className="grid grid-cols-4 gap-2">
                {HIT_PLAYS.map(play => (
                  <button
                    key={play.label}
                    onClick={() => recordSimplePlay(play.playType, play.basesReached)}
                    className="bg-blue-600 hover:bg-blue-700 text-white py-3 rounded font-bold text-sm transition-all duration-150 ease-in-out active:scale-95"
                  >
                    {play.label}
                  </button>
                ))}
              </div>
            )}

            {/* Out tab */}
            {tab === 'out' && (
              <div className="grid grid-cols-2 gap-2">
                {FIELDING_PLAYS.map(play => (
                  <button
                    key={play.label}
                    onClick={() => handleFieldingPlaySelect(play.playType)}
                    className="bg-green-600 hover:bg-green-700 text-white py-3 rounded font-bold text-sm transition-all duration-150 ease-in-out active:scale-95"
                  >
                    {play.label}
                  </button>
                ))}
              </div>
            )}

            {/* Special tab */}
            {tab === 'special' && (
              <div className="grid grid-cols-4 gap-1.5">
                {SPECIAL_PLAYS.map(play => {
                  const needsRunners = RUNNER_REQUIRED.includes(play.playType)
                  const isSacWith2Outs = play.playType === 'SAC' && (outs ?? 0) >= 2
                  const disabled = (needsRunners && !hasRunners) || isSacWith2Outs

                  return (
                    <button
                      key={play.label}
                      onClick={() => {
                        if (disabled) return
                        if (play.playType === 'E') {
                          setFieldingPlayType('E' as PlayType)
                          setSelectedPositions([])
                          setMode('fielding')
                        } else if (play.playType === 'SB') {
                          handleSbClick()
                        } else {
                          recordSimplePlay(play.playType, play.basesReached, play.isAtBat)
                        }
                      }}
                      disabled={disabled}
                      className={`py-3 rounded font-bold text-sm transition-all duration-150 ease-in-out active:scale-95 ${
                        disabled
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          : 'bg-amber-600 hover:bg-amber-700 text-white'
                      }`}
                    >
                      {play.label}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Shorthand tab */}
            {tab === 'shorthand' && (
              <div>
                <p className="text-xs text-slate-500 mb-2">
                  Examples: <span className="font-mono">6-3</span> (groundout), <span className="font-mono">1B7</span> (single to left), <span className="font-mono">F8</span> (flyout to center)
                </p>
                <div className="flex gap-2">
                  <label className="sr-only" htmlFor="shorthand-input">Shorthand notation</label>
                  <input
                    id="shorthand-input"
                    type="text"
                    placeholder="Shorthand (e.g. 6-3, 1B7, F8)"
                    value={shorthand}
                    onChange={e => { setShorthand(e.target.value); setShorthandError('') }}
                    onKeyDown={e => e.key === 'Enter' && handleShorthandSubmit()}
                    className="flex-1 border border-slate-300 rounded px-3 py-3 text-sm font-mono"
                  />
                  <button
                    onClick={handleShorthandSubmit}
                    disabled={!shorthand.trim()}
                    className="bg-slate-700 hover:bg-slate-800 disabled:bg-slate-300 text-white px-4 py-3 rounded text-sm font-bold transition-all duration-150 ease-in-out active:scale-95"
                  >
                    Enter
                  </button>
                </div>
                {shorthandError && (
                  <p className="text-red-600 text-xs mt-1">{shorthandError}</p>
                )}
              </div>
            )}
          </>
        )}

        {mode === 'fielding' && (
          <div>
            <div className="text-sm font-semibold text-slate-700 mb-2 text-center">
              {fieldingPlayType === 'E'
                ? `Error by: ${selectedPositions.length > 0 ? selectedPositions[0] : '(tap a fielder)'}`
                : `Tap fielders in order: ${selectedPositions.join(' → ') || '(none selected)'}`
              }
            </div>
            <FieldDiagram selectedPositions={selectedPositions} onPositionClick={handlePositionClick} />
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { setMode('select'); setSelectedPositions([]) }}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 py-3 rounded font-bold text-sm transition-all duration-150 ease-in-out active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmFielding}
                disabled={selectedPositions.length === 0}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white py-3 rounded font-bold text-sm transition-all duration-150 ease-in-out active:scale-95"
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
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-lg font-bold text-sm transition-all duration-150 active:scale-95"
                  >
                    {runner.playerName} ({baseLabel})
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => setMode('select')}
              className="w-full mt-2 bg-slate-200 hover:bg-slate-300 text-slate-700 py-3 rounded font-bold text-sm transition-all duration-150"
            >
              Cancel
            </button>
          </div>
        )}
        {mode === 'error-batter-outcome' && (
          <div>
            <div className="text-sm font-semibold text-slate-700 mb-3 text-center">
              What happened to the batter?
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onPlayRecorded({
                    playType: 'E',
                    notation: pendingErrorNotation,
                    fieldersInvolved: pendingErrorFielders,
                    basesReached: [],
                    pitches: [],
                    isAtBat: false,
                  })
                }}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-lg font-bold text-sm transition-all duration-150 active:scale-95"
              >
                Stayed at bat
              </button>
              <button
                onClick={() => {
                  onPlayRecorded({
                    playType: 'E',
                    notation: pendingErrorNotation,
                    fieldersInvolved: pendingErrorFielders,
                    basesReached: [1],
                    pitches,
                    isAtBat: true,
                  })
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold text-sm transition-all duration-150 active:scale-95"
              >
                Reached base
              </button>
            </div>
            <button
              onClick={() => setMode('fielding')}
              className="w-full mt-2 bg-slate-200 hover:bg-slate-300 text-slate-700 py-3 rounded font-bold text-sm transition-all duration-150"
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
