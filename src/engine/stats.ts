import type { Play } from './types'

export interface PlayerStats {
  games: number
  atBats: number
  runs: number
  hits: number
  doubles: number
  triples: number
  homeRuns: number
  rbis: number
  walks: number
  strikeouts: number
  avg: number
  obp: number
  slg: number
}

const HIT_TYPES = ['1B', '2B', '3B', 'HR']
const NON_AB_TYPES = ['BB', 'HBP', 'SAC']

export function computePlayerStats(plays: Play[], batterOrderPosition: number, runs = 0): PlayerStats {
  const playerPlays = plays.filter(
    p => p.batterOrderPosition === batterOrderPosition && p.isAtBat
  )

  const atBats = playerPlays.filter(p => !NON_AB_TYPES.includes(p.playType)).length
  const hits = playerPlays.filter(p => HIT_TYPES.includes(p.playType)).length
  const doubles = playerPlays.filter(p => p.playType === '2B').length
  const triples = playerPlays.filter(p => p.playType === '3B').length
  const homeRuns = playerPlays.filter(p => p.playType === 'HR').length
  const walks = playerPlays.filter(p => p.playType === 'BB').length
  const strikeouts = playerPlays.filter(p => p.playType === 'K' || p.playType === 'KL').length
  const hbp = playerPlays.filter(p => p.playType === 'HBP').length
  const rbis = playerPlays.reduce((sum, p) => sum + p.rbis, 0)
  const avg = atBats > 0 ? hits / atBats : 0
  const obpDenom = atBats + walks + hbp
  const obp = obpDenom > 0 ? (hits + walks + hbp) / obpDenom : 0
  const totalBases = playerPlays.reduce((sum, p) => {
    if (p.playType === '1B') return sum + 1
    if (p.playType === '2B') return sum + 2
    if (p.playType === '3B') return sum + 3
    if (p.playType === 'HR') return sum + 4
    return sum
  }, 0)
  const slg = atBats > 0 ? totalBases / atBats : 0

  const gameIds = new Set(playerPlays.map(p => p.gameId))

  return { games: gameIds.size, atBats, runs, hits, doubles, triples, homeRuns, rbis, walks, strikeouts, avg, obp, slg }
}
