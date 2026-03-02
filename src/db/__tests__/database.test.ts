import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { db } from '../database'

describe('ScoreKeeperDB', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  afterEach(async () => {
    await db.close()
  })

  it('should have all expected tables', () => {
    const tableNames = db.tables.map(t => t.name)
    expect(tableNames).toContain('teams')
    expect(tableNames).toContain('players')
    expect(tableNames).toContain('games')
    expect(tableNames).toContain('lineups')
    expect(tableNames).toContain('plays')
  })

  it('should insert and retrieve a team', async () => {
    const teamId = await db.teams.add({
      name: 'Mudcats',
      createdAt: new Date(),
    })
    const team = await db.teams.get(teamId)
    expect(team?.name).toBe('Mudcats')
  })

  it('should insert and retrieve a player', async () => {
    const teamId = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
    const playerId = await db.players.add({
      teamId,
      name: 'John Doe',
      jerseyNumber: 23,
      defaultPosition: 'SS',
      createdAt: new Date(),
    })
    const player = await db.players.get(playerId)
    expect(player?.name).toBe('John Doe')
    expect(player?.jerseyNumber).toBe(23)
  })

  it('should query players by teamId', async () => {
    const teamId = await db.teams.add({ name: 'Mudcats', createdAt: new Date() })
    await db.players.bulkAdd([
      { teamId, name: 'Player 1', jerseyNumber: 1, defaultPosition: 'P', createdAt: new Date() },
      { teamId, name: 'Player 2', jerseyNumber: 2, defaultPosition: 'C', createdAt: new Date() },
    ])
    const players = await db.players.where('teamId').equals(teamId).toArray()
    expect(players).toHaveLength(2)
  })

  it('should insert and retrieve plays by gameId', async () => {
    await db.plays.add({
      gameId: 1,
      sequenceNumber: 1,
      inning: 1,
      half: 'top',
      batterOrderPosition: 1,
      playType: 'K',
      notation: 'K',
      fieldersInvolved: [],
      basesReached: [],
      runsScoredOnPlay: 0,
      rbis: 0,
      pitches: ['S', 'B', 'S'],
      isAtBat: true,
      timestamp: new Date(),
    })
    const plays = await db.plays.where('gameId').equals(1).toArray()
    expect(plays).toHaveLength(1)
    expect(plays[0].pitches).toEqual(['S', 'B', 'S'])
  })

  it('should store and retrieve lineups with nested battingOrder', async () => {
    await db.lineups.add({
      gameId: 1,
      side: 'home',
      battingOrder: [
        {
          orderPosition: 1,
          playerId: 1,
          playerName: 'John Doe',
          jerseyNumber: 23,
          position: 'SS',
          substitutions: [],
        },
      ],
    })
    const lineups = await db.lineups.where('gameId').equals(1).toArray()
    expect(lineups).toHaveLength(1)
    expect(lineups[0].battingOrder[0].playerName).toBe('John Doe')
  })
})
