import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGame } from '../contexts/GameContext'
import { ScoreSummary } from '../components/ScoreSummary'
import { Scoresheet } from '../components/Scoresheet'
import { PlayEntryPanel } from '../components/PlayEntryPanel'
import { RunnerConfirmation } from '../components/RunnerConfirmation'
import type { BaseRunner, BaseRunners, HalfInning, PlayType, PitchResult } from '../engine/types'
import { replayGame } from '../engine/engine'
import { BeginnerGuide } from '../components/BeginnerGuide'

type ActiveTab = 'us' | 'them'

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
  const navigate = useNavigate()
  const {
    game, lineupUs, lineupThem, plays, snapshot,
    loadGame, recordPlay, undoLastPlay,
  } = useGame()

  const [activeTab, setActiveTab] = useState<ActiveTab>('us')
  const [lastRecordedPlay, setLastRecordedPlay] = useState<{ playType: PlayType; notation: string } | null>(null)
  // trackedHalfKey records the snapshot half key that activeTab and pendingToast were last
  // auto-synced to. Updated during render (not in an effect) to avoid the
  // react-hooks/set-state-in-effect lint rule.
  const [trackedHalfKey, setTrackedHalfKey] = useState<string>('')
  // pendingToast is set during render when the half changes; derived directly as the
  // visible toast message. The effect below schedules its clearance after 3 seconds.
  const [pendingToast, setPendingToast] = useState<string | null>(null)
  const [showPlayEntry, setShowPlayEntry] = useState(false)
  const [pendingPlay, setPendingPlay] = useState<PendingPlay | null>(null)
  const [pendingRunners, setPendingRunners] = useState<BaseRunners | null>(null)
  const [pendingPreRunsScored, setPendingPreRunsScored] = useState(0)
  const [gameOverDismissed, setGameOverDismissed] = useState(false)

  const gId = parseInt(gameId ?? '0')

  useEffect(() => {
    if (gId && (!game || game.id !== gId)) {
      loadGame(gId)
    }
  }, [gId, game, loadGame])

  // Auto-dismiss toast after 3 seconds (setPendingToast inside setTimeout is async — not flagged)
  useEffect(() => {
    if (!pendingToast) return
    const timer = setTimeout(() => setPendingToast(null), 3000)
    return () => clearTimeout(timer)
  }, [pendingToast])

  // Auto-dismiss beginner guide card after 5 seconds
  useEffect(() => {
    if (!lastRecordedPlay) return
    const timer = setTimeout(() => setLastRecordedPlay(null), 5000)
    return () => clearTimeout(timer)
  }, [lastRecordedPlay])

  if (!game || !snapshot || !lineupUs || !lineupThem) {
    return <div className="p-6 text-slate-500">Loading game...</div>
  }

  // Determine which half "us" bats in
  const usBattingHalf: HalfInning = game.homeOrAway === 'home' ? 'bottom' : 'top'
  const themBattingHalf: HalfInning = usBattingHalf === 'top' ? 'bottom' : 'top'

  // Auto-switch tab when the half changes (during render, not in an effect).
  // React supports calling setState during render for derived-state updates — it discards
  // the current render and immediately re-renders with the updated state.
  const halfKey = `${snapshot.inning}-${snapshot.half}`
  if (trackedHalfKey !== halfKey && trackedHalfKey !== '') {
    // Half has changed — auto-follow the now-batting team, queue toast, and record the new half
    const halfLabel = snapshot.half === 'top' ? 'Top' : 'Bot'
    setTrackedHalfKey(halfKey)
    setActiveTab(snapshot.half === usBattingHalf ? 'us' : 'them')
    setPendingToast(`Side retired — ${halfLabel} ${snapshot.inning}`)
  } else if (trackedHalfKey === '') {
    // First render after game loads — record the initial half key without changing the tab
    setTrackedHalfKey(halfKey)
  }

  const activeLineup = activeTab === 'us' ? lineupUs : lineupThem
  const currentBatter = activeTab === 'us' ? snapshot.currentBatterUs : snapshot.currentBatterThem
  const activePlays = plays.filter(p =>
    activeTab === 'us' ? p.half === usBattingHalf : p.half === themBattingHalf
  )

  // Determine current pitcher for pitch count
  const pitcherLineup = snapshot.half === usBattingHalf ? lineupThem : lineupUs
  const currentPitcher = pitcherLineup.battingOrder.find(s => s.position === 'P')
  const pitcherName = currentPitcher?.playerName ?? 'Unknown'
  const pitchCount = snapshot.pitchCountByPitcher.get(pitcherName) ?? 0

  // Current batter slot for play entry panel — use snapshot.half, not activeTab
  const currentBatterSlot = snapshot.half === usBattingHalf
    ? lineupUs.battingOrder.find(s => s.orderPosition === snapshot.currentBatterUs)
    : lineupThem.battingOrder.find(s => s.orderPosition === snapshot.currentBatterThem)

  const handlePlayRecorded = (data: PendingPlay) => {
    // Determine the actual current batter position based on current half
    const batterPos = snapshot.half === usBattingHalf
      ? snapshot.currentBatterUs
      : snapshot.currentBatterThem

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

    const tempSnapshot = replayGame(tempPlays, lineupUs, lineupThem, game.homeOrAway)

    const hasRunnersOnBase = !!(snapshot.baseRunners.first || snapshot.baseRunners.second || snapshot.baseRunners.third)
    const affectsRunners = data.basesReached.length > 0 ||
      ['SB', 'WP', 'PB', 'BK', 'FC', 'E'].includes(data.playType)
    const isOut = ['K', 'KL', 'GO', 'FO', 'LO', 'PO', 'SAC', 'DP'].includes(data.playType)

    const preRunsScored = snapshot.half === usBattingHalf
      ? tempSnapshot.scoreUs - snapshot.scoreUs
      : tempSnapshot.scoreThem - snapshot.scoreThem

    if (hasRunnersOnBase && (affectsRunners || isOut)) {
      setPendingPlay(data)
      setPendingRunners(tempSnapshot.baseRunners)
      setPendingPreRunsScored(preRunsScored)
      setShowPlayEntry(false)
    } else {
      finalizePlay(data)
    }
  }

  const finalizePlay = (data: PendingPlay, runnerOverrides?: BaseRunners, runsScoredOverride?: number) => {
    const half: HalfInning = snapshot.half
    const batterPos = half === usBattingHalf
      ? snapshot.currentBatterUs
      : snapshot.currentBatterThem

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
      const tempSnapshot = replayGame(tempPlays, lineupUs, lineupThem, game.homeOrAway)
      runsScored = half === usBattingHalf
        ? tempSnapshot.scoreUs - snapshot.scoreUs
        : tempSnapshot.scoreThem - snapshot.scoreThem
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

    setLastRecordedPlay({ playType: data.playType, notation: data.notation })
    setShowPlayEntry(false)
    setPendingPlay(null)
    setPendingRunners(null)
    setPendingPreRunsScored(0)
  }

  const handleRunnerConfirm = (result: { runners: BaseRunners; runsScored: number }) => {
    if (pendingPlay) {
      finalizePlay(pendingPlay, result.runners, result.runsScored)
    }
  }

  const handleRunnerCancel = () => {
    setPendingPlay(null)
    setPendingRunners(null)
    setPendingPreRunsScored(0)
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Score summary */}
      <ScoreSummary
        inning={snapshot.inning}
        half={snapshot.half}
        outs={snapshot.outs}
        scoreUs={snapshot.scoreUs}
        scoreThem={snapshot.scoreThem}
        pitchCount={pitchCount}
        pitcherName={pitcherName}
      />

      {/* Home/Away tabs */}
      <div className="flex border-b border-slate-200 bg-white">
        <button
          onClick={() => setActiveTab('us')}
          className={`flex-1 py-2 text-sm font-bold text-center transition-all duration-150 ${
            activeTab === 'us' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'
          }`}
        >
          Us ({game.homeOrAway === 'home' ? 'Home' : 'Away'})
        </button>
        <button
          onClick={() => setActiveTab('them')}
          className={`flex-1 py-2 text-sm font-bold text-center transition-all duration-150 ${
            activeTab === 'them' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'
          }`}
        >
          Them ({game.opponentName})
        </button>
      </div>

      {/* Scoresheet */}
      <div className="flex-1 overflow-auto">
        <Scoresheet
          lineup={activeLineup.battingOrder}
          plays={activePlays}
          currentInning={snapshot.inning}
          currentBatterPosition={currentBatter}
          maxInnings={6}
          onCellClick={() => setShowPlayEntry(true)}
          runsMap={activeTab === 'us' ? snapshot.runsScoredByPositionUs : snapshot.runsScoredByPositionThem}
        />
      </div>

      {/* Beginner guide card */}
      {lastRecordedPlay && (
        <div className="px-3 pt-2 bg-white border-t border-slate-100 relative">
          <button
            onClick={() => setLastRecordedPlay(null)}
            aria-label="Dismiss guide"
            className="absolute top-2 right-3 text-blue-300 hover:text-blue-500 text-xl leading-none z-10"
          >
            ×
          </button>
          <BeginnerGuide playType={lastRecordedPlay.playType} notation={lastRecordedPlay.notation} />
        </div>
      )}

      {/* Bottom action bar */}
      <div className="p-3 bg-white border-t border-slate-200 flex gap-2">
        <button
          onClick={() => setShowPlayEntry(true)}
          disabled={snapshot.isGameOver}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white py-2.5 rounded-lg font-bold transition-all duration-150 ease-in-out active:scale-95"
        >
          Record Play
        </button>
        <button
          onClick={undoLastPlay}
          disabled={plays.length === 0}
          className="bg-slate-200 hover:bg-slate-300 disabled:bg-slate-100 disabled:text-slate-400 text-slate-700 py-2.5 px-4 rounded-lg font-bold transition-all duration-150 ease-in-out active:scale-95"
        >
          Undo
        </button>
      </div>

      {/* Play entry panel */}
      {showPlayEntry && (
        <PlayEntryPanel
          batterName={currentBatterSlot?.playerName ?? 'Unknown'}
          baseRunners={snapshot.baseRunners}
          onPlayRecorded={handlePlayRecorded}
          onClose={() => setShowPlayEntry(false)}
        />
      )}

      {/* Runner confirmation */}
      {pendingRunners && (
        <RunnerConfirmation
          runners={pendingRunners}
          initialRunsScored={pendingPreRunsScored}
          onConfirm={handleRunnerConfirm}
          onCancel={handleRunnerCancel}
        />
      )}

      {/* Toast notification */}
      {pendingToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-5 py-2.5 rounded-full text-sm font-semibold shadow-lg z-50">
          {pendingToast}
        </div>
      )}

      {/* Game-over overlay */}
      {snapshot.isGameOver && !gameOverDismissed && (
        <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 text-center">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Game Over</div>
            <div className="text-5xl font-bold text-slate-900 mb-1">
              {snapshot.scoreUs} — {snapshot.scoreThem}
            </div>
            <div className="text-lg font-semibold text-slate-600 mb-8">
              {snapshot.scoreUs > snapshot.scoreThem
                ? 'We won!'
                : snapshot.scoreUs < snapshot.scoreThem
                  ? 'They won.'
                  : 'Tie game.'}
            </div>
            <button
              onClick={() => navigate(`/game/${gId}/stats`)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold mb-3 transition-all duration-150 active:scale-95"
            >
              View Stats
            </button>
            <button
              onClick={() => setGameOverDismissed(true)}
              className="text-slate-500 hover:text-slate-700 text-sm font-semibold transition-colors"
            >
              Back to scoresheet
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
