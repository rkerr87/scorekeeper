import { db } from '../db/database'
import type { Game, Lineup, Play } from '../engine/types'

interface GameExport {
  game: Omit<Game, 'id'>
  lineups: Omit<Lineup, 'id'>[]
  plays: Omit<Play, 'id'>[]
}

export class SyncService {
  static generateGameCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // No ambiguous chars (0/O, 1/I)
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)]
    }
    return code
  }

  static async exportGame(gameId: number): Promise<string | null> {
    const game = await db.games.get(gameId)
    if (!game) return null

    const lineups = await db.lineups.where('gameId').equals(gameId).toArray()
    const plays = await db.plays.where('gameId').equals(gameId).sortBy('sequenceNumber')

    // Strip IDs for portability
    const { id: _gId, ...gameData } = game
    const lineupData = lineups.map(({ id: _id, ...rest }) => rest)
    const playData = plays.map(({ id: _id, ...rest }) => rest)

    const exported: GameExport = {
      game: gameData,
      lineups: lineupData,
      plays: playData,
    }

    return JSON.stringify(exported)
  }

  static async importGame(json: string): Promise<number> {
    const data: GameExport = JSON.parse(json)

    // Create the game
    const gameId = await db.games.add({
      ...data.game,
      date: new Date(data.game.date),
      createdAt: new Date(data.game.createdAt),
      updatedAt: new Date(data.game.updatedAt),
    })

    // Create lineups
    for (const lineup of data.lineups) {
      await db.lineups.add({ ...lineup, gameId })
    }

    // Create plays
    for (const play of data.plays) {
      await db.plays.add({
        ...play,
        gameId,
        timestamp: new Date(play.timestamp),
      })
    }

    return gameId
  }

  // Future: Replace these with actual Supabase calls
  static async uploadGame(): Promise<string> {
    // Stub: would upload to Supabase and return game code
    throw new Error('Supabase sync not yet configured')
  }

  static async downloadGame(): Promise<number> {
    // Stub: would download from Supabase and import
    throw new Error('Supabase sync not yet configured')
  }
}
