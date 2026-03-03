import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { Team, Player, Play, HalfInning } from '../engine/types'
import { getAllTeams, getPlayersForTeam, getGamesForTeam } from '../db/gameService'
import { db } from '../db/database'
import { replayGame } from '../engine/engine'
import { computePlayerStats } from '../engine/stats'
import type { PlayerStats } from '../engine/stats'
import { Spinner } from '../components/Spinner'

interface PlayerSeasonStats {
  player: Player
  stats: PlayerStats
}

export function SeasonStatsPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null)
  const [playerStats, setPlayerStats] = useState<PlayerSeasonStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadTeams() {
      const allTeams = await getAllTeams()
      setTeams(allTeams)
      if (allTeams.length > 0) {
        setSelectedTeamId(allTeams[0].id!)
      }
      setLoading(false)
    }
    loadTeams()
  }, [])

  useEffect(() => {
    if (selectedTeamId === null) return

    let cancelled = false

    async function loadStats() {
      setLoading(true)
      try {
        const players = await getPlayersForTeam(selectedTeamId!)
        const games = await getGamesForTeam(selectedTeamId!)

        const allPlays: Play[] = []
        const playerOrderMap = new Map<number, number>() // playerId -> orderPosition
        const runsPerPlayer = new Map<number, number>()  // playerId -> total runs scored

        for (const game of games) {
          if (cancelled) return
          const lineups = await db.lineups.where('gameId').equals(game.id!).toArray()
          const homeLineup = lineups.find(l => l.side === 'home')
          const awayLineup = lineups.find(l => l.side === 'away')
          if (!homeLineup || !awayLineup) continue

          const isHome = game.homeTeamId === selectedTeamId
          const teamLineup = isHome ? homeLineup : awayLineup
          const teamBattingHalf: HalfInning = isHome ? 'bottom' : 'top'

          // Map player IDs to order positions for this game
          for (const slot of teamLineup.battingOrder) {
            if (slot.playerId) {
              playerOrderMap.set(slot.playerId, slot.orderPosition)
            }
          }

          const plays = await db.plays.where('gameId').equals(game.id!).toArray()
          const teamPlays = plays.filter(p => p.half === teamBattingHalf)
          allPlays.push(...teamPlays)

          // Accumulate per-player runs from this game's snapshot
          const gameSnapshot = replayGame(plays, homeLineup, awayLineup)
          const runsMap = isHome
            ? gameSnapshot.runsScoredByPositionHome
            : gameSnapshot.runsScoredByPositionAway
          for (const slot of teamLineup.battingOrder) {
            if (slot.playerId) {
              const slotRuns = runsMap.get(slot.orderPosition) ?? 0
              runsPerPlayer.set(slot.playerId, (runsPerPlayer.get(slot.playerId) ?? 0) + slotRuns)
            }
          }
        }

        if (cancelled) return

        // Compute stats per player
        const results: PlayerSeasonStats[] = players.map(player => {
          const orderPos = playerOrderMap.get(player.id!) ?? 0
          const playerRuns = runsPerPlayer.get(player.id!) ?? 0
          const stats = computePlayerStats(allPlays, orderPos, playerRuns)
          return { player, stats }
        })

        setPlayerStats(results.filter(r => r.stats.games > 0))
        setLoading(false)
      } catch {
        if (!cancelled) setLoading(false)
      }
    }

    loadStats()
    return () => { cancelled = true }
  }, [selectedTeamId])

  if (loading && teams.length === 0) return <Spinner />

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Link to="/" className="text-blue-600 hover:underline text-sm">&larr; Home</Link>
      <h1 className="text-2xl font-bold text-slate-900 mt-4 mb-4 font-heading uppercase tracking-wide">Season Stats</h1>

      {teams.length > 1 && (
        <div className="mb-6">
          <label htmlFor="team-select" className="text-sm font-medium text-slate-700 mr-2">Team:</label>
          <select
            id="team-select"
            value={selectedTeamId ?? ''}
            onChange={e => setSelectedTeamId(Number(e.target.value))}
            className="border border-slate-300 rounded px-3 py-1.5 text-sm"
          >
            {teams.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : playerStats.length === 0 ? (
        <p className="text-center text-slate-400 py-6">No completed games yet for this team.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse bg-white rounded-lg overflow-hidden text-sm">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className="px-3 py-2">Player</th>
                <th className="px-2 py-2 text-center">G</th>
                <th className="px-2 py-2 text-center">AB</th>
                <th className="px-2 py-2 text-center">R</th>
                <th className="px-2 py-2 text-center">H</th>
                <th className="px-2 py-2 text-center">2B</th>
                <th className="px-2 py-2 text-center">3B</th>
                <th className="px-2 py-2 text-center">HR</th>
                <th className="px-2 py-2 text-center">RBI</th>
                <th className="px-2 py-2 text-center">BB</th>
                <th className="px-2 py-2 text-center">K</th>
                <th className="px-2 py-2 text-center">AVG</th>
                <th className="px-2 py-2 text-center">OBP</th>
                <th className="px-2 py-2 text-center">SLG</th>
              </tr>
            </thead>
            <tbody>
              {playerStats.map(({ player, stats }) => (
                <tr key={player.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-semibold">{player.name}</td>
                  <td className="px-2 py-2 text-center font-mono">{stats.games}</td>
                  <td className="px-2 py-2 text-center font-mono">{stats.atBats}</td>
                  <td className="px-2 py-2 text-center font-mono">{stats.runs}</td>
                  <td className="px-2 py-2 text-center font-mono">{stats.hits}</td>
                  <td className="px-2 py-2 text-center font-mono">{stats.doubles}</td>
                  <td className="px-2 py-2 text-center font-mono">{stats.triples}</td>
                  <td className="px-2 py-2 text-center font-mono">{stats.homeRuns}</td>
                  <td className="px-2 py-2 text-center font-mono">{stats.rbis}</td>
                  <td className="px-2 py-2 text-center font-mono">{stats.walks}</td>
                  <td className="px-2 py-2 text-center font-mono">{stats.strikeouts}</td>
                  <td className="px-2 py-2 text-center font-mono">{stats.avg.toFixed(3)}</td>
                  <td className="px-2 py-2 text-center font-mono">{stats.obp.toFixed(3)}</td>
                  <td className="px-2 py-2 text-center font-mono">{stats.slg.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
