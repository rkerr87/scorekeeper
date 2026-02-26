import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import type { Game, Lineup, Play } from '../engine/types'
import { getGame, getLineupsForGame, getPlaysForGame } from '../db/gameService'
import { computePlayerStats } from '../engine/stats'

export function GameStatsPage() {
  const { gameId } = useParams()
  const [game, setGame] = useState<Game | null>(null)
  const [lineupUs, setLineupUs] = useState<Lineup | null>(null)
  const [plays, setPlays] = useState<Play[]>([])
  const [loading, setLoading] = useState(true)

  const gId = parseInt(gameId ?? '0')

  useEffect(() => {
    async function load() {
      const g = await getGame(gId)
      if (!g) return
      setGame(g)
      const lineups = await getLineupsForGame(gId)
      setLineupUs(lineups.find(l => l.side === 'us') ?? null)
      const p = await getPlaysForGame(gId)
      setPlays(p)
      setLoading(false)
    }
    load()
  }, [gId])

  if (loading) return <div className="p-6">Loading...</div>
  if (!game || !lineupUs) return <div className="p-6">Game not found.</div>

  // us bats bottom when home, top when away
  const usBattingHalf = game.homeOrAway === 'home' ? 'bottom' : 'top'
  const usPlays = plays.filter(p => p.half === usBattingHalf)

  return (
    <div className="max-w-3xl mx-auto p-6">
      <Link to="/" className="text-blue-600 hover:underline text-sm">&larr; Home</Link>
      <h1 className="text-2xl font-bold text-slate-900 mt-4 mb-1">
        vs {game.opponentName}
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        {game.homeOrAway === 'home' ? 'Home' : 'Away'} &middot; {game.code}
      </p>

      {/* Player stats table */}
      <table className="w-full border-collapse bg-white rounded-lg overflow-hidden text-sm">
        <thead>
          <tr className="bg-slate-100 text-left">
            <th className="px-3 py-2">Player</th>
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
          </tr>
        </thead>
        <tbody>
          {lineupUs.battingOrder.map(slot => {
            const stats = computePlayerStats(usPlays, slot.orderPosition)
            return (
              <tr key={slot.orderPosition} className="border-t border-slate-100">
                <td className="px-3 py-2 font-semibold">{slot.playerName}</td>
                <td className="px-2 py-2 text-center font-mono">{stats.atBats}</td>
                <td className="px-2 py-2 text-center font-mono">{stats.runs}</td>
                <td className="px-2 py-2 text-center font-mono">{stats.hits}</td>
                <td className="px-2 py-2 text-center font-mono">{stats.doubles}</td>
                <td className="px-2 py-2 text-center font-mono">{stats.triples}</td>
                <td className="px-2 py-2 text-center font-mono">{stats.homeRuns}</td>
                <td className="px-2 py-2 text-center font-mono">{stats.rbis}</td>
                <td className="px-2 py-2 text-center font-mono">{stats.walks}</td>
                <td className="px-2 py-2 text-center font-mono">{stats.strikeouts}</td>
                <td className="px-2 py-2 text-center font-mono">
                  {stats.atBats > 0 ? stats.avg.toFixed(3) : '.000'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
