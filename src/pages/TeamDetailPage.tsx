import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Team, Player } from '../engine/types'
import { getTeam, getPlayersForTeam, addPlayer, deletePlayer } from '../db/gameService'

export function TeamDetailPage() {
  const { teamId } = useParams()
  const [team, setTeam] = useState<Team | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)

  const [playerName, setPlayerName] = useState('')
  const [jerseyNumber, setJerseyNumber] = useState('')
  const [position, setPosition] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const tId = parseInt(teamId ?? '0')

  useEffect(() => {
    async function load() {
      const t = await getTeam(tId)
      if (t) {
        setTeam(t)
        setPlayers(await getPlayersForTeam(tId))
      }
      setLoading(false)
    }
    load()
  }, [tId])

  const handleAddPlayer = async () => {
    if (!team?.id || !playerName.trim() || !jerseyNumber.trim() || submitting) return
    setSubmitting(true)
    try {
      const p = await addPlayer(team.id, playerName.trim(), parseInt(jerseyNumber), position.trim() || 'UT')
      setPlayers([...players, p])
      setPlayerName('')
      setJerseyNumber('')
      setPosition('')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeletePlayer = async (id: number) => {
    await deletePlayer(id)
    setPlayers(players.filter(p => p.id !== id))
  }

  if (loading) return <div className="p-6">Loading...</div>
  if (!team) return <div className="p-6">Team not found.</div>

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Link to="/teams" className="text-blue-600 hover:underline text-sm">&larr; Teams</Link>
      <h1 className="text-2xl font-bold text-slate-900 mt-4 mb-2 font-heading uppercase tracking-wide">{team.name}</h1>
      <p className="text-slate-500 mb-6">{players.length} player{players.length !== 1 ? 's' : ''}</p>

      {/* Add player form */}
      <div className="border border-slate-200 rounded-lg p-4 mb-6 bg-white">
        <h2 className="text-lg font-semibold text-slate-800 mb-3 font-heading uppercase">Add Player</h2>
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="player-name-input">Player name</label>
          <input id="player-name-input" type="text" placeholder="Player name" value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <label className="sr-only" htmlFor="jersey-number-input">Jersey number</label>
          <input id="jersey-number-input" type="text" inputMode="numeric" placeholder="Jersey #" value={jerseyNumber}
            onChange={e => setJerseyNumber(e.target.value)}
            className="w-20 border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <select value={position} onChange={e => setPosition(e.target.value)}
            className="w-24 border border-slate-300 rounded-lg px-2 py-2 text-sm bg-white">
            <option value="">Pos</option>
            {['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'].map(pos => (
              <option key={pos} value={pos} disabled={players.some(p => p.defaultPosition === pos)}>
                {pos}
              </option>
            ))}
          </select>
          <button onClick={handleAddPlayer}
            disabled={submitting}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-semibold text-sm">
            {submitting ? 'Adding...' : 'Add Player'}
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
                  <button onClick={() => handleDeletePlayer(p.id!)}
                    className="text-red-500 hover:text-red-700 text-sm px-3 py-2">
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
