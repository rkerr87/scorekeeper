import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Player, LineupSlot } from '../engine/types'
import { useGame } from '../contexts/GameContext'
import { getGame, getTeam, getPlayersForTeam, saveLineup, updateGameStatus, addPlayer } from '../db/gameService'
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

const ALL_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as const

interface PositionDropdownProps {
  position: string
  onPositionChange: (pos: string) => void
}

function PositionDropdown({ position, onPositionChange }: PositionDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        aria-label={`position: ${position}`}
        onClick={() => setOpen(!open)}
        className="text-xs text-blue-600 font-medium w-8 text-center hover:text-blue-800"
      >
        {position}
      </button>
      {open && (
        <div role="listbox" className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded shadow-lg z-10 py-1 min-w-[4rem]">
          {ALL_POSITIONS.map(pos => (
            <div
              key={pos}
              role="option"
              aria-label={pos}
              aria-selected={pos === position}
              onClick={() => {
                onPositionChange(pos)
                setOpen(false)
              }}
              className={`px-3 py-1 text-xs cursor-pointer hover:bg-blue-50 ${pos === position ? 'bg-blue-100 font-semibold' : ''}`}
            >
              {pos}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface SortablePlayerRowProps {
  playerId: number
  index: number
  player: Player
  position: string
  onRemove: (playerId: number) => void
  onPositionChange: (pos: string) => void
}

function SortablePlayerRow({ playerId, index, player, position, onRemove, onPositionChange }: SortablePlayerRowProps) {
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
      <PositionDropdown position={position} onPositionChange={onPositionChange} />
      <button
        aria-label="Remove from lineup"
        onClick={() => onRemove(playerId)}
        className="text-slate-400 hover:text-red-500 ml-1 text-lg leading-none"
      >
        ×
      </button>
    </div>
  )
}

interface BenchSectionProps {
  benchIds: number[]
  players: Player[]
  onAddBack: (playerId: number) => void
}

function BenchSection({ benchIds, players, onAddBack }: BenchSectionProps) {
  if (benchIds.length === 0) return null
  return (
    <div className="mt-3">
      <h3 className="text-sm font-semibold text-slate-600 mb-2">Not Playing ({benchIds.length})</h3>
      <div className="space-y-1">
        {benchIds.map(id => {
          const player = players.find(p => p.id === id)
          if (!player) return null
          return (
            <div key={id} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded px-3 py-2">
              <span className="text-sm flex-1 text-slate-500">{player.name}</span>
              <span className="text-xs text-slate-400">#{player.jerseyNumber}</span>
              <button
                aria-label={`Add ${player.name} back to lineup`}
                onClick={() => onAddBack(id)}
                className="text-slate-400 hover:text-green-600 ml-1 text-lg leading-none"
              >
                +
              </button>
            </div>
          )
        })}
      </div>
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
  const [homeBench, setHomeBench] = useState<number[]>([])
  const [awayBench, setAwayBench] = useState<number[]>([])
  const [homePositions, setHomePositions] = useState<Map<number, string>>(new Map())
  const [awayPositions, setAwayPositions] = useState<Map<number, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [homeTeamId, setHomeTeamId] = useState(0)
  const [awayTeamId, setAwayTeamId] = useState(0)

  // Guest player form state
  const [addingPlayerSide, setAddingPlayerSide] = useState<'home' | 'away' | null>(null)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [newPlayerJersey, setNewPlayerJersey] = useState('')
  const [newPlayerPosition, setNewPlayerPosition] = useState('RF')
  const [saveToRoster, setSaveToRoster] = useState(true)
  const [homeGuestPlayers, setHomeGuestPlayers] = useState<Player[]>([])
  const [awayGuestPlayers, setAwayGuestPlayers] = useState<Player[]>([])
  const [guestSaveToRoster, setGuestSaveToRoster] = useState<Set<number>>(new Set())

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

      setHomeTeamId(homeId)
      setAwayTeamId(awayId)
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

  const getPosition = (side: 'home' | 'away', player: Player): string => {
    const overrides = side === 'home' ? homePositions : awayPositions
    return overrides.get(player.id!) ?? player.defaultPosition
  }

  const handleDragEnd = (side: 'home' | 'away', event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const setter = side === 'home' ? setHomeBattingOrder : setAwayBattingOrder
      setter(prev => {
        const oldIndex = prev.indexOf(Number(active.id))
        const newIndex = prev.indexOf(Number(over.id))
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  const handleRemove = (side: 'home' | 'away', playerId: number) => {
    const setOrder = side === 'home' ? setHomeBattingOrder : setAwayBattingOrder
    const setBench = side === 'home' ? setHomeBench : setAwayBench
    setOrder(prev => prev.filter(id => id !== playerId))
    setBench(prev => [...prev, playerId])
  }

  const handleAddBack = (side: 'home' | 'away', playerId: number) => {
    const setBench = side === 'home' ? setHomeBench : setAwayBench
    const setOrder = side === 'home' ? setHomeBattingOrder : setAwayBattingOrder
    setBench(prev => prev.filter(id => id !== playerId))
    setOrder(prev => [...prev, playerId])
  }

  const handlePositionChange = (side: 'home' | 'away', playerId: number, newPosition: string) => {
    if (side === 'home') {
      setHomePositions(prev => new Map(prev).set(playerId, newPosition))
    } else {
      setAwayPositions(prev => new Map(prev).set(playerId, newPosition))
    }
  }

  const findPlayer = (side: 'home' | 'away', playerId: number): Player | undefined => {
    const roster = side === 'home' ? homePlayers : awayPlayers
    const guests = side === 'home' ? homeGuestPlayers : awayGuestPlayers
    return roster.find(p => p.id === playerId) ?? guests.find(p => p.id === playerId)
  }

  const resetForm = () => {
    setNewPlayerName('')
    setNewPlayerJersey('')
    setNewPlayerPosition('RF')
    setSaveToRoster(true)
  }

  const handleSaveNewPlayer = () => {
    if (!newPlayerName.trim() || !newPlayerJersey.trim() || !addingPlayerSide) return
    const jerseyNum = parseInt(newPlayerJersey)
    if (isNaN(jerseyNum)) return

    const tempId = -Date.now()
    const guestPlayer: Player = {
      id: tempId,
      teamId: addingPlayerSide === 'home' ? homeTeamId : awayTeamId,
      name: newPlayerName.trim(),
      jerseyNumber: jerseyNum,
      defaultPosition: newPlayerPosition,
      createdAt: new Date(),
    }

    if (addingPlayerSide === 'home') {
      setHomeGuestPlayers(prev => [...prev, guestPlayer])
      setHomeBattingOrder(prev => [...prev, tempId])
    } else {
      setAwayGuestPlayers(prev => [...prev, guestPlayer])
      setAwayBattingOrder(prev => [...prev, tempId])
    }

    if (saveToRoster) {
      setGuestSaveToRoster(prev => new Set(prev).add(tempId))
    }

    resetForm()
    setAddingPlayerSide(null)
  }

  const buildSlots = (side: 'home' | 'away', idMap: Map<number, number>): LineupSlot[] => {
    const order = side === 'home' ? homeBattingOrder : awayBattingOrder
    const resolveId = (tempId: number) => idMap.get(tempId) ?? tempId
    return order.map((playerId, i) => {
      const player = findPlayer(side, playerId)!
      return {
        orderPosition: i + 1,
        playerId: resolveId(player.id!),
        playerName: player.name,
        jerseyNumber: player.jerseyNumber,
        position: getPosition(side, player),
        substitutions: [],
      }
    })
  }

  const handleStartGame = async () => {
    const idMap = new Map<number, number>()
    for (const guest of [...homeGuestPlayers, ...awayGuestPlayers]) {
      if (guestSaveToRoster.has(guest.id!)) {
        const saved = await addPlayer(guest.teamId, guest.name, guest.jerseyNumber, guest.defaultPosition)
        idMap.set(guest.id!, saved.id!)
      }
    }

    await saveLineup(gId, 'home', buildSlots('home', idMap))
    await saveLineup(gId, 'away', buildSlots('away', idMap))
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
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd('away', e)}>
            <SortableContext items={awayBattingOrder} strategy={verticalListSortingStrategy}>
              <div className="space-y-1">
                {awayBattingOrder.map((playerId, index) => {
                  const player = findPlayer('away', playerId)
                  if (!player) return null
                  return (
                    <SortablePlayerRow
                      key={playerId}
                      playerId={playerId}
                      index={index}
                      player={player}
                      position={getPosition('away', player)}
                      onRemove={(id) => handleRemove('away', id)}
                      onPositionChange={(pos) => handlePositionChange('away', playerId, pos)}
                    />
                  )
                })}
              </div>
            </SortableContext>
          </DndContext>
          <BenchSection benchIds={awayBench} players={[...awayPlayers, ...awayGuestPlayers]} onAddBack={(id) => handleAddBack('away', id)} />
          {addingPlayerSide === 'away' ? (
            <div className="mt-2 space-y-2 bg-slate-50 border border-slate-200 rounded p-3">
              <input
                type="text"
                placeholder="Player name"
                value={newPlayerName}
                onChange={e => setNewPlayerName(e.target.value)}
                className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
              />
              <input
                type="text"
                placeholder="Jersey #"
                inputMode="numeric"
                value={newPlayerJersey}
                onChange={e => setNewPlayerJersey(e.target.value)}
                className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
              />
              <select
                aria-label="Position"
                value={newPlayerPosition}
                onChange={e => setNewPlayerPosition(e.target.value)}
                className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
              >
                {ALL_POSITIONS.map(pos => (
                  <option key={pos} value={pos}>{pos}</option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  aria-label="Add to team roster"
                  checked={saveToRoster}
                  onChange={e => setSaveToRoster(e.target.checked)}
                />
                Add to team roster
              </label>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveNewPlayer}
                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm font-medium hover:bg-blue-700"
                >
                  Save
                </button>
                <button
                  onClick={() => { resetForm(); setAddingPlayerSide(null) }}
                  className="text-slate-600 px-3 py-1 rounded text-sm hover:text-slate-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingPlayerSide('away')}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              + Add Player
            </button>
          )}
        </div>

        {/* Home batting order */}
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-3">{homeTeamName} (Home) Batting Order</h2>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd('home', e)}>
            <SortableContext items={homeBattingOrder} strategy={verticalListSortingStrategy}>
              <div className="space-y-1">
                {homeBattingOrder.map((playerId, index) => {
                  const player = findPlayer('home', playerId)
                  if (!player) return null
                  return (
                    <SortablePlayerRow
                      key={playerId}
                      playerId={playerId}
                      index={index}
                      player={player}
                      position={getPosition('home', player)}
                      onRemove={(id) => handleRemove('home', id)}
                      onPositionChange={(pos) => handlePositionChange('home', playerId, pos)}
                    />
                  )
                })}
              </div>
            </SortableContext>
          </DndContext>
          <BenchSection benchIds={homeBench} players={[...homePlayers, ...homeGuestPlayers]} onAddBack={(id) => handleAddBack('home', id)} />
          {addingPlayerSide === 'home' ? (
            <div className="mt-2 space-y-2 bg-slate-50 border border-slate-200 rounded p-3">
              <input
                type="text"
                placeholder="Player name"
                value={newPlayerName}
                onChange={e => setNewPlayerName(e.target.value)}
                className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
              />
              <input
                type="text"
                placeholder="Jersey #"
                inputMode="numeric"
                value={newPlayerJersey}
                onChange={e => setNewPlayerJersey(e.target.value)}
                className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
              />
              <select
                aria-label="Position"
                value={newPlayerPosition}
                onChange={e => setNewPlayerPosition(e.target.value)}
                className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
              >
                {ALL_POSITIONS.map(pos => (
                  <option key={pos} value={pos}>{pos}</option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  aria-label="Add to team roster"
                  checked={saveToRoster}
                  onChange={e => setSaveToRoster(e.target.checked)}
                />
                Add to team roster
              </label>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveNewPlayer}
                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm font-medium hover:bg-blue-700"
                >
                  Save
                </button>
                <button
                  onClick={() => { resetForm(); setAddingPlayerSide(null) }}
                  className="text-slate-600 px-3 py-1 rounded text-sm hover:text-slate-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingPlayerSide('home')}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              + Add Player
            </button>
          )}
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
