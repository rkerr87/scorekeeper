import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { Team } from '../engine/types'
import { getAllTeams, getPlayersForTeam, createTeam } from '../db/gameService'

interface TeamWithCount {
  team: Team
  playerCount: number
}

export function TeamsPage() {
  const [teams, setTeams] = useState<TeamWithCount[]>([])
  const [teamName, setTeamName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const allTeams = await getAllTeams()
      const withCounts = await Promise.all(
        allTeams.map(async t => ({
          team: t,
          playerCount: (await getPlayersForTeam(t.id!)).length,
        }))
      )
      setTeams(withCounts)
      setLoading(false)
    }
    load()
  }, [])

  const handleCreateTeam = async () => {
    if (!teamName.trim()) return
    const t = await createTeam(teamName.trim())
    setTeams([...teams, { team: t, playerCount: 0 }])
    setTeamName('')
  }

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="max-w-lg mx-auto p-6">
      <Link to="/" className="text-blue-600 hover:underline text-sm">&larr; Home</Link>
      <h1 className="text-2xl font-bold text-slate-900 mt-4 mb-6">Teams</h1>

      {/* Team list */}
      {teams.length === 0 ? (
        <p className="text-slate-500 mb-6">No teams yet. Create one below.</p>
      ) : (
        <div className="space-y-2 mb-6">
          {teams.map(({ team, playerCount }) => (
            <Link
              key={team.id}
              to={`/teams/${team.id}`}
              className="block bg-white border border-slate-200 rounded-lg px-4 py-3 hover:bg-slate-50"
            >
              <div className="font-semibold text-slate-900">{team.name}</div>
              <div className="text-xs text-slate-500">{playerCount} player{playerCount !== 1 ? 's' : ''}</div>
            </Link>
          ))}
        </div>
      )}

      {/* Add team form */}
      <div className="border border-slate-200 rounded-lg p-4 bg-white">
        <h2 className="text-lg font-semibold text-slate-800 mb-3">Add Team</h2>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Team name"
            value={teamName}
            onChange={e => setTeamName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateTeam()}
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2"
          />
          <button
            onClick={handleCreateTeam}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  )
}
