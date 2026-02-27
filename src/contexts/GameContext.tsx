import { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { Game, Lineup, Play, GameSnapshot, HalfInning, PlayType, PitchResult, HomeOrAway, BaseRunnerOverride, Side } from '../engine/types'
import { replayGame } from '../engine/engine'
import { getGame, getLineupsForGame, getPlaysForGame, addPlay, deleteLastPlay, updatePlay, deletePlayAndSubsequent, saveLineup } from '../db/gameService'

interface RecordPlayInput {
  inning: number
  half: HalfInning
  batterOrderPosition: number
  playType: PlayType
  notation: string
  fieldersInvolved: number[]
  basesReached: number[]
  runsScoredOnPlay: number
  rbis: number
  pitches: PitchResult[]
  isAtBat: boolean
  runnerOverrides?: BaseRunnerOverride
}

interface GameContextValue {
  game: Game | null
  lineupUs: Lineup | null
  lineupThem: Lineup | null
  plays: Play[]
  snapshot: GameSnapshot | null
  loadGame: (gameId: number) => Promise<void>
  recordPlay: (input: RecordPlayInput) => Promise<void>
  undoLastPlay: () => Promise<void>
  undoFromPlay: (playId: number) => Promise<void>
  editPlay: (playId: number, updates: Partial<Play>) => Promise<void>
  updateLineupPositions: (
    side: Side,
    changes: { orderPosition: number; newPosition: string }[],
    inning: number,
    half: HalfInning,
  ) => Promise<void>
  clearGame: () => void
}

const GameContext = createContext<GameContextValue | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  const [game, setGame] = useState<Game | null>(null)
  const [lineupUs, setLineupUs] = useState<Lineup | null>(null)
  const [lineupThem, setLineupThem] = useState<Lineup | null>(null)
  const [plays, setPlays] = useState<Play[]>([])
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null)

  const recompute = useCallback((
    currentPlays: Play[],
    lusVal: Lineup | null,
    lthVal: Lineup | null,
    homeOrAway: HomeOrAway,
  ) => {
    if (!lusVal || !lthVal) return
    if (lusVal.battingOrder.length === 0 || lthVal.battingOrder.length === 0) return
    const snap = replayGame(currentPlays, lusVal, lthVal, homeOrAway)
    setSnapshot(snap)
  }, [])

  const loadGame = useCallback(async (gameId: number) => {
    const g = await getGame(gameId)
    if (!g) return

    const lineups = await getLineupsForGame(gameId)
    const lus = lineups.find(l => l.side === 'us') ?? null
    const lth = lineups.find(l => l.side === 'them') ?? null
    const p = await getPlaysForGame(gameId)

    setGame(g)
    setLineupUs(lus)
    setLineupThem(lth)
    setPlays(p)

    recompute(p, lus, lth, g.homeOrAway)
  }, [recompute])

  const recordPlay = useCallback(async (input: RecordPlayInput) => {
    if (!game?.id) return
    const newPlay = await addPlay(game.id, input)
    const newPlays = [...plays, newPlay]
    setPlays(newPlays)
    recompute(newPlays, lineupUs, lineupThem, game.homeOrAway)
  }, [game, plays, lineupUs, lineupThem, recompute])

  const undoLastPlay = useCallback(async () => {
    if (!game?.id) return
    await deleteLastPlay(game.id)
    const refreshed = await getPlaysForGame(game.id)
    setPlays(refreshed)
    recompute(refreshed, lineupUs, lineupThem, game.homeOrAway)
  }, [game, lineupUs, lineupThem, recompute])

  const undoFromPlay = useCallback(async (playId: number) => {
    if (!game?.id) return
    await deletePlayAndSubsequent(game.id, playId)
    const refreshed = await getPlaysForGame(game.id)
    setPlays(refreshed)
    recompute(refreshed, lineupUs, lineupThem, game.homeOrAway)
  }, [game, lineupUs, lineupThem, recompute])

  const editPlay = useCallback(async (playId: number, updates: Partial<Play>) => {
    if (!game?.id) return
    await updatePlay(playId, updates)
    const refreshed = await getPlaysForGame(game.id)
    setPlays(refreshed)
    recompute(refreshed, lineupUs, lineupThem, game.homeOrAway)
  }, [game, lineupUs, lineupThem, recompute])

  const updateLineupPositions = useCallback(async (
    side: Side,
    changes: { orderPosition: number; newPosition: string }[],
    inning: number,
    half: HalfInning,
  ) => {
    const lineup = side === 'us' ? lineupUs : lineupThem
    if (!lineup || !game?.id) return

    const updatedOrder = lineup.battingOrder.map(slot => {
      const change = changes.find(c => c.orderPosition === slot.orderPosition)
      if (change) {
        return {
          ...slot,
          position: change.newPosition,
          substitutions: [...slot.substitutions, {
            inning,
            half,
            newPlayerName: slot.playerName,
            newJerseyNumber: slot.jerseyNumber,
            newPosition: change.newPosition,
          }],
        }
      }
      return slot
    })

    await saveLineup(game.id, side, updatedOrder)
    // Reload to pick up changes
    const lineups = await getLineupsForGame(game.id)
    const lus = lineups.find(l => l.side === 'us') ?? null
    const lth = lineups.find(l => l.side === 'them') ?? null
    setLineupUs(lus)
    setLineupThem(lth)
    recompute(plays, lus, lth, game.homeOrAway)
  }, [game, lineupUs, lineupThem, plays, recompute])

  const clearGame = useCallback(() => {
    setGame(null)
    setLineupUs(null)
    setLineupThem(null)
    setPlays([])
    setSnapshot(null)
  }, [])

  return (
    <GameContext.Provider value={{
      game, lineupUs, lineupThem, plays, snapshot,
      loadGame, recordPlay, undoLastPlay, undoFromPlay, editPlay, updateLineupPositions, clearGame,
    }}>
      {children}
    </GameContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGame(): GameContextValue {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within a GameProvider')
  return ctx
}
