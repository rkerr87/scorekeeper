import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useGame } from '../contexts/GameContext'
import { ScoreSummary } from '../components/ScoreSummary'
import { Scoresheet } from '../components/Scoresheet'
import { PlayEntryPanel } from '../components/PlayEntryPanel'
import { RunnerConfirmation } from '../components/RunnerConfirmation'
import type { BaseRunners, HalfInning, PlayType, PitchResult } from '../engine/types'
import { replayGame } from '../engine/engine'

type ActiveTab = 'us' | 'them'

interface PendingPlay {
  playType: PlayType
  notation: string
  fieldersInvolved: number[]
  basesReached: number[]
  pitches: PitchResult[]
  isAtBat: boolean
}

export function GamePage() {
  const { gameId } = useParams()
  const {
    game, lineupUs, lineupThem, plays, snapshot,
    loadGame, recordPlay, undoLastPlay,
  } = useGame()

  const [activeTab, setActiveTab] = useState<ActiveTab>('us')
  const [showPlayEntry, setShowPlayEntry] = useState(false)
  const [pendingPlay, setPendingPlay] = useState<PendingPlay | null>(null)
  const [pendingRunners, setPendingRunners] = useState<BaseRunners | null>(null)

  const gId = parseInt(gameId ?? '0')

  useEffect(() => {
    if (gId && (!game || game.id !== gId)) {
      loadGame(gId)
    }
  }, [gId, game, loadGame])

  if (!game || !snapshot || !lineupUs || !lineupThem) {
    return <div className="p-6 text-slate-500">Loading game...</div>
  }

  // Determine which half "us" bats in
  const usBattingHalf: HalfInning = game.homeOrAway === 'home' ? 'bottom' : 'top'
  const themBattingHalf: HalfInning = usBattingHalf === 'top' ? 'bottom' : 'top'

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
      runsScoredOnPlay: 0,
      rbis: 0,
      timestamp: new Date(),
    }]

    const tempSnapshot = replayGame(tempPlays, lineupUs, lineupThem, game.homeOrAway)

    // If this play could affect runners, show confirmation
    const affectsRunners = data.basesReached.length > 0 ||
      ['SB', 'WP', 'PB', 'BK', 'FC', 'E'].includes(data.playType)

    if (affectsRunners && (snapshot.baseRunners.first || snapshot.baseRunners.second || snapshot.baseRunners.third)) {
      setPendingPlay(data)
      setPendingRunners(tempSnapshot.baseRunners)
      setShowPlayEntry(false)
    } else {
      finalizePlay(data)
    }
  }

  const finalizePlay = (data: PendingPlay, runnerOverrides?: BaseRunners) => {
    const half: HalfInning = snapshot.half
    const batterPos = half === usBattingHalf
      ? snapshot.currentBatterUs
      : snapshot.currentBatterThem

    // Compute runs scored via engine replay
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
      runnerOverrides: runnerOverrides ? {
        first: runnerOverrides.first,
        second: runnerOverrides.second,
        third: runnerOverrides.third,
      } : undefined,
      timestamp: new Date(),
    }]
    const tempSnapshot = replayGame(tempPlays, lineupUs, lineupThem, game.homeOrAway)
    const runsScored = half === usBattingHalf
      ? tempSnapshot.scoreUs - snapshot.scoreUs
      : tempSnapshot.scoreThem - snapshot.scoreThem

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

    setShowPlayEntry(false)
    setPendingPlay(null)
    setPendingRunners(null)
  }

  const handleRunnerConfirm = (runners: BaseRunners) => {
    if (pendingPlay) {
      finalizePlay(pendingPlay, runners)
    }
  }

  const handleRunnerCancel = () => {
    setPendingPlay(null)
    setPendingRunners(null)
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
          className={`flex-1 py-2 text-sm font-bold text-center ${
            activeTab === 'us' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'
          }`}
        >
          Us ({game.homeOrAway === 'home' ? 'Home' : 'Away'})
        </button>
        <button
          onClick={() => setActiveTab('them')}
          className={`flex-1 py-2 text-sm font-bold text-center ${
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

      {/* Bottom action bar */}
      <div className="p-3 bg-white border-t border-slate-200 flex gap-2">
        <button
          onClick={() => setShowPlayEntry(true)}
          disabled={snapshot.isGameOver}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white py-2.5 rounded-lg font-bold"
        >
          Record Play
        </button>
        <button
          onClick={undoLastPlay}
          disabled={plays.length === 0}
          className="bg-slate-200 hover:bg-slate-300 disabled:bg-slate-100 disabled:text-slate-400 text-slate-700 py-2.5 px-4 rounded-lg font-bold"
        >
          Undo
        </button>
      </div>

      {/* Play entry panel */}
      {showPlayEntry && (
        <PlayEntryPanel
          batterName={currentBatterSlot?.playerName ?? 'Unknown'}
          onPlayRecorded={handlePlayRecorded}
          onClose={() => setShowPlayEntry(false)}
        />
      )}

      {/* Runner confirmation */}
      {pendingRunners && (
        <RunnerConfirmation
          runners={pendingRunners}
          onConfirm={handleRunnerConfirm}
          onCancel={handleRunnerCancel}
        />
      )}
    </div>
  )
}
