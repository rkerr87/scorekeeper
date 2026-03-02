import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Player, LineupSlot } from '../engine/types'
import { useGame } from '../contexts/GameContext'
import { getGame, getTeam, getPlayersForTeam, saveLineup, updateGameStatus } from '../db/gameService'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface SortablePlayerRowProps {
  playerId: number
  index: number
  player: Player
}

function SortablePlayerRow({ playerId, index, player }: SortablePlayerRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: playerId })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 bg-white border border-slate-200 rounded px-3 py-2">
      <button
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing px-1 text-lg leading-none touch-none"
      >
        ≡
      </button>
      <span className="text-sm font-mono text-slate-400 w-6">{index + 1}.</span>
      <span className="text-sm font-semibold flex-1">{player.name}</span>
      <span className="text-xs text-slate-500">#{player.jerseyNumber}</span>
      <span className="text-xs text-slate-500 w-8">{player.defaultPosition}</span>
    </div>
  )
}

export function GameSetupPage() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const { loadGame } = useGame()

  const [homeTeamName, setHomeTeamName] = useState('')
  const [awayTeamName, setAwayTeamName] = useState('')
  const [homePlayers, setHomePlayers] = useState<Player[]>([])
  const [awayPlayers, setAwayPlayers] = useState<Player[]>([])
  const [homeBattingOrder, setHomeBattingOrder] = useState<number[]>([])
  const [awayBattingOrder, setAwayBattingOrder] = useState<number[]>([])
  const [loading, setLoading] = useState(true)

  const gId = parseInt(gameId ?? '0')

  useEffect(() => {
    async function load() {
      const game = await getGame(gId)
      if (!game) return

      const homeId = game.homeTeamId
      const awayId = game.team1Id === homeId ? game.team2Id : game.team1Id

      const [homeTeam, awayTeam] = await Promise.all([getTeam(homeId), getTeam(awayId)])
      const [homeP, awayP] = await Promise.all([
        getPlayersForTeam(homeId),
        getPlayersForTeam(awayId),
      ])

      setHomeTeamName(homeTeam?.name ?? 'Home')
      setAwayTeamName(awayTeam?.name ?? 'Away')
      setHomePlayers(homeP)
      setAwayPlayers(awayP)
      setHomeBattingOrder(homeP.map(p => p.id!))
      setAwayBattingOrder(awayP.map(p => p.id!))
      setLoading(false)
    }
    load()
  }, [gId])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleHomeDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setHomeBattingOrder(prev => {
        const oldIndex = prev.indexOf(Number(active.id))
        const newIndex = prev.indexOf(Number(over.id))
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  const handleAwayDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setAwayBattingOrder(prev => {
        const oldIndex = prev.indexOf(Number(active.id))
        const newIndex = prev.indexOf(Number(over.id))
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  const handleStartGame = async () => {
    const homeSlots: LineupSlot[] = homeBattingOrder.map((playerId, i) => {
      const player = homePlayers.find(p => p.id === playerId)!
      return {
        orderPosition: i + 1,
        playerId: player.id!,
        playerName: player.name,
        jerseyNumber: player.jerseyNumber,
        position: player.defaultPosition,
        substitutions: [],
      }
    })

    const awaySlots: LineupSlot[] = awayBattingOrder.map((playerId, i) => {
      const player = awayPlayers.find(p => p.id === playerId)!
      return {
        orderPosition: i + 1,
        playerId: player.id!,
        playerName: player.name,
        jerseyNumber: player.jerseyNumber,
        position: player.defaultPosition,
        substitutions: [],
      }
    })

    await saveLineup(gId, 'home', homeSlots)
    await saveLineup(gId, 'away', awaySlots)
    await updateGameStatus(gId, 'in_progress')
    await loadGame(gId)
    navigate(`/game/${gId}`)
  }

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Game Setup</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Away batting order */}
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-3">{awayTeamName} (Away) Batting Order</h2>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleAwayDragEnd}>
            <SortableContext items={awayBattingOrder} strategy={verticalListSortingStrategy}>
              <div className="space-y-1">
                {awayBattingOrder.map((playerId, index) => {
                  const player = awayPlayers.find(p => p.id === playerId)
                  if (!player) return null
                  return (
                    <SortablePlayerRow
                      key={playerId}
                      playerId={playerId}
                      index={index}
                      player={player}
                    />
                  )
                })}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {/* Home batting order */}
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-3">{homeTeamName} (Home) Batting Order</h2>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleHomeDragEnd}>
            <SortableContext items={homeBattingOrder} strategy={verticalListSortingStrategy}>
              <div className="space-y-1">
                {homeBattingOrder.map((playerId, index) => {
                  const player = homePlayers.find(p => p.id === playerId)
                  if (!player) return null
                  return (
                    <SortablePlayerRow
                      key={playerId}
                      playerId={playerId}
                      index={index}
                      player={player}
                    />
                  )
                })}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </div>

      {/* Start game button */}
      <div className="mt-8">
        <button
          onClick={handleStartGame}
          disabled={homeBattingOrder.length === 0 || awayBattingOrder.length === 0}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-bold text-lg"
        >
          Start Game
        </button>
      </div>
    </div>
  )
}
