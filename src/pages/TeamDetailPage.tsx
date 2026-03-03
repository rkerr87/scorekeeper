import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Team, Player } from '../engine/types'
import { getTeam, getPlayersForTeam, addPlayer, deletePlayer, updatePlayer, getGamesForTeam, deleteTeam, updateTeamName } from '../db/gameService'
import { Spinner } from '../components/Spinner'
import { useToast } from '../contexts/ToastContext'

export function TeamDetailPage() {
  const { teamId } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [team, setTeam] = useState<Team | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)

  const [playerName, setPlayerName] = useState('')
  const [jerseyNumber, setJerseyNumber] = useState('')
  const [position, setPosition] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<{ name?: string; jersey?: string }>({})
  const [isEditingName, setIsEditingName] = useState(false)
  const [editName, setEditName] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [showDeleteTeam, setShowDeleteTeam] = useState(false)
  const [deleteTeamBlocked, setDeleteTeamBlocked] = useState(false)
  const [editingPlayerId, setEditingPlayerId] = useState<number | null>(null)
  const [editPlayerName, setEditPlayerName] = useState('')
  const [editJersey, setEditJersey] = useState('')
  const [editPosition, setEditPosition] = useState('')

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
    if (!team?.id || submitting) return
    const newErrors: { name?: string; jersey?: string } = {}
    if (!playerName.trim()) newErrors.name = 'Name is required'
    if (!jerseyNumber.trim() || isNaN(Number(jerseyNumber))) newErrors.jersey = 'Jersey # must be a number'
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    setErrors({})
    setSubmitting(true)
    try {
      const p = await addPlayer(team.id, playerName.trim(), parseInt(jerseyNumber), position.trim() || 'UT')
      setPlayers([...players, p])
      setPlayerName('')
      setJerseyNumber('')
      setPosition('')
      showToast('Player added', 'success')
    } finally {
      setSubmitting(false)
    }
  }

  const startEdit = (p: Player) => {
    setEditingPlayerId(p.id!)
    setEditPlayerName(p.name)
    setEditJersey(String(p.jerseyNumber))
    setEditPosition(p.defaultPosition)
  }

  const saveEdit = async () => {
    if (!editingPlayerId || !editPlayerName.trim() || !editJersey.trim()) return
    await updatePlayer(editingPlayerId, {
      name: editPlayerName.trim(),
      jerseyNumber: parseInt(editJersey),
      defaultPosition: editPosition || 'UT',
    })
    setPlayers(players.map(p => p.id === editingPlayerId
      ? { ...p, name: editPlayerName.trim(), jerseyNumber: parseInt(editJersey), defaultPosition: editPosition || 'UT' }
      : p
    ))
    setEditingPlayerId(null)
  }

  const handleDeletePlayer = async (id: number) => {
    await deletePlayer(id)
    setPlayers(players.filter(p => p.id !== id))
    setConfirmDeleteId(null)
    showToast('Player deleted', 'success')
  }

  const handleDeleteTeam = async () => {
    const games = await getGamesForTeam(tId)
    if (games.length > 0) {
      setDeleteTeamBlocked(true)
      return
    }
    setShowDeleteTeam(true)
  }

  const handleStartRename = () => {
    setEditName(team!.name)
    setIsEditingName(true)
  }

  const handleSaveRename = async () => {
    const trimmed = editName.trim()
    if (trimmed && trimmed !== team!.name) {
      await updateTeamName(tId, trimmed)
      setTeam({ ...team!, name: trimmed })
      showToast('Team renamed', 'success')
    }
    setIsEditingName(false)
  }

  const confirmDeleteTeam = async () => {
    await deleteTeam(tId)
    showToast('Team deleted', 'success')
    navigate('/teams')
  }

  if (loading) return <Spinner />
  if (!team) return <div className="p-6">Team not found.</div>

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Link to="/teams" className="text-blue-600 hover:underline text-sm">&larr; Teams</Link>
      {isEditingName ? (
        <input
          autoFocus
          value={editName}
          onChange={e => setEditName(e.target.value)}
          onBlur={handleSaveRename}
          onKeyDown={e => e.key === 'Enter' && handleSaveRename()}
          className="text-2xl font-bold text-slate-900 mt-4 mb-2 border-b-2 border-blue-500 outline-none bg-transparent w-full"
        />
      ) : (
        <h1 onClick={handleStartRename} className="text-2xl font-bold text-slate-900 mt-4 mb-2 font-heading uppercase tracking-wide cursor-pointer hover:text-blue-600 group">
          {team.name} <span aria-hidden="true" className="text-slate-300 text-sm group-hover:text-blue-400">✎</span>
        </h1>
      )}
      <p className="text-slate-500 mb-6">{players.length} player{players.length !== 1 ? 's' : ''}</p>

      {/* Add player form */}
      <div className="border border-slate-200 rounded-lg p-4 mb-6 bg-white">
        <h2 className="text-lg font-semibold text-slate-800 mb-3 font-heading uppercase">Add Player</h2>
        <div className="flex gap-2 items-start">
          <div className="flex-1">
            <label className="sr-only" htmlFor="player-name-input">Player name</label>
            <input id="player-name-input" type="text" placeholder="Player name" value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              className={`w-full border rounded-lg px-3 py-2 text-sm ${errors.name ? 'border-red-400' : 'border-slate-300'}`} />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>
          <div className="w-20">
            <label className="sr-only" htmlFor="jersey-number-input">Jersey number</label>
            <input id="jersey-number-input" type="text" inputMode="numeric" placeholder="Jersey #" value={jerseyNumber}
              onChange={e => setJerseyNumber(e.target.value)}
              className={`w-full border rounded-lg px-3 py-2 text-sm ${errors.jersey ? 'border-red-400' : 'border-slate-300'}`} />
            {errors.jersey && <p className="text-red-500 text-xs mt-1">{errors.jersey}</p>}
          </div>
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

      {/* Roster empty state */}
      {players.length === 0 && (
        <p className="text-center text-slate-400 py-6">No players on the roster yet. Add your first player above.</p>
      )}

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
              editingPlayerId === p.id ? (
                <tr key={p.id} className="border-t border-slate-100 bg-blue-50">
                  <td className="px-4 py-2" colSpan={4}>
                    <div className="flex gap-2 items-center flex-wrap">
                      <input value={editPlayerName} onChange={e => setEditPlayerName(e.target.value)}
                        className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm min-w-0" />
                      <input value={editJersey} onChange={e => setEditJersey(e.target.value)}
                        className="w-16 border border-slate-300 rounded px-2 py-1 text-sm" inputMode="numeric" />
                      <select value={editPosition} onChange={e => setEditPosition(e.target.value)}
                        className="w-20 border border-slate-300 rounded px-1 py-1 text-sm bg-white">
                        <option value="">UT</option>
                        {['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'].map(pos => (
                          <option key={pos} value={pos}>{pos}</option>
                        ))}
                      </select>
                      <button onClick={saveEdit} className="bg-blue-600 text-white px-3 py-1 rounded text-sm font-semibold">Save</button>
                      <button onClick={() => setEditingPlayerId(null)} className="text-slate-500 text-sm">Cancel</button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={p.id} className="border-t border-slate-100 cursor-pointer hover:bg-slate-50" onClick={() => startEdit(p)}>
                  <td className="px-4 py-2 text-sm font-mono">{p.jerseyNumber}</td>
                  <td className="px-4 py-2 text-sm font-semibold">{p.name}</td>
                  <td className="px-4 py-2 text-sm text-slate-600">{p.defaultPosition}</td>
                  <td className="px-4 py-2">
                    {confirmDeleteId === p.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-600">Delete {p.name}?</span>
                        <button onClick={e => { e.stopPropagation(); handleDeletePlayer(p.id!) }} className="text-red-600 font-bold text-xs">Yes</button>
                        <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(null) }} className="text-slate-500 text-xs">No</button>
                      </div>
                    ) : (
                      <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(p.id!) }}
                        className="text-red-500 hover:text-red-700 text-sm px-3 py-2">
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      )}

      {/* Delete Team section */}
      <div className="mt-8 pt-6 border-t border-slate-200">
        {deleteTeamBlocked && (
          <p className="text-sm text-red-600 mb-2">Can't delete — this team has games. Delete those games first.</p>
        )}
        {showDeleteTeam ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-red-600 font-medium">Delete {team.name}? This cannot be undone.</span>
            <button onClick={confirmDeleteTeam} className="text-red-600 font-bold text-sm">Yes, Delete</button>
            <button onClick={() => setShowDeleteTeam(false)} className="text-slate-500 text-sm">Cancel</button>
          </div>
        ) : (
          <button onClick={handleDeleteTeam} className="text-red-500 hover:text-red-700 text-sm border border-red-300 rounded-lg px-4 py-2">
            Delete Team
          </button>
        )}
      </div>
    </div>
  )
}
