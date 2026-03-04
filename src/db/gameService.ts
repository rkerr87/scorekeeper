import { db } from './database'
import type { Team, Player, Game, Lineup, Play, LineupSlot, HalfInning, PlayType, PitchResult, BaseRunnerOverride } from '../engine/types'

// --- Teams ---

export async function createTeam(name: string): Promise<Team> {
  const team: Team = { name, createdAt: new Date() }
  const id = await db.teams.add(team)
  return { ...team, id }
}

export async function getTeam(id: number): Promise<Team | undefined> {
  return db.teams.get(id)
}

export async function getAllTeams(): Promise<Team[]> {
  return db.teams.toArray()
}

export async function updateTeamName(teamId: number, name: string): Promise<void> {
  await db.teams.update(teamId, { name })
}

export async function deleteTeam(teamId: number): Promise<void> {
  await db.transaction('rw', [db.players, db.teams], async () => {
    await db.players.where('teamId').equals(teamId).delete()
    await db.teams.delete(teamId)
  })
}

// --- Players ---

export async function addPlayer(
  teamId: number,
  name: string,
  jerseyNumber: number,
  defaultPosition: string,
): Promise<Player> {
  const player: Player = { teamId, name, jerseyNumber, defaultPosition, createdAt: new Date() }
  const id = await db.players.add(player)
  return { ...player, id }
}

export async function getPlayersForTeam(teamId: number): Promise<Player[]> {
  return db.players.where('teamId').equals(teamId).toArray()
}

export async function deletePlayer(id: number): Promise<void> {
  await db.players.delete(id)
}

export async function updatePlayer(id: number, updates: { name?: string; jerseyNumber?: number; defaultPosition?: string }): Promise<void> {
  await db.players.update(id, updates)
}

// --- Games ---

function generateGameCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export async function createGame(
  team1Id: number,
  team2Id: number,
  homeTeamId: number,
): Promise<Game> {
  const now = new Date()
  const game: Game = {
    team1Id,
    team2Id,
    homeTeamId,
    code: generateGameCode(),
    date: now,
    status: 'in_progress',
    createdAt: now,
    updatedAt: now,
  }
  const id = await db.games.add(game)
  return { ...game, id }
}

export async function getGame(id: number): Promise<Game | undefined> {
  return db.games.get(id)
}

export async function getGamesForTeam(teamId: number): Promise<Game[]> {
  const byTeam1 = await db.games
    .where('team1Id')
    .equals(teamId)
    .filter(g => g.status !== 'deleted')
    .toArray()
  const byTeam2 = await db.games
    .where('team2Id')
    .equals(teamId)
    .filter(g => g.status !== 'deleted')
    .toArray()
  const seen = new Set<number>()
  const result: Game[] = []
  for (const g of [...byTeam1, ...byTeam2]) {
    if (g.id !== undefined && !seen.has(g.id)) {
      seen.add(g.id)
      result.push(g)
    }
  }
  return result
}

export async function getAllGames(): Promise<Game[]> {
  return db.games.filter(g => g.status !== 'deleted').toArray()
}

export async function updateGameStatus(id: number, status: Game['status']): Promise<void> {
  await db.games.update(id, { status, updatedAt: new Date() })
}

export async function deleteGame(id: number): Promise<void> {
  await updateGameStatus(id, 'deleted')
}

// --- Lineups ---

export async function saveLineup(
  gameId: number,
  side: 'home' | 'away',
  battingOrder: LineupSlot[],
): Promise<Lineup> {
  // Upsert in a transaction to prevent data loss if crash between delete and add
  return db.transaction('rw', db.lineups, async () => {
    const existing = await db.lineups
      .where('[gameId+side]')
      .equals([gameId, side])
      .first()
    if (existing?.id) {
      await db.lineups.delete(existing.id)
    }
    const lineup: Lineup = { gameId, side, battingOrder }
    const id = await db.lineups.add(lineup)
    return { ...lineup, id }
  })
}

export async function getLineupsForGame(gameId: number): Promise<Lineup[]> {
  return db.lineups.where('gameId').equals(gameId).toArray()
}

// --- Plays ---

interface AddPlayInput {
  inning: number
  half: HalfInning
  batterOrderPosition: number
  playType: PlayType
  notation: string
  fieldersInvolved: number[]
  basesReached: number[]
  runsScoredOnPlay: number
  rbis: number
  pitches: PitchResult[]
  isAtBat: boolean
  runnerOverrides?: BaseRunnerOverride
  pitcherName?: string
}

export async function addPlay(gameId: number, input: AddPlayInput): Promise<Play> {
  // Transaction ensures atomic read-then-write for sequence number
  return db.transaction('rw', db.plays, async () => {
    const existing = await db.plays.where('gameId').equals(gameId).toArray()
    const maxSeq = existing.reduce((max, p) => Math.max(max, p.sequenceNumber), 0)

    const play: Play = {
      gameId,
      sequenceNumber: maxSeq + 1,
      ...input,
      timestamp: new Date(),
    }
    const id = await db.plays.add(play)
    return { ...play, id }
  })
}

export async function getPlaysForGame(gameId: number): Promise<Play[]> {
  return db.plays.where('gameId').equals(gameId).sortBy('sequenceNumber')
}

export async function deleteLastPlay(gameId: number): Promise<void> {
  const plays = await db.plays.where('gameId').equals(gameId).sortBy('sequenceNumber')
  if (plays.length > 0) {
    const last = plays[plays.length - 1]
    if (last.id) {
      await db.plays.delete(last.id)
    }
  }
}

export async function deletePlayAndSubsequent(gameId: number, playId: number): Promise<void> {
  const plays = await db.plays.where('gameId').equals(gameId).sortBy('sequenceNumber')
  const targetPlay = plays.find(p => p.id === playId)
  if (!targetPlay) return
  const toDelete = plays.filter(p => p.sequenceNumber >= targetPlay.sequenceNumber)
  const idsToDelete = toDelete.map(p => p.id).filter((id): id is number => id !== undefined)
  await db.plays.bulkDelete(idsToDelete)
}

export async function updatePlay(id: number, updates: Partial<Play>): Promise<void> {
  await db.plays.update(id, updates)
}
