import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Game, Team } from '../engine/types'
import { getAllTeams, getGamesForTeam, createGame } from '../db/gameService'

export function HomePage() {
  const navigate = useNavigate()
  const [team, setTeam] = useState<Team | null>(null)
  const [games, setGames] = useState<Game[]>([])
  const [showNewGame, setShowNewGame] = useState(false)
  const [opponentName, setOpponentName] = useState('')
  const [homeOrAway, setHomeOrAway] = useState<'home' | 'away'>('home')

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
              <Link
                key={g.id}
                to={`/game/${g.id}`}
                className="block bg-white border border-slate-200 rounded-lg px-4 py-3 hover:bg-slate-50"
              >
                <div className="font-semibold text-slate-900">vs {g.opponentName}</div>
                <div className="text-xs text-slate-500">
                  {g.homeOrAway === 'home' ? 'Home' : 'Away'} &middot; {g.code}
                </div>
              </Link>
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
              <Link
                key={g.id}
                to={`/game/${g.id}/stats`}
                className="block bg-white border border-slate-200 rounded-lg px-4 py-3 hover:bg-slate-50"
              >
                <div className="font-semibold text-slate-900">vs {g.opponentName}</div>
                <div className="text-xs text-slate-500">
                  {g.homeOrAway === 'home' ? 'Home' : 'Away'} &middot; {g.code}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
