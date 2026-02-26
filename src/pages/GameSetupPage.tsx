import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Player, LineupSlot } from '../engine/types'
import { useGame } from '../contexts/GameContext'
import { getGame, getPlayersForTeam, saveLineup } from '../db/gameService'

interface OpponentPlayer {
  name: string
  jerseyNumber: number
  position: string
}

export function GameSetupPage() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const { loadGame } = useGame()

  const [players, setPlayers] = useState<Player[]>([])
  const [battingOrder, setBattingOrder] = useState<number[]>([]) // player ids in order
  const [opponents, setOpponents] = useState<OpponentPlayer[]>([])
  const [loading, setLoading] = useState(true)

  // Opponent form
  const [oppName, setOppName] = useState('')
  const [oppNumber, setOppNumber] = useState('')
  const [oppPosition, setOppPosition] = useState('')

  const gId = parseInt(gameId ?? '0')

  useEffect(() => {
    async function load() {
      const game = await getGame(gId)
      if (!game) return
      const p = await getPlayersForTeam(game.teamId)
      setPlayers(p)
      // Default batting order: roster order
      setBattingOrder(p.map(pl => pl.id!))
      setLoading(false)
    }
    load()
  }, [gId])

  const handleAddOpponent = () => {
    if (!oppName.trim() || !oppNumber.trim()) return
    setOpponents([...opponents, {
      name: oppName.trim(),
      jerseyNumber: parseInt(oppNumber),
      position: oppPosition.trim() || 'UT',
    }])
    setOppName('')
    setOppNumber('')
    setOppPosition('')
  }

  const handleMoveUp = (index: number) => {
    if (index === 0) return
    const newOrder = [...battingOrder]
    const temp = newOrder[index - 1]
    newOrder[index - 1] = newOrder[index]
    newOrder[index] = temp
    setBattingOrder(newOrder)
  }

  const handleMoveDown = (index: number) => {
    if (index >= battingOrder.length - 1) return
    const newOrder = [...battingOrder]
    const temp = newOrder[index + 1]
    newOrder[index + 1] = newOrder[index]
    newOrder[index] = temp
    setBattingOrder(newOrder)
  }

  const handleStartGame = async () => {
    // Build our lineup
    const ourSlots: LineupSlot[] = battingOrder.map((playerId, i) => {
      const player = players.find(p => p.id === playerId)!
      return {
        orderPosition: i + 1,
        playerId: player.id!,
        playerName: player.name,
        jerseyNumber: player.jerseyNumber,
        position: player.defaultPosition,
        substitutions: [],
      }
    })

    // Build opponent lineup
    const oppSlots: LineupSlot[] = opponents.map((opp, i) => ({
      orderPosition: i + 1,
      playerId: null,
      playerName: opp.name,
      jerseyNumber: opp.jerseyNumber,
      position: opp.position,
      substitutions: [],
    }))

    await saveLineup(gId, 'us', ourSlots)
    await saveLineup(gId, 'them', oppSlots)
    await loadGame(gId)
    navigate(`/game/${gId}`)
  }

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Game Setup</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Our batting order */}
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Our Batting Order</h2>
          <div className="space-y-1">
            {battingOrder.map((playerId, index) => {
              const player = players.find(p => p.id === playerId)
              if (!player) return null
              return (
                <div key={playerId} className="flex items-center gap-2 bg-white border border-slate-200 rounded px-3 py-2">
                  <span className="text-sm font-mono text-slate-400 w-6">{index + 1}.</span>
                  <span className="text-sm font-semibold flex-1">{player.name}</span>
                  <span className="text-xs text-slate-500">#{player.jerseyNumber}</span>
                  <span className="text-xs text-slate-500 w-8">{player.defaultPosition}</span>
                  <button onClick={() => handleMoveUp(index)} className="text-slate-400 hover:text-slate-700 text-xs px-1">&uarr;</button>
                  <button onClick={() => handleMoveDown(index)} className="text-slate-400 hover:text-slate-700 text-xs px-1">&darr;</button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Opponent lineup */}
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Opponent Lineup</h2>

          <div className="flex gap-2 mb-3">
            <input
              type="text"
              placeholder="Opponent name"
              value={oppName}
              onChange={e => setOppName(e.target.value)}
              className="flex-1 border border-slate-300 rounded px-2 py-1.5 text-sm"
            />
            <input
              type="text"
              inputMode="numeric"
              placeholder="Opp #"
              value={oppNumber}
              onChange={e => setOppNumber(e.target.value)}
              className="w-16 border border-slate-300 rounded px-2 py-1.5 text-sm"
            />
            <input
              type="text"
              placeholder="Opp pos"
              value={oppPosition}
              onChange={e => setOppPosition(e.target.value)}
              className="w-16 border border-slate-300 rounded px-2 py-1.5 text-sm"
            />
            <button
              onClick={handleAddOpponent}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm font-semibold"
            >
              Add Opponent
            </button>
          </div>

          <div className="space-y-1">
            {opponents.map((opp, index) => (
              <div key={index} className="flex items-center gap-2 bg-white border border-slate-200 rounded px-3 py-2">
                <span className="text-sm font-mono text-slate-400 w-6">{index + 1}.</span>
                <span className="text-sm font-semibold flex-1">{opp.name}</span>
                <span className="text-xs text-slate-500">#{opp.jerseyNumber}</span>
                <span className="text-xs text-slate-500">{opp.position}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Start game button */}
      <div className="mt-8">
        <button
          onClick={handleStartGame}
          disabled={battingOrder.length === 0 || opponents.length === 0}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-bold text-lg"
        >
          Start Game
        </button>
      </div>
    </div>
  )
}
