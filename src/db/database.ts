import Dexie from 'dexie'
import type { Table } from 'dexie'
import type { Team, Player, Game, Lineup, Play } from '../engine/types'

export class ScoreKeeperDB extends Dexie {
  teams!: Table<Team>
  players!: Table<Player>
  games!: Table<Game>
  lineups!: Table<Lineup>
  plays!: Table<Play>

  constructor() {
    super('scorekeeper_db')
    this.version(1).stores({
      teams: '++id',
      players: '++id, teamId',
      games: '++id, teamId, code, status',
      lineups: '++id, gameId, [gameId+side]',
      plays: '++id, gameId, sequenceNumber, [gameId+inning+half]',
    })
  }
}

export const db = new ScoreKeeperDB()
