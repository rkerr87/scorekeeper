import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { Team, Player } from '../engine/types'
import { createTeam, getAllTeams, addPlayer, getPlayersForTeam, deletePlayer } from '../db/gameService'

export function TeamPage() {
  const [team, setTeam] = useState<Team | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)

  // Create team form
  const [teamName, setTeamName] = useState('')

  // Add player form
  const [playerName, setPlayerName] = useState('')
  const [jerseyNumber, setJerseyNumber] = useState('')
  const [position, setPosition] = useState('')

  useEffect(() => {
    async function load() {
      const teams = await getAllTeams()
      if (teams.length > 0) {
        setTeam(teams[0])
        const p = await getPlayersForTeam(teams[0].id!)
        setPlayers(p)
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleCreateTeam = async () => {
    if (!teamName.trim()) return
    const t = await createTeam(teamName.trim())
    setTeam(t)
    setTeamName('')
  }

  const handleAddPlayer = async () => {
    if (!team?.id || !playerName.trim() || !jerseyNumber.trim()) return
    const p = await addPlayer(team.id, playerName.trim(), parseInt(jerseyNumber), position.trim() || 'UT')
    setPlayers([...players, p])
    setPlayerName('')
    setJerseyNumber('')
    setPosition('')
  }

  const handleDeletePlayer = async (id: number) => {
    await deletePlayer(id)
    setPlayers(players.filter(p => p.id !== id))
  }

  if (loading) return <div className="p-6">Loading...</div>

  if (!team) {
    return (
      <div className="max-w-lg mx-auto p-6">
        <Link to="/" className="text-blue-600 hover:underline text-sm">&larr; Back</Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-4 mb-6">Create Team</h1>
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
            Create Team
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Link to="/" className="text-blue-600 hover:underline text-sm">&larr; Back</Link>
      <h1 className="text-2xl font-bold text-slate-900 mt-4 mb-2">{team.name}</h1>
      <p className="text-slate-500 mb-6">{players.length} player{players.length !== 1 ? 's' : ''}</p>

      {/* Add player form */}
      <div className="border border-slate-200 rounded-lg p-4 mb-6 bg-white">
        <h2 className="text-lg font-semibold text-slate-800 mb-3">Add Player</h2>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Player name"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="text"
            inputMode="numeric"
            placeholder="Jersey #"
            value={jerseyNumber}
            onChange={e => setJerseyNumber(e.target.value)}
            className="w-20 border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="Position"
            value={position}
            onChange={e => setPosition(e.target.value)}
            className="w-20 border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={handleAddPlayer}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold text-sm"
          >
            Add Player
          </button>
        </div>
      </div>

      {/* Roster table */}
      {players.length > 0 && (
        <table className="w-full border-collapse bg-white rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-slate-100 text-left text-sm text-slate-600">
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Pos</th>
              <th className="px-4 py-2 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {players.map(p => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-4 py-2 text-sm font-mono">{p.jerseyNumber}</td>
                <td className="px-4 py-2 text-sm font-semibold">{p.name}</td>
                <td className="px-4 py-2 text-sm text-slate-600">{p.defaultPosition}</td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => handleDeletePlayer(p.id!)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
