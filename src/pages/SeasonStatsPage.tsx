import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { Player, Play } from '../engine/types'
import { getAllTeams, getPlayersForTeam, getGamesForTeam } from '../db/gameService'
import { db } from '../db/database'
import { replayGame } from '../engine/engine'
import { computePlayerStats } from '../engine/stats'
import type { PlayerStats } from '../engine/stats'

interface PlayerSeasonStats {
  player: Player
  stats: PlayerStats
}

export function SeasonStatsPage() {
  const [playerStats, setPlayerStats] = useState<PlayerSeasonStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const teams = await getAllTeams()
      if (teams.length === 0) { setLoading(false); return }
      const team = teams[0]
      const players = await getPlayersForTeam(team.id!)
      const games = await getGamesForTeam(team.id!)

      // Gather all our at-bats across all games
      const allPlays: Play[] = []
      const playerOrderMap = new Map<number, number>() // playerId -> orderPosition
      const runsPerPlayer = new Map<number, number>()  // playerId -> total runs scored

      for (const game of games) {
        const lineups = await db.lineups.where('gameId').equals(game.id!).toArray()
        const ourLineup = lineups.find(l => l.side === 'us')
        const theirLineup = lineups.find(l => l.side === 'them')
        if (!ourLineup || !theirLineup) continue

        // Map player IDs to order positions for this game
        for (const slot of ourLineup.battingOrder) {
          if (slot.playerId) {
            playerOrderMap.set(slot.playerId, slot.orderPosition)
          }
        }

        const plays = await db.plays.where('gameId').equals(game.id!).toArray()
        // us bats bottom when home, top when away
        const usBattingHalf = game.homeOrAway === 'home' ? 'bottom' : 'top'
        const usPlays = plays.filter(p => p.half === usBattingHalf)
        allPlays.push(...usPlays)

        // Accumulate per-player runs from this game's snapshot
        const gameSnapshot = replayGame(plays, ourLineup, theirLineup, game.homeOrAway)
        for (const slot of ourLineup.battingOrder) {
          if (slot.playerId) {
            const slotRuns = gameSnapshot.runsScoredByPositionUs.get(slot.orderPosition) ?? 0
            runsPerPlayer.set(slot.playerId, (runsPerPlayer.get(slot.playerId) ?? 0) + slotRuns)
          }
        }
      }

      // Compute stats per player
      const results: PlayerSeasonStats[] = players.map(player => {
        const orderPos = playerOrderMap.get(player.id!) ?? 0
        const playerRuns = runsPerPlayer.get(player.id!) ?? 0
        const stats = computePlayerStats(allPlays, orderPos, playerRuns)
        return { player, stats }
      })

      setPlayerStats(results.filter(r => r.stats.games > 0))
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Link to="/" className="text-blue-600 hover:underline text-sm">&larr; Home</Link>
      <h1 className="text-2xl font-bold text-slate-900 mt-4 mb-6">Season Stats</h1>

      {playerStats.length === 0 ? (
        <p className="text-slate-500">No games played yet.</p>
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
