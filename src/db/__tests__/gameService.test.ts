import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { db } from '../database'
import {
  createTeam,
  getTeam,
  getAllTeams,
  addPlayer,
  getPlayersForTeam,
  deletePlayer,
  createGame,
  getGame,
  getGamesForTeam,
  updateGameStatus,
  deleteGame,
  saveLineup,
  getLineupsForGame,
  addPlay,
  getPlaysForGame,
  deleteLastPlay,
  updatePlay,
} from '../gameService'

describe('gameService', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  afterEach(async () => {
    await db.close()
  })

  describe('teams', () => {
    it('should create and retrieve a team', async () => {
      const team = await createTeam('Mudcats')
      expect(team.name).toBe('Mudcats')
      expect(team.id).toBeDefined()

      const fetched = await getTeam(team.id!)
      expect(fetched?.name).toBe('Mudcats')
    })

    it('should list all teams', async () => {
      await createTeam('Mudcats')
      await createTeam('Tigers')

      const teams = await getAllTeams()
      expect(teams).toHaveLength(2)
    })
  })

  describe('players', () => {
    it('should add players and retrieve by team', async () => {
      const team = await createTeam('Mudcats')
      await addPlayer(team.id!, 'John Doe', 23, 'SS')
      await addPlayer(team.id!, 'Jane Smith', 7, 'P')

      const players = await getPlayersForTeam(team.id!)
      expect(players).toHaveLength(2)
      expect(players[0].name).toBe('John Doe')
    })

    it('should delete a player', async () => {
      const team = await createTeam('Mudcats')
      const player = await addPlayer(team.id!, 'John Doe', 23, 'SS')
      await deletePlayer(player.id!)

      const players = await getPlayersForTeam(team.id!)
      expect(players).toHaveLength(0)
    })
  })

  describe('games', () => {
    it('should create a game with auto-generated code', async () => {
      const team = await createTeam('Mudcats')
      const game = await createGame(team.id!, 'Tigers', 'home')
      expect(game.code).toHaveLength(6)
      expect(game.status).toBe('in_progress')
      expect(game.opponentName).toBe('Tigers')
    })

    it('should retrieve a game by id', async () => {
      const team = await createTeam('Mudcats')
      const game = await createGame(team.id!, 'Tigers', 'home')

      const fetched = await getGame(game.id!)
      expect(fetched?.opponentName).toBe('Tigers')
      expect(fetched?.homeOrAway).toBe('home')
    })

    it('should list games for a team', async () => {
      const team = await createTeam('Mudcats')
      await createGame(team.id!, 'Tigers', 'home')
      await createGame(team.id!, 'Bears', 'away')

      const games = await getGamesForTeam(team.id!)
      expect(games).toHaveLength(2)
    })

    it('should update game status', async () => {
      const team = await createTeam('Mudcats')
      const game = await createGame(team.id!, 'Tigers', 'home')
      expect(game.status).toBe('in_progress')

      await updateGameStatus(game.id!, 'completed')
      const updated = await getGame(game.id!)
      expect(updated?.status).toBe('completed')
    })

    it('should soft-delete a game (status = deleted, record still exists)', async () => {
      const team = await createTeam('Mudcats')
      const game = await createGame(team.id!, 'Tigers', 'home')

      await deleteGame(game.id!)

      const fetched = await getGame(game.id!)
      expect(fetched?.status).toBe('deleted')
    })

    it('should exclude deleted games from getGamesForTeam', async () => {
      const team = await createTeam('Mudcats')
      await createGame(team.id!, 'Tigers', 'home')        // visible
      const gone = await createGame(team.id!, 'Bears', 'away')  // will be deleted
      await deleteGame(gone.id!)

      const games = await getGamesForTeam(team.id!)
      expect(games).toHaveLength(1)
      expect(games[0].opponentName).toBe('Tigers')
    })
  })

  describe('lineups', () => {
    it('should save and retrieve lineups for a game', async () => {
      const team = await createTeam('Mudcats')
      const game = await createGame(team.id!, 'Tigers', 'home')

      await saveLineup(game.id!, 'us', [
        { orderPosition: 1, playerId: 1, playerName: 'John', jerseyNumber: 23, position: 'SS', substitutions: [] },
      ])

      const lineups = await getLineupsForGame(game.id!)
      expect(lineups).toHaveLength(1)
      expect(lineups[0].side).toBe('us')
      expect(lineups[0].battingOrder).toHaveLength(1)
    })
  })

  describe('plays', () => {
    it('should add plays with auto-incrementing sequence numbers', async () => {
      const team = await createTeam('Mudcats')
      const game = await createGame(team.id!, 'Tigers', 'home')

      const play1 = await addPlay(game.id!, {
        inning: 1,
        half: 'top',
        batterOrderPosition: 1,
        playType: 'K',
        notation: 'K',
        fieldersInvolved: [],
        basesReached: [],
        runsScoredOnPlay: 0,
        rbis: 0,
        pitches: ['S', 'S', 'S'],
        isAtBat: true,
      })
      expect(play1.sequenceNumber).toBe(1)

      const play2 = await addPlay(game.id!, {
        inning: 1,
        half: 'top',
        batterOrderPosition: 2,
        playType: '1B',
        notation: '1B',
        fieldersInvolved: [],
        basesReached: [1],
        runsScoredOnPlay: 0,
        rbis: 0,
        pitches: ['B', 'S', 'F', 'B'],
        isAtBat: true,
      })
      expect(play2.sequenceNumber).toBe(2)

      const plays = await getPlaysForGame(game.id!)
      expect(plays).toHaveLength(2)
    })

    it('should delete the last play (undo)', async () => {
      const team = await createTeam('Mudcats')
      const game = await createGame(team.id!, 'Tigers', 'home')

      await addPlay(game.id!, {
        inning: 1, half: 'top', batterOrderPosition: 1, playType: 'K',
        notation: 'K', fieldersInvolved: [], basesReached: [],
        runsScoredOnPlay: 0, rbis: 0, pitches: [], isAtBat: true,
      })
      await addPlay(game.id!, {
        inning: 1, half: 'top', batterOrderPosition: 2, playType: '1B',
        notation: '1B', fieldersInvolved: [], basesReached: [1],
        runsScoredOnPlay: 0, rbis: 0, pitches: [], isAtBat: true,
      })

      await deleteLastPlay(game.id!)
      const plays = await getPlaysForGame(game.id!)
      expect(plays).toHaveLength(1)
      expect(plays[0].playType).toBe('K')
    })

    it('should handle deleteLastPlay on a game with no plays', async () => {
      const team = await createTeam('Mudcats')
      const game = await createGame(team.id!, 'Tigers', 'home')
      await deleteLastPlay(game.id!)
      const plays = await getPlaysForGame(game.id!)
      expect(plays).toHaveLength(0)
    })

    it('should update an existing play (edit)', async () => {
      const team = await createTeam('Mudcats')
      const game = await createGame(team.id!, 'Tigers', 'home')

      const play = await addPlay(game.id!, {
        inning: 1, half: 'top', batterOrderPosition: 1, playType: 'K',
        notation: 'K', fieldersInvolved: [], basesReached: [],
        runsScoredOnPlay: 0, rbis: 0, pitches: [], isAtBat: true,
      })

      await updatePlay(play.id!, { playType: '1B', notation: '1B', basesReached: [1] })
      const updated = await db.plays.get(play.id!)
      expect(updated?.playType).toBe('1B')
      expect(updated?.notation).toBe('1B')
    })
  })
})
