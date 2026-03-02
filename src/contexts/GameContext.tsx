import { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { Game, Team, Lineup, Play, GameSnapshot, HalfInning, PlayType, PitchResult, BaseRunnerOverride, Side } from '../engine/types'
import { replayGame } from '../engine/engine'
import { getGame, getTeam, getLineupsForGame, getPlaysForGame, addPlay, deleteLastPlay, updatePlay, deletePlayAndSubsequent, saveLineup } from '../db/gameService'

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
  homeTeam: Team | null
  awayTeam: Team | null
  lineupHome: Lineup | null
  lineupAway: Lineup | null
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
  const [homeTeam, setHomeTeam] = useState<Team | null>(null)
  const [awayTeam, setAwayTeam] = useState<Team | null>(null)
  const [lineupHome, setLineupHome] = useState<Lineup | null>(null)
  const [lineupAway, setLineupAway] = useState<Lineup | null>(null)
  const [plays, setPlays] = useState<Play[]>([])
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null)

  const recompute = useCallback((
    currentPlays: Play[],
    lHome: Lineup | null,
    lAway: Lineup | null,
  ) => {
    if (!lHome || !lAway) return
    if (lHome.battingOrder.length === 0 || lAway.battingOrder.length === 0) return
    const snap = replayGame(currentPlays, lHome, lAway)
    setSnapshot(snap)
  }, [])

  const loadGame = useCallback(async (gameId: number) => {
    const g = await getGame(gameId)
    if (!g) return

    // Determine which team is home and which is away
    const homeId = g.homeTeamId
    const awayId = g.team1Id === homeId ? g.team2Id : g.team1Id
    const [ht, at] = await Promise.all([getTeam(homeId), getTeam(awayId)])
    setHomeTeam(ht ?? null)
    setAwayTeam(at ?? null)

    const lineups = await getLineupsForGame(gameId)
    const lHome = lineups.find(l => l.side === 'home') ?? null
    const lAway = lineups.find(l => l.side === 'away') ?? null
    const p = await getPlaysForGame(gameId)

    setGame(g)
    setLineupHome(lHome)
    setLineupAway(lAway)
    setPlays(p)

    recompute(p, lHome, lAway)
  }, [recompute])

  const recordPlay = useCallback(async (input: RecordPlayInput) => {
    if (!game?.id) return
    const newPlay = await addPlay(game.id, input)
    const newPlays = [...plays, newPlay]
    setPlays(newPlays)
    recompute(newPlays, lineupHome, lineupAway)
  }, [game, plays, lineupHome, lineupAway, recompute])

  const undoLastPlay = useCallback(async () => {
    if (!game?.id) return
    await deleteLastPlay(game.id)
    const refreshed = await getPlaysForGame(game.id)
    setPlays(refreshed)
    recompute(refreshed, lineupHome, lineupAway)
  }, [game, lineupHome, lineupAway, recompute])

  const undoFromPlay = useCallback(async (playId: number) => {
    if (!game?.id) return
    await deletePlayAndSubsequent(game.id, playId)
    const refreshed = await getPlaysForGame(game.id)
    setPlays(refreshed)
    recompute(refreshed, lineupHome, lineupAway)
  }, [game, lineupHome, lineupAway, recompute])

  const editPlay = useCallback(async (playId: number, updates: Partial<Play>) => {
    if (!game?.id) return
    await updatePlay(playId, updates)
    const refreshed = await getPlaysForGame(game.id)
    setPlays(refreshed)
    recompute(refreshed, lineupHome, lineupAway)
  }, [game, lineupHome, lineupAway, recompute])

  const updateLineupPositions = useCallback(async (
    side: Side,
    changes: { orderPosition: number; newPosition: string }[],
    inning: number,
    half: HalfInning,
  ) => {
    const lineup = side === 'home' ? lineupHome : lineupAway
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
    const lHome = lineups.find(l => l.side === 'home') ?? null
    const lAway = lineups.find(l => l.side === 'away') ?? null
    setLineupHome(lHome)
    setLineupAway(lAway)
    recompute(plays, lHome, lAway)
  }, [game, lineupHome, lineupAway, plays, recompute])

  const clearGame = useCallback(() => {
    setGame(null)
    setHomeTeam(null)
    setAwayTeam(null)
    setLineupHome(null)
    setLineupAway(null)
    setPlays([])
    setSnapshot(null)
  }, [])

  return (
    <GameContext.Provider value={{
      game, homeTeam, awayTeam, lineupHome, lineupAway, plays, snapshot,
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
