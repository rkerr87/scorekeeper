import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { db } from '../../db/database'
import { SyncService } from '../syncService'
import { createTeam, createGame, saveLineup, addPlay } from '../../db/gameService'

describe('SyncService', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  afterEach(async () => {
    await db.close()
  })

  it('should generate a 6-character alphanumeric game code', () => {
    const code = SyncService.generateGameCode()
    expect(code).toHaveLength(6)
    expect(/^[A-Z0-9]{6}$/.test(code)).toBe(true)
  })

  it('should generate unique codes', () => {
    const codes = new Set(Array.from({ length: 100 }, () => SyncService.generateGameCode()))
    expect(codes.size).toBeGreaterThan(90) // Statistically should all be unique
  })

  it('should export game data as JSON', async () => {
    const team1 = await createTeam('Mudcats')
    const team2 = await createTeam('Tigers')
    const game = await createGame(team1.id!, team2.id!, team1.id!)
    await saveLineup(game.id!, 'home', [
      { orderPosition: 1, playerId: 1, playerName: 'Alice', jerseyNumber: 1, position: 'P', substitutions: [] },
    ])
    await addPlay(game.id!, {
      inning: 1, half: 'top', batterOrderPosition: 1, playType: 'K',
      notation: 'K', fieldersInvolved: [], basesReached: [],
      runsScoredOnPlay: 0, rbis: 0, pitches: ['S', 'S', 'S'], isAtBat: true,
    })

    const exported = await SyncService.exportGame(game.id!)
    expect(exported).not.toBeNull()
    const parsed = JSON.parse(exported!)
    expect(parsed.game.team1Id).toBe(team1.id!)
    expect(parsed.game.team2Id).toBe(team2.id!)
    expect(parsed.game.homeTeamId).toBe(team1.id!)
    expect(parsed.lineups).toHaveLength(1)
    expect(parsed.plays).toHaveLength(1)
  })

  it('should import game data from JSON', async () => {
    const json = JSON.stringify({
      game: {
        team1Id: 1, team2Id: 2, homeTeamId: 1,
        code: 'IMPORT', date: new Date().toISOString(),
        status: 'in_progress',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      },
      lineups: [],
      plays: [],
    })

    const gameId = await SyncService.importGame(json)
    expect(gameId).toBeGreaterThan(0)

    const game = await db.games.get(gameId)
    expect(game?.team1Id).toBe(1)
    expect(game?.team2Id).toBe(2)
    expect(game?.homeTeamId).toBe(1)
  })
})
