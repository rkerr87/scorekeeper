import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import type { Game, Lineup, Play } from '../engine/types'
import { getGame, getLineupsForGame, getPlaysForGame, getTeam } from '../db/gameService'
import { replayGame } from '../engine/engine'
import { computePlayerStats } from '../engine/stats'
import { Spinner } from '../components/Spinner'

export function GameStatsPage() {
  const { gameId } = useParams()
  const [game, setGame] = useState<Game | null>(null)
  const [lineupHome, setLineupHome] = useState<Lineup | null>(null)
  const [lineupAway, setLineupAway] = useState<Lineup | null>(null)
  const [plays, setPlays] = useState<Play[]>([])
  const [homeTeamName, setHomeTeamName] = useState<string>('Home')
  const [awayTeamName, setAwayTeamName] = useState<string>('Away')
  const [loading, setLoading] = useState(true)

  const gId = parseInt(gameId ?? '0')

  useEffect(() => {
    async function load() {
      const g = await getGame(gId)
      if (!g) return
      setGame(g)
      const lineups = await getLineupsForGame(gId)
      setLineupHome(lineups.find(l => l.side === 'home') ?? null)
      setLineupAway(lineups.find(l => l.side === 'away') ?? null)
      const p = await getPlaysForGame(gId)
      setPlays(p)

      // Load team names
      const homeId = g.homeTeamId
      const awayId = g.team1Id === homeId ? g.team2Id : g.team1Id
      const [ht, at] = await Promise.all([getTeam(homeId), getTeam(awayId)])
      setHomeTeamName(ht?.name ?? 'Home')
      setAwayTeamName(at?.name ?? 'Away')

      setLoading(false)
    }
    load()
  }, [gId])

  if (loading) return <Spinner />
  if (!game || !lineupHome || !lineupAway) return <div className="p-6">Game not found.</div>

  const snapshot = replayGame(plays, lineupHome, lineupAway)

  const awayPlays = plays.filter(p => p.half === 'top')
  const homePlays = plays.filter(p => p.half === 'bottom')

  return (
    <div className="max-w-3xl mx-auto p-6">
      <Link to="/" className="text-blue-600 hover:underline text-sm">&larr; Home</Link>
      <h1 className="text-2xl font-bold text-slate-900 mt-4 mb-1 font-heading uppercase tracking-wide">
        {awayTeamName} vs {homeTeamName}
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        {game.code}
      </p>

      {/* Away team stats */}
      <h2 className="text-lg font-semibold text-slate-800 mb-2">{awayTeamName} (Away)</h2>
      <StatsTable
        lineup={lineupAway}
        teamPlays={awayPlays}
        runsMap={snapshot.runsScoredByPositionAway}
      />

      {/* Home team stats */}
      <h2 className="text-lg font-semibold text-slate-800 mt-6 mb-2">{homeTeamName} (Home)</h2>
      <StatsTable
        lineup={lineupHome}
        teamPlays={homePlays}
        runsMap={snapshot.runsScoredByPositionHome}
      />
    </div>
  )
}

function StatsTable({
  lineup,
  teamPlays,
  runsMap,
}: {
  lineup: Lineup
  teamPlays: Play[]
  runsMap: Map<number, number>
}) {
  return (
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
        {lineup.battingOrder.map(slot => {
          const stats = computePlayerStats(teamPlays, slot.orderPosition, runsMap.get(slot.orderPosition) ?? 0)
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
  )
}
