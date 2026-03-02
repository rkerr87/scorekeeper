import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Game, Team } from '../engine/types'
import { getAllTeams, getGamesForTeam, createGame, deleteGame, createTeam, addPlayer, saveLineup } from '../db/gameService'
import type { LineupSlot } from '../engine/types'
import { db } from '../db/database'

interface GameRowProps {
  game: Game
  linkTo: string
  confirmDeleteId: number | null
  onRequestDelete: (id: number) => void
  onCancelDelete: () => void
  onConfirmDelete: (id: number) => void
}

function GameRow({ game, linkTo, confirmDeleteId, onRequestDelete, onCancelDelete, onConfirmDelete }: GameRowProps) {
  const isConfirming = confirmDeleteId === game.id
  const label = `${game.homeOrAway === 'home' ? 'Home' : 'Away'} \u00b7 ${game.code}`

  const prefix = game.homeOrAway === 'home' ? 'vs' : '@'

  if (isConfirming) {
    return (
      <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-3">
        <div>
          <div className="font-semibold text-slate-900">{prefix} {game.opponentName}</div>
          <div className="text-xs text-slate-500">{label}</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancelDelete}
            className="text-sm px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirmDelete(game.id!)}
            className="text-sm px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold"
          >
            Yes, delete
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-stretch bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
      <Link to={linkTo} className="flex-1 px-4 py-3">
        <div className="font-semibold text-slate-900">{prefix} {game.opponentName}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </Link>
      <button
        onClick={() => onRequestDelete(game.id!)}
        aria-label={`Delete game vs ${game.opponentName}`}
        className="px-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-r-lg transition-colors"
      >
        ✕
      </button>
    </div>
  )
}

export function HomePage() {
  const navigate = useNavigate()
  const [team, setTeam] = useState<Team | null>(null)
  const [games, setGames] = useState<Game[]>([])
  const [showNewGame, setShowNewGame] = useState(false)
  const [opponentName, setOpponentName] = useState('')
  const [homeOrAway, setHomeOrAway] = useState<'home' | 'away'>('home')
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  useEffect(() => {
    async function load() {
      const teams = await getAllTeams()
      if (teams.length > 0) {
        setTeam(teams[0])
        const g = await getGamesForTeam(teams[0].id!)
        setGames(g)
      }
    }
    load()
  }, [])

  const handleStartNewGame = () => {
    if (!team) {
      navigate('/team')
      return
    }
    setShowNewGame(true)
  }

  const handleCreateGame = async () => {
    if (!team?.id || !opponentName.trim()) return
    const game = await createGame(team.id, opponentName.trim(), homeOrAway)
    navigate(`/game/${game.id}/setup`)
  }

  const handleDeleteGame = async (id: number) => {
    await deleteGame(id)
    setGames(prev => prev.filter(g => g.id !== id))
    setConfirmDeleteId(null)
  }

  const [seeding, setSeeding] = useState(false)

  const handleSeedData = async () => {
    setSeeding(true)
    try {
      const team = await createTeam('Mudcats')
      const ourPlayers = [
        await addPlayer(team.id!, 'James Kerr', 7, 'P'),
        await addPlayer(team.id!, 'Mateo Gonzalez', 23, 'C'),
        await addPlayer(team.id!, 'Connor Walsh', 11, '1B'),
        await addPlayer(team.id!, 'Dylan Park', 4, '2B'),
        await addPlayer(team.id!, 'Tyler Brooks', 15, 'SS'),
        await addPlayer(team.id!, 'Aiden Chen', 9, '3B'),
        await addPlayer(team.id!, 'Marcus Johnson', 17, 'LF'),
        await addPlayer(team.id!, 'Noah Patel', 3, 'CF'),
        await addPlayer(team.id!, 'Sam Torres', 21, 'RF'),
      ]

      const ourSlots: LineupSlot[] = ourPlayers.map((p, i) => ({
        orderPosition: i + 1,
        playerId: p.id!,
        playerName: p.name,
        jerseyNumber: p.jerseyNumber,
        position: p.defaultPosition,
        substitutions: [],
      }))

      const oppPlayers = [
        { name: 'Ethan Cruz', num: 12, pos: 'P' },
        { name: 'Liam Foster', num: 8, pos: 'C' },
        { name: 'Ryan Sato', num: 22, pos: '1B' },
        { name: 'Caleb Morales', num: 5, pos: '2B' },
        { name: 'Jayden Okafor', num: 14, pos: 'SS' },
        { name: 'Owen Duffy', num: 6, pos: '3B' },
        { name: 'Lucas Tran', num: 19, pos: 'LF' },
        { name: 'Mason Wright', num: 2, pos: 'CF' },
        { name: 'Eli Hoffman', num: 10, pos: 'RF' },
      ]
      const oppSlots: LineupSlot[] = oppPlayers.map((p, i) => ({
        orderPosition: i + 1,
        playerId: null,
        playerName: p.name,
        jerseyNumber: p.num,
        position: p.pos,
        substitutions: [],
      }))

      for (const opponent of ['Cardinals', 'Eagles'] as const) {
        const game = await createGame(team.id!, opponent, opponent === 'Cardinals' ? 'home' : 'away')
        await saveLineup(game.id!, 'us', ourSlots)
        await saveLineup(game.id!, 'them', oppSlots)
      }

      const teams = await getAllTeams()
      if (teams.length > 0) {
        setTeam(teams[0])
        setGames(await getGamesForTeam(teams[0].id!))
      }
    } catch (err) {
      console.error('Seed failed:', err)
      alert(`Seed failed: ${err}`)
    } finally {
      setSeeding(false)
    }
  }

  const handleClearData = async () => {
    await db.plays.clear()
    await db.lineups.clear()
    await db.games.clear()
    await db.players.clear()
    await db.teams.clear()
    setTeam(null)
    setGames([])
  }

  const inProgressGames = games.filter(g => g.status === 'in_progress')
  const completedGames = games.filter(g => g.status === 'completed')

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Scorekeeper</h1>

      <div className="space-y-4 mb-8">
        <Link
          to="/team"
          className="block w-full text-center bg-slate-700 hover:bg-slate-800 text-white py-3 px-4 rounded-lg font-semibold"
        >
          Manage Team Roster
        </Link>
        <button
          onClick={handleStartNewGame}
          className="block w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg font-semibold"
        >
          Start New Game
        </button>
      </div>

      {/* New game dialog */}
      {showNewGame && (
        <div className="border border-slate-200 rounded-lg p-4 mb-6 bg-white">
          <h2 className="text-lg font-semibold mb-3">New Game</h2>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Opponent name"
              value={opponentName}
              onChange={e => setOpponentName(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setHomeOrAway('home')}
                className={`flex-1 py-2 rounded-lg font-semibold text-sm ${
                  homeOrAway === 'home' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                Home
              </button>
              <button
                onClick={() => setHomeOrAway('away')}
                className={`flex-1 py-2 rounded-lg font-semibold text-sm ${
                  homeOrAway === 'away' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                Away
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowNewGame(false)}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 py-2 rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGame}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold"
              >
                Create Game
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-progress games */}
      {inProgressGames.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">In Progress</h2>
          <div className="space-y-2">
            {inProgressGames.map(g => (
              <GameRow
                key={g.id}
                game={g}
                linkTo={`/game/${g.id}`}
                confirmDeleteId={confirmDeleteId}
                onRequestDelete={id => setConfirmDeleteId(id)}
                onCancelDelete={() => setConfirmDeleteId(null)}
                onConfirmDelete={handleDeleteGame}
              />
            ))}
          </div>
        </div>
      )}

      {/* Season stats link */}
      <div className="mb-6">
        <Link to="/stats" className="block w-full text-center bg-slate-500 hover:bg-slate-600 text-white py-3 px-4 rounded-lg font-semibold">
          Season Stats
        </Link>
      </div>

      {/* Completed games */}
      {completedGames.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Completed</h2>
          <div className="space-y-2">
            {completedGames.map(g => (
              <GameRow
                key={g.id}
                game={g}
                linkTo={`/game/${g.id}/stats`}
                confirmDeleteId={confirmDeleteId}
                onRequestDelete={id => setConfirmDeleteId(id)}
                onCancelDelete={() => setConfirmDeleteId(null)}
                onConfirmDelete={handleDeleteGame}
              />
            ))}
          </div>
        </div>
      )}

      {/* DEV: seed / clear test data — remove before shipping */}
      <div className="mt-12 border border-dashed border-amber-400 rounded-lg p-4 bg-amber-50">
        <div className="text-xs font-bold text-amber-700 mb-3">DEV TOOLS</div>
        <div className="flex gap-2">
          <button
            onClick={handleSeedData}
            disabled={seeding}
            className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-semibold"
          >
            {seeding ? 'Seeding…' : 'Seed test data'}
          </button>
          <button
            onClick={handleClearData}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg text-sm font-semibold"
          >
            Clear all data
          </button>
        </div>
      </div>
    </div>
  )
}
