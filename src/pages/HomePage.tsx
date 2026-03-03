import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Game, Team, LineupSlot } from '../engine/types'
import { getAllTeams, getAllGames, createGame, deleteGame, createTeam, addPlayer, saveLineup } from '../db/gameService'
import { db } from '../db/database'

interface GameRowProps {
  game: Game
  teams: Map<number, Team>
  linkTo: string
  confirmDeleteId: number | null
  onRequestDelete: (id: number) => void
  onCancelDelete: () => void
  onConfirmDelete: (id: number) => void
}

function GameRow({ game, teams, linkTo, confirmDeleteId, onRequestDelete, onCancelDelete, onConfirmDelete }: GameRowProps) {
  const isConfirming = confirmDeleteId === game.id
  const homeTeam = teams.get(game.homeTeamId)
  const awayId = game.team1Id === game.homeTeamId ? game.team2Id : game.team1Id
  const awayTeam = teams.get(awayId)
  const title = `${awayTeam?.name ?? 'Away'} @ ${homeTeam?.name ?? 'Home'}`
  const label = game.code

  if (isConfirming) {
    return (
      <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-3">
        <div>
          <div className="font-semibold text-slate-900">{title}</div>
          <div className="text-xs text-slate-500">{label}</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancelDelete}
            className="text-sm px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirmDelete(game.id!)}
            className="text-sm px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold"
          >
            Yes, delete
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-stretch bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
      <Link to={linkTo} className="flex-1 px-4 py-3">
        <div className="font-semibold text-slate-900">{title}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </Link>
      <button
        onClick={() => onRequestDelete(game.id!)}
        aria-label={`Delete game ${title}`}
        className="min-w-[44px] flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-r-lg transition-colors"
      >
        <span aria-hidden="true">✕</span>
      </button>
    </div>
  )
}

export function HomePage() {
  const navigate = useNavigate()
  const [teamsList, setTeamsList] = useState<Team[]>([])
  const [teamsMap, setTeamsMap] = useState<Map<number, Team>>(new Map())
  const [games, setGames] = useState<Game[]>([])
  const [showNewGame, setShowNewGame] = useState(false)
  const [newAwayTeamId, setNewAwayTeamId] = useState<number | null>(null)
  const [newHomeTeamId, setNewHomeTeamId] = useState<number | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  useEffect(() => {
    async function load() {
      const teams = await getAllTeams()
      setTeamsList(teams)
      const map = new Map<number, Team>()
      for (const t of teams) {
        if (t.id !== undefined) map.set(t.id, t)
      }
      setTeamsMap(map)

      const allGames = await getAllGames()
      setGames(allGames)
    }
    load()
  }, [])

  const handleStartNewGame = () => {
    if (teamsList.length < 2) {
      navigate('/teams')
      return
    }
    setShowNewGame(true)
  }

  const handleCreateGame = async () => {
    if (!newAwayTeamId || !newHomeTeamId) return
    const game = await createGame(newAwayTeamId, newHomeTeamId, newHomeTeamId)
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

      // Create opponent team with real players
      const oppTeam = await createTeam('Cardinals')
      const oppPlayers = [
        await addPlayer(oppTeam.id!, 'Ethan Cruz', 12, 'P'),
        await addPlayer(oppTeam.id!, 'Liam Foster', 8, 'C'),
        await addPlayer(oppTeam.id!, 'Ryan Sato', 22, '1B'),
        await addPlayer(oppTeam.id!, 'Caleb Morales', 5, '2B'),
        await addPlayer(oppTeam.id!, 'Jayden Okafor', 14, 'SS'),
        await addPlayer(oppTeam.id!, 'Owen Duffy', 6, '3B'),
        await addPlayer(oppTeam.id!, 'Lucas Tran', 19, 'LF'),
        await addPlayer(oppTeam.id!, 'Mason Wright', 2, 'CF'),
        await addPlayer(oppTeam.id!, 'Eli Hoffman', 10, 'RF'),
      ]
      const oppSlots: LineupSlot[] = oppPlayers.map((p, i) => ({
        orderPosition: i + 1,
        playerId: p.id!,
        playerName: p.name,
        jerseyNumber: p.jerseyNumber,
        position: p.defaultPosition,
        substitutions: [],
      }))

      // Create a second opponent team
      const oppTeam2 = await createTeam('Eagles')
      const oppPlayers2 = [
        await addPlayer(oppTeam2.id!, 'Jake Rivera', 1, 'P'),
        await addPlayer(oppTeam2.id!, 'Bryce Kim', 18, 'C'),
        await addPlayer(oppTeam2.id!, 'Devon Scott', 33, '1B'),
        await addPlayer(oppTeam2.id!, 'Nate Lopez', 7, '2B'),
        await addPlayer(oppTeam2.id!, 'Kai Williams', 25, 'SS'),
        await addPlayer(oppTeam2.id!, 'Leo Davis', 13, '3B'),
        await addPlayer(oppTeam2.id!, 'Finn Murphy', 20, 'LF'),
        await addPlayer(oppTeam2.id!, 'Oscar Bell', 16, 'CF'),
        await addPlayer(oppTeam2.id!, 'Zane Cooper', 9, 'RF'),
      ]
      const oppSlots2: LineupSlot[] = oppPlayers2.map((p, i) => ({
        orderPosition: i + 1,
        playerId: p.id!,
        playerName: p.name,
        jerseyNumber: p.jerseyNumber,
        position: p.defaultPosition,
        substitutions: [],
      }))

      // Game 1: Mudcats (home) vs Cardinals (away)
      const game1 = await createGame(team.id!, oppTeam.id!, team.id!)
      await saveLineup(game1.id!, 'home', ourSlots)
      await saveLineup(game1.id!, 'away', oppSlots)

      // Game 2: Mudcats (away) vs Eagles (home)
      const game2 = await createGame(team.id!, oppTeam2.id!, oppTeam2.id!)
      await saveLineup(game2.id!, 'away', ourSlots)
      await saveLineup(game2.id!, 'home', oppSlots2)

      // Reload everything
      const teams = await getAllTeams()
      setTeamsList(teams)
      const map = new Map<number, Team>()
      for (const t of teams) {
        if (t.id !== undefined) map.set(t.id, t)
      }
      setTeamsMap(map)
      setGames(await getAllGames())
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
    setTeamsList([])
    setTeamsMap(new Map())
    setGames([])
  }

  // Filter available teams for away/home dropdowns (prevent same team in both)
  const availableHomeTeams = teamsList.filter(t => t.id !== newAwayTeamId)
  const availableAwayTeams = teamsList.filter(t => t.id !== newHomeTeamId)

  const inProgressGames = games.filter(g => g.status === 'in_progress')
  const completedGames = games.filter(g => g.status === 'completed')

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-3xl font-bold text-slate-900 mb-8 font-heading uppercase tracking-wide">Scorekeeper</h1>

      <div className="space-y-4 mb-8">
        <Link
          to="/teams"
          className="block w-full text-center bg-slate-700 hover:bg-slate-800 text-white py-3 px-4 rounded-lg font-semibold"
        >
          Manage Teams
        </Link>
        <button
          onClick={handleStartNewGame}
          className="block w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg font-semibold"
        >
          Start New Game
        </button>
      </div>

      {/* No teams message */}
      {teamsList.length < 2 && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm">
          {teamsList.length === 0
            ? 'Create at least two teams to start a game.'
            : 'Create at least one more team to start a game.'}
          {' '}
          <Link to="/teams" className="underline font-semibold">Manage Teams</Link>
        </div>
      )}

      {/* New game dialog */}
      {showNewGame && (
        <div className="border border-slate-200 rounded-lg p-4 mb-6 bg-white">
          <h2 className="text-lg font-semibold mb-3 font-heading uppercase tracking-wide">New Game</h2>
          <div className="space-y-3">
            <div>
              <label htmlFor="away-team-select" className="block text-sm font-medium text-slate-700 mb-1">
                Away Team
              </label>
              <select
                id="away-team-select"
                value={newAwayTeamId ?? ''}
                onChange={e => {
                  const val = e.target.value ? Number(e.target.value) : null
                  setNewAwayTeamId(val)
                  // Clear home if it matches the newly selected away
                  if (val && val === newHomeTeamId) setNewHomeTeamId(null)
                }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              >
                <option value="">Select away team...</option>
                {availableAwayTeams.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="home-team-select" className="block text-sm font-medium text-slate-700 mb-1">
                Home Team
              </label>
              <select
                id="home-team-select"
                value={newHomeTeamId ?? ''}
                onChange={e => {
                  const val = e.target.value ? Number(e.target.value) : null
                  setNewHomeTeamId(val)
                  // Clear away if it matches the newly selected home
                  if (val && val === newAwayTeamId) setNewAwayTeamId(null)
                }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              >
                <option value="">Select home team...</option>
                {availableHomeTeams.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowNewGame(false)
                  setNewAwayTeamId(null)
                  setNewHomeTeamId(null)
                }}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 py-2 rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGame}
                disabled={!newAwayTeamId || !newHomeTeamId}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-2 rounded-lg font-semibold"
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
          <h2 className="text-lg font-semibold text-slate-800 mb-3 font-heading uppercase tracking-wide">In Progress</h2>
          <div className="space-y-2">
            {inProgressGames.map(g => (
              <GameRow
                key={g.id}
                game={g}
                teams={teamsMap}
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
          <h2 className="text-lg font-semibold text-slate-800 mb-3 font-heading uppercase tracking-wide">Completed</h2>
          <div className="space-y-2">
            {completedGames.map(g => (
              <GameRow
                key={g.id}
                game={g}
                teams={teamsMap}
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
            {seeding ? 'Seeding...' : 'Seed test data'}
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
