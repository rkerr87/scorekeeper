import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { Team } from '../engine/types'
import { getAllTeams, getPlayersForTeam, createTeam } from '../db/gameService'
import { useToast } from '../contexts/ToastContext'
import { Spinner } from '../components/Spinner'

interface TeamWithCount {
  team: Team
  playerCount: number
}

export function TeamsPage() {
  const { showToast } = useToast()
  const [teams, setTeams] = useState<TeamWithCount[]>([])
  const [teamName, setTeamName] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

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
    if (!teamName.trim() || creating) return
    if (teams.some(t => t.team.name.toLowerCase() === teamName.trim().toLowerCase())) {
      setError('A team with this name already exists')
      return
    }
    setError('')
    setCreating(true)
    try {
      const t = await createTeam(teamName.trim())
      setTeams([...teams, { team: t, playerCount: 0 }])
      setTeamName('')
      showToast('Team created', 'success')
    } finally {
      setCreating(false)
    }
  }

  if (loading) return <Spinner />

  return (
    <div className="max-w-lg mx-auto p-6">
      <Link to="/" className="text-blue-600 hover:underline text-sm">&larr; Home</Link>
      <h1 className="text-2xl font-bold text-slate-900 mt-4 mb-6 font-heading uppercase tracking-wide">Teams</h1>

      {/* Team list */}
      {teams.length === 0 ? (
        <p className="text-center text-slate-400 py-6">No teams yet. Create your first team to get started.</p>
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
        <h2 className="text-lg font-semibold text-slate-800 mb-3 font-heading uppercase">Add Team</h2>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="sr-only" htmlFor="team-name-input">Team name</label>
            <input
              id="team-name-input"
              type="text"
              placeholder="Team name"
              value={teamName}
              onChange={e => setTeamName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateTeam()}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
          <button
            onClick={handleCreateTeam}
            disabled={creating}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-semibold"
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
