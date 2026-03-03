import { useState, useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useGame } from '../contexts/GameContext'
import { ScoreSummary } from '../components/ScoreSummary'
import { Scoresheet } from '../components/Scoresheet'
import { PlayEntryPanel } from '../components/PlayEntryPanel'
import { RunnerConfirmation } from '../components/RunnerConfirmation'
import type { BaseRunner, BaseRunners, HalfInning, Play, PlayType, PitchResult, Side } from '../engine/types'
import { replayGame } from '../engine/engine'
import { BeginnerGuide } from '../components/BeginnerGuide'
import { PlayDetailPopover } from '../components/PlayDetailPopover'
import { PositionChangeDialog } from '../components/PositionChangeDialog'
import { Spinner } from '../components/Spinner'
import { BottomSheet } from '../components/BottomSheet'
import { useToast } from '../contexts/ToastContext'

type ActiveTab = 'home' | 'away'

interface PendingPlay {
  playType: PlayType
  notation: string
  fieldersInvolved: number[]
  basesReached: number[]
  pitches: PitchResult[]
  isAtBat: boolean
  runnerOverrides?: { first: BaseRunner | null; second: BaseRunner | null; third: BaseRunner | null }
}

export function GamePage() {
  const { gameId } = useParams()
  const { showToast } = useToast()
  const {
    game, lineupHome, lineupAway, homeTeam, awayTeam, plays, snapshot,
    loadGame, recordPlay, undoLastPlay, undoFromPlay, updateLineupPositions,
  } = useGame()

  const [activeTab, setActiveTab] = useState<ActiveTab>('away')
  const [lastRecordedPlay, setLastRecordedPlay] = useState<{ playType: PlayType; notation: string } | null>(null)
  // trackedHalfKey records the snapshot half key that activeTab was last
  // auto-synced to. Updated during render (not in an effect) to avoid the
  // react-hooks/set-state-in-effect lint rule.
  const [trackedHalfKey, setTrackedHalfKey] = useState<string>('')
  // prevHalfKeyRef tracks the half key seen by the last useEffect run so we can
  // detect half changes after render and fire the "Side retired" toast. Using a ref
  // avoids calling setState in an effect (which triggers the set-state-in-effect rule)
  // and avoids calling showToast during render (which would update ToastProvider's
  // cross-component state mid-render, violating React's rules).
  const prevHalfKeyRef = useRef<string>('')
  const [showPlayEntry, setShowPlayEntry] = useState(false)
  const [currentAtBatPitches, setCurrentAtBatPitches] = useState<PitchResult[]>([])
  const [pendingPlay, setPendingPlay] = useState<PendingPlay | null>(null)
  const [pendingRunners, setPendingRunners] = useState<BaseRunners | null>(null)
  const [pendingPrePlayRunners, setPendingPrePlayRunners] = useState<BaseRunners | null>(null)
  const [pendingPreRunsScored, setPendingPreRunsScored] = useState(0)
  const [gameOverDismissed, setGameOverDismissed] = useState(false)
  const [showStrikeoutConfirm, setShowStrikeoutConfirm] = useState(false)
  const [selectedPlay, setSelectedPlay] = useState<Play | null>(null)
  const [showPosChange, setShowPosChange] = useState(false)
  const [showPitchCounts, setShowPitchCounts] = useState(false)

  const gId = parseInt(gameId ?? '0')

  useEffect(() => {
    if (gId && (!game || game.id !== gId)) {
      loadGame(gId)
    }
  }, [gId, game, loadGame])

  // Show "Side retired" toast when the half changes. Using a ref (prevHalfKeyRef)
  // avoids calling showToast (which updates cross-component ToastProvider state) during
  // render (which would violate React's rules), while also avoiding setState-in-effect.
  useEffect(() => {
    const prev = prevHalfKeyRef.current
    prevHalfKeyRef.current = trackedHalfKey
    if (!prev || !trackedHalfKey || prev === trackedHalfKey) return
    const prevGameId = prev.split('-')[0]
    const gameChanged = prevGameId !== trackedHalfKey.split('-')[0]
    if (gameChanged) return
    // Half changed within the same game — fire the toast
    const [, inningStr, half] = trackedHalfKey.split('-')
    const halfLabel = half === 'top' ? 'Top' : 'Bot'
    showToast(`Side retired — ${halfLabel} ${inningStr}`, 'info')
  }, [trackedHalfKey, showToast])


  if (!game || !snapshot || !lineupHome || !lineupAway) {
    return <Spinner />
  }

  const beginnerGuideDismissCount = parseInt(localStorage.getItem('beginnerGuideDismisses') ?? '0')
  const showBeginnerGuide = beginnerGuideDismissCount < 3 && lastRecordedPlay !== null

  const handleDismissGuide = () => {
    const count = parseInt(localStorage.getItem('beginnerGuideDismisses') ?? '0') + 1
    localStorage.setItem('beginnerGuideDismisses', String(count))
    setLastRecordedPlay(null)
  }

  // Auto-switch tab when the half or game changes (during render, not in an effect).
  // React supports calling setState during render for derived-state updates — it discards
  // the current render and immediately re-renders with the updated state.
  // Include game.id so switching between games (which may share the same inning/half)
  // forces re-evaluation of which team is batting.
  const halfKey = `${game.id}-${snapshot.inning}-${snapshot.half}`
  if (trackedHalfKey !== halfKey && trackedHalfKey !== '') {
    setTrackedHalfKey(halfKey)
    setActiveTab(snapshot.half === 'bottom' ? 'home' : 'away')
    setCurrentAtBatPitches([])
  } else if (trackedHalfKey === '') {
    // First render after game loads — sync tab to the currently batting team
    setTrackedHalfKey(halfKey)
    setActiveTab(snapshot.half === 'bottom' ? 'home' : 'away')
  }

  const activeLineup = activeTab === 'home' ? lineupHome : lineupAway
  const currentBatter = activeTab === 'home' ? snapshot.currentBatterHome : snapshot.currentBatterAway
  const activePlays = plays.filter(p =>
    activeTab === 'home' ? p.half === 'bottom' : p.half === 'top'
  )

  // Determine current pitcher for pitch count
  const pitcherLineup = snapshot.half === 'bottom' ? lineupAway : lineupHome
  const currentPitcher = pitcherLineup.battingOrder.find(s => s.position === 'P')
  const pitcherName = currentPitcher?.playerName ?? 'Unknown'
  const pitchCount = snapshot.pitchCountByPitcher.get(pitcherName) ?? 0

  // Current batter slot for play entry panel — use snapshot.half, not activeTab
  const currentBatterSlot = snapshot.half === 'bottom'
    ? lineupHome.battingOrder.find(s => s.orderPosition === snapshot.currentBatterHome)
    : lineupAway.battingOrder.find(s => s.orderPosition === snapshot.currentBatterAway)

  const handleAddPitch = (p: PitchResult) => {
    const newPitches = [...currentAtBatPitches, p]
    setCurrentAtBatPitches(newPitches)

    // Count balls and strikes from the FULL sequence
    let balls = 0, strikes = 0
    for (const pitch of newPitches) {
      if (pitch === 'B') balls++
      else if (pitch === 'S') strikes++
      else if (pitch === 'F') strikes = Math.min(strikes + 1, 2)
    }

    // Auto-walk on 4th ball
    if (balls >= 4) {
      const walkPlay: PendingPlay = {
        playType: 'BB',
        notation: 'BB',
        fieldersInvolved: [],
        basesReached: [1],
        pitches: newPitches,
        isAtBat: true,
      }
      setShowPlayEntry(false)
      setTimeout(() => handlePlayRecorded(walkPlay), 0)
      return
    }

    // Auto-strikeout on 3rd strike (only triggered by 'S', not 'F')
    if (p === 'S' && strikes >= 3) {
      setShowStrikeoutConfirm(true)
    }
  }
  const handleRemovePitch = () => setCurrentAtBatPitches(prev => prev.slice(0, -1))
  const handleClearPitches = () => setCurrentAtBatPitches([])

  const handleStrikeoutConfirm = (type: 'K' | 'KL') => {
    const play: PendingPlay = {
      playType: type,
      notation: type === 'KL' ? 'KL' : 'K',
      fieldersInvolved: [],
      basesReached: [],
      pitches: currentAtBatPitches,
      isAtBat: true,
    }
    setShowStrikeoutConfirm(false)
    setShowPlayEntry(false)
    handlePlayRecorded(play)
  }

  const handlePlayRecorded = (data: PendingPlay) => {
    // Determine the actual current batter position based on current half
    const batterPos = snapshot.half === 'bottom'
      ? snapshot.currentBatterHome
      : snapshot.currentBatterAway

    // Compute what runners would look like after this play
    const tempPlays = [...plays, {
      id: undefined,
      gameId: gId,
      sequenceNumber: plays.length + 1,
      inning: snapshot.inning,
      half: snapshot.half,
      batterOrderPosition: batterPos,
      ...data,
      runnerOverrides: data.runnerOverrides,
      runsScoredOnPlay: 0,
      rbis: 0,
      timestamp: new Date(),
    }]

    const tempSnapshot = replayGame(tempPlays, lineupHome, lineupAway)

    const hasRunnersOnBase = !!(snapshot.baseRunners.first || snapshot.baseRunners.second || snapshot.baseRunners.third)
    const affectsRunners = data.basesReached.length > 0 ||
      ['SB', 'WP', 'PB', 'BK', 'FC', 'E'].includes(data.playType)
    const isOut = ['K', 'KL', 'GO', 'FO', 'LO', 'PO', 'SAC', 'DP'].includes(data.playType)
    // Show RunnerConfirmation for plays where batter reaches base (1B/2B/3B, E),
    // even with empty bases, so scorekeeper can adjust batter advancement
    const isBatterReachingBase = ['1B', '2B', '3B'].includes(data.playType) ||
      (data.playType === 'E' && data.isAtBat)

    if (hasRunnersOnBase && (affectsRunners || isOut) || isBatterReachingBase) {
      // Only count batter's own run (HR) as initialRunsScored.
      // Runner runs are counted by RunnerConfirmation via assignments — don't double-count.
      const batterScored = data.basesReached.includes(4) ? 1 : 0
      setPendingPlay(data)
      setPendingPrePlayRunners(snapshot.baseRunners)
      setPendingRunners(tempSnapshot.baseRunners)
      setPendingPreRunsScored(batterScored)
      setShowPlayEntry(false)
    } else {
      finalizePlay(data)
    }
  }

  const finalizePlay = (data: PendingPlay, runnerOverrides?: BaseRunners, runsScoredOverride?: number) => {
    const half: HalfInning = snapshot.half
    const batterPos = half === 'bottom'
      ? snapshot.currentBatterHome
      : snapshot.currentBatterAway

    let runsScored: number

    if (runnerOverrides !== undefined && runsScoredOverride !== undefined) {
      runsScored = runsScoredOverride
    } else {
      const tempPlays = [...plays, {
        id: undefined,
        gameId: gId,
        sequenceNumber: plays.length + 1,
        inning: snapshot.inning,
        half,
        batterOrderPosition: batterPos,
        ...data,
        runsScoredOnPlay: 0,
        rbis: 0,
        timestamp: new Date(),
      }]
      const tempSnapshot = replayGame(tempPlays, lineupHome, lineupAway)
      runsScored = half === 'bottom'
        ? tempSnapshot.scoreHome - snapshot.scoreHome
        : tempSnapshot.scoreAway - snapshot.scoreAway
    }

    recordPlay({
      inning: snapshot.inning,
      half,
      batterOrderPosition: batterPos,
      playType: data.playType,
      notation: data.notation,
      fieldersInvolved: data.fieldersInvolved,
      basesReached: data.basesReached,
      runsScoredOnPlay: runsScored,
      rbis: data.isAtBat && data.basesReached.length > 0 ? runsScored : 0,
      pitches: data.pitches,
      isAtBat: data.isAtBat,
      runnerOverrides: runnerOverrides
        ? { first: runnerOverrides.first, second: runnerOverrides.second, third: runnerOverrides.third }
        : undefined,
    })

    if (data.isAtBat) {
      setCurrentAtBatPitches([])
    }
    setLastRecordedPlay({ playType: data.playType, notation: data.notation })
    setShowPlayEntry(false)
    setPendingPlay(null)
    setPendingRunners(null)
    setPendingPrePlayRunners(null)
    setPendingPreRunsScored(0)
    showToast(`Play recorded — ${data.playType}`, 'success')
  }

  const handleRunnerConfirm = (result: { runners: BaseRunners; runsScored: number; batterBase?: number }) => {
    if (pendingPlay) {
      let playData = pendingPlay
      if (result.batterBase !== undefined) {
        // Batter took an extra base — extend basesReached up to their final base
        const basesReached = Array.from(
          { length: result.batterBase },
          (_, i) => i + 1
        )
        playData = { ...pendingPlay, basesReached }
      }
      finalizePlay(playData, result.runners, result.runsScored)
    }
  }

  const handleRunnerCancel = () => {
    setPendingPlay(null)
    setPendingRunners(null)
    setPendingPrePlayRunners(null)
    setPendingPreRunsScored(0)
  }

  // Defensive team lineup — position changes apply to the team NOT batting
  const defensiveLineup = snapshot.half === 'bottom' ? lineupAway : lineupHome

  const handlePositionChange = async (changes: { orderPosition: number; newPosition: string }[]) => {
    // Position changes are for the defensive team
    const side: Side = snapshot.half === 'bottom' ? 'away' : 'home'
    await updateLineupPositions(side, changes, snapshot.inning, snapshot.half)
    setShowPosChange(false)
    showToast('Position change saved', 'success')
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Persistent back button */}
      <div className="bg-slate-800 px-3 pt-2 flex items-center">
        <Link
          to="/"
          className="text-slate-400 hover:text-white text-sm font-medium"
        >
          ← Home
        </Link>
      </div>

      {/* Score summary */}
      <ScoreSummary
        inning={snapshot.inning}
        half={snapshot.half}
        outs={snapshot.outs}
        scoreHome={snapshot.scoreHome}
        scoreAway={snapshot.scoreAway}
        homeTeamName={homeTeam?.name ?? 'Home'}
        awayTeamName={awayTeam?.name ?? 'Away'}
        pitchCount={pitchCount}
        pitcherName={pitcherName}
        onPitchCountClick={() => setShowPitchCounts(true)}
      />

      {/* Home/Away tabs — away always left, home always right */}
      <div className="flex border-b border-slate-200 bg-white">
        <button
          onClick={() => setActiveTab('away')}
          className={`flex-1 py-2 text-sm font-bold text-center transition-all duration-150 font-heading uppercase tracking-wide ${
            activeTab === 'away' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'
          }`}
        >
          {awayTeam?.name ?? 'Away'} (Away)
        </button>
        <button
          onClick={() => setActiveTab('home')}
          className={`flex-1 py-2 text-sm font-bold text-center transition-all duration-150 font-heading uppercase tracking-wide ${
            activeTab === 'home' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'
          }`}
        >
          {homeTeam?.name ?? 'Home'} (Home)
        </button>
      </div>

      {/* Scoresheet */}
      <div className="flex-1 overflow-auto">
        <Scoresheet
          lineup={activeLineup.battingOrder}
          plays={activePlays}
          allPlays={plays}
          lineupHome={lineupHome}
          lineupAway={lineupAway}
          currentInning={snapshot.inning}
          currentBatterPosition={currentBatter}
          maxInnings={6}
          onCellClick={(batterPosition, inning, play) => {
            if (play) {
              setSelectedPlay(play)
            } else if (
              batterPosition === currentBatter &&
              inning === snapshot.inning &&
              !snapshot.isGameOver
            ) {
              setShowPlayEntry(true)
            }
            // Empty future cell: do nothing
          }}
          runsMap={activeTab === 'home' ? snapshot.runsScoredByPositionHome : snapshot.runsScoredByPositionAway}
        />
      </div>

      {/* Beginner guide card */}
      {showBeginnerGuide && lastRecordedPlay && (
        <div className="px-3 pt-2 bg-white border-t border-slate-100">
          <BeginnerGuide
            playType={lastRecordedPlay.playType}
            notation={lastRecordedPlay.notation}
            onDismiss={handleDismissGuide}
          />
        </div>
      )}

      {/* Bottom action bar */}
      <div className="p-3 bg-white border-t border-slate-200 flex gap-2">
        <button
          onClick={() => setShowPlayEntry(true)}
          disabled={snapshot.isGameOver}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white py-2.5 rounded-lg font-bold transition-all duration-150 ease-in-out active:scale-95 font-heading uppercase"
        >
          Record Play
        </button>
        <button
          onClick={() => setShowPosChange(true)}
          disabled={snapshot.isGameOver}
          className="bg-slate-200 hover:bg-slate-300 disabled:bg-slate-100 disabled:text-slate-400 text-slate-700 py-2.5 px-4 rounded-lg font-bold transition-all duration-150 ease-in-out active:scale-95 font-heading uppercase"
        >
          Pos Change
        </button>
        <button
          onClick={() => { undoLastPlay(); setCurrentAtBatPitches([]); showToast('Play undone', 'info') }}
          disabled={plays.length === 0}
          className="bg-slate-200 hover:bg-slate-300 disabled:bg-slate-100 disabled:text-slate-400 text-slate-700 py-2.5 px-4 rounded-lg font-bold transition-all duration-150 ease-in-out active:scale-95 font-heading uppercase"
        >
          Undo
        </button>
      </div>

      {/* Play entry panel */}
      {showPlayEntry && (
        <PlayEntryPanel
          batterName={currentBatterSlot?.playerName ?? 'Unknown'}
          baseRunners={snapshot.baseRunners}
          pitches={currentAtBatPitches}
          outs={snapshot.outs}
          onAddPitch={handleAddPitch}
          onRemovePitch={handleRemovePitch}
          onClear={handleClearPitches}
          onPlayRecorded={handlePlayRecorded}
          onClose={() => setShowPlayEntry(false)}
        />
      )}

      {/* Strikeout confirmation dialog */}
      {showStrikeoutConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-xs w-full mx-4 text-center">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Swinging or looking?</h3>
            <div className="flex gap-3">
              <button
                onClick={() => handleStrikeoutConfirm('K')}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-bold transition-all duration-150 active:scale-95"
              >
                K (Swinging)
              </button>
              <button
                onClick={() => handleStrikeoutConfirm('KL')}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-bold transition-all duration-150 active:scale-95"
              >
                <span style={{ display: 'inline-block', transform: 'scaleX(-1)' }}>K</span> (Looking)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Play detail popover */}
      {selectedPlay && (
        <PlayDetailPopover
          play={selectedPlay}
          playsAfterCount={plays.filter(p => p.sequenceNumber > selectedPlay.sequenceNumber).length}
          onUndo={async (playId) => {
            await undoFromPlay(playId)
            setSelectedPlay(null)
            setCurrentAtBatPitches([])
          }}
          onClose={() => setSelectedPlay(null)}
        />
      )}

      {/* Position change dialog */}
      {showPosChange && (
        <PositionChangeDialog
          lineup={defensiveLineup.battingOrder}
          onConfirm={handlePositionChange}
          onCancel={() => setShowPosChange(false)}
        />
      )}

      {/* Pitch count summary */}
      {showPitchCounts && (
        <BottomSheet onClose={() => setShowPitchCounts(false)} title="Pitch Counts">
          {[
            { label: awayTeam?.name ?? 'Away', lineup: lineupAway },
            { label: homeTeam?.name ?? 'Home', lineup: lineupHome },
          ].map(({ label, lineup }) => {
            const pitchers = lineup.battingOrder.filter(
              s => snapshot.pitchCountByPitcher.has(s.playerName)
            )
            if (pitchers.length === 0) return null
            return (
              <div key={label} className="mb-4">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">{label}</div>
                {pitchers.map(p => {
                  const count = snapshot.pitchCountByPitcher.get(p.playerName) ?? 0
                  const isCurrent = p.playerName === pitcherName
                  return (
                    <div
                      key={p.playerName}
                      className={`flex justify-between items-center py-2 px-3 rounded ${isCurrent ? 'bg-blue-50 font-bold' : ''}`}
                    >
                      <span className={isCurrent ? 'text-blue-700' : 'text-slate-700'}>{p.playerName}</span>
                      <span className={`text-lg font-mono ${isCurrent ? 'text-blue-700' : 'text-slate-900'}`}>{count}</span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </BottomSheet>
      )}

      {/* Runner confirmation */}
      {pendingRunners && pendingPlay && (
        <RunnerConfirmation
          prePlayRunners={pendingPrePlayRunners ?? undefined}
          runners={pendingRunners}
          initialRunsScored={pendingPreRunsScored}
          onConfirm={handleRunnerConfirm}
          onCancel={handleRunnerCancel}
          {...((['1B', '2B', '3B'].includes(pendingPlay.playType) || (pendingPlay.playType === 'E' && pendingPlay.isAtBat)) && pendingPlay.basesReached.length > 0 ? {
            batterName: currentBatterSlot?.playerName ?? 'Unknown',
            batterDefaultBase: Math.max(...pendingPlay.basesReached),
          } : {})}
        />
      )}

      {/* Game-over overlay */}
      {snapshot.isGameOver && !gameOverDismissed && (
        <div
          className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-60"
          onClick={() => setGameOverDismissed(true)}
        >
          <div
            className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 text-center"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Game Over</div>
            <div className="text-5xl font-bold text-slate-900 mb-1">
              {snapshot.scoreAway} — {snapshot.scoreHome}
            </div>
            <div className="text-lg font-semibold text-slate-600 mb-8">
              {snapshot.scoreHome !== snapshot.scoreAway
                ? `${snapshot.scoreHome > snapshot.scoreAway ? (homeTeam?.name ?? 'Home') : (awayTeam?.name ?? 'Away')} wins!`
                : 'Tie game.'}
            </div>
            <div className="flex gap-3 mt-6">
              <Link
                to={`/game/${gId}/stats`}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold text-center"
              >
                View Stats
              </Link>
              <Link
                to="/"
                className="flex-1 bg-slate-200 text-slate-700 py-3 rounded-lg font-bold text-center"
              >
                Home
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
