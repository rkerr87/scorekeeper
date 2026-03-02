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
  getAllGames,
  updateGameStatus,
  deleteGame,
  saveLineup,
  getLineupsForGame,
  addPlay,
  getPlaysForGame,
  deleteLastPlay,
  deletePlayAndSubsequent,
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
      const team1 = await createTeam('Mudcats')
      const team2 = await createTeam('Tigers')
      const game = await createGame(team1.id!, team2.id!, team1.id!)
      expect(game.code).toHaveLength(6)
      expect(game.status).toBe('in_progress')
      expect(game.team1Id).toBe(team1.id)
      expect(game.team2Id).toBe(team2.id)
      expect(game.homeTeamId).toBe(team1.id)
    })

    it('should retrieve a game by id', async () => {
      const team1 = await createTeam('Mudcats')
      const team2 = await createTeam('Tigers')
      const game = await createGame(team1.id!, team2.id!, team1.id!)

      const fetched = await getGame(game.id!)
      expect(fetched?.team1Id).toBe(team1.id)
      expect(fetched?.team2Id).toBe(team2.id)
      expect(fetched?.homeTeamId).toBe(team1.id)
    })

    it('should list games for a team as team1', async () => {
      const team1 = await createTeam('Mudcats')
      const team2 = await createTeam('Tigers')
      const team3 = await createTeam('Bears')
      await createGame(team1.id!, team2.id!, team1.id!)
      await createGame(team1.id!, team3.id!, team3.id!)

      const games = await getGamesForTeam(team1.id!)
      expect(games).toHaveLength(2)
    })

    it('should list games for a team as team2', async () => {
      const team1 = await createTeam('Mudcats')
      const team2 = await createTeam('Tigers')
      await createGame(team1.id!, team2.id!, team1.id!)

      const games = await getGamesForTeam(team2.id!)
      expect(games).toHaveLength(1)
    })

    it('should not duplicate games when team is both team1 and team2 query match', async () => {
      const team1 = await createTeam('Mudcats')
      const team2 = await createTeam('Tigers')
      await createGame(team1.id!, team2.id!, team1.id!)

      // team1 appears only as team1, so no duplication risk here
      // but the dedup logic should handle it regardless
      const games = await getGamesForTeam(team1.id!)
      expect(games).toHaveLength(1)
    })

    it('should update game status', async () => {
      const team1 = await createTeam('Mudcats')
      const team2 = await createTeam('Tigers')
      const game = await createGame(team1.id!, team2.id!, team1.id!)
      expect(game.status).toBe('in_progress')

      await updateGameStatus(game.id!, 'completed')
      const updated = await getGame(game.id!)
      expect(updated?.status).toBe('completed')
    })

    it('should soft-delete a game (status = deleted, record still exists)', async () => {
      const team1 = await createTeam('Mudcats')
      const team2 = await createTeam('Tigers')
      const game = await createGame(team1.id!, team2.id!, team1.id!)

      await deleteGame(game.id!)

      const fetched = await getGame(game.id!)
      expect(fetched?.status).toBe('deleted')
    })

    it('should exclude deleted games from getGamesForTeam', async () => {
      const team1 = await createTeam('Mudcats')
      const team2 = await createTeam('Tigers')
      const team3 = await createTeam('Bears')
      await createGame(team1.id!, team2.id!, team1.id!)          // visible
      const gone = await createGame(team1.id!, team3.id!, team1.id!)  // will be deleted
      await deleteGame(gone.id!)

      const games = await getGamesForTeam(team1.id!)
      expect(games).toHaveLength(1)
      expect(games[0].team2Id).toBe(team2.id)
    })

    it('should return all non-deleted games with getAllGames', async () => {
      const team1 = await createTeam('Mudcats')
      const team2 = await createTeam('Tigers')
      const team3 = await createTeam('Bears')
      await createGame(team1.id!, team2.id!, team1.id!)
      await createGame(team1.id!, team3.id!, team3.id!)
      const gone = await createGame(team2.id!, team3.id!, team2.id!)
      await deleteGame(gone.id!)

      const games = await getAllGames()
      expect(games).toHaveLength(2)
    })
  })

  describe('lineups', () => {
    it('should save and retrieve lineups for a game', async () => {
      const team1 = await createTeam('Mudcats')
      const team2 = await createTeam('Tigers')
      const game = await createGame(team1.id!, team2.id!, team1.id!)

      await saveLineup(game.id!, 'home', [
        { orderPosition: 1, playerId: 101, playerName: 'John', jerseyNumber: 23, position: 'SS', substitutions: [] },
      ])

      const lineups = await getLineupsForGame(game.id!)
      expect(lineups).toHaveLength(1)
      expect(lineups[0].side).toBe('home')
      expect(lineups[0].battingOrder).toHaveLength(1)
    })
  })

  describe('plays', () => {
    it('should add plays with auto-incrementing sequence numbers', async () => {
      const team1 = await createTeam('Mudcats')
      const team2 = await createTeam('Tigers')
      const game = await createGame(team1.id!, team2.id!, team1.id!)

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
      const team1 = await createTeam('Mudcats')
      const team2 = await createTeam('Tigers')
      const game = await createGame(team1.id!, team2.id!, team1.id!)

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
      const team1 = await createTeam('Mudcats')
      const team2 = await createTeam('Tigers')
      const game = await createGame(team1.id!, team2.id!, team1.id!)
      await deleteLastPlay(game.id!)
      const plays = await getPlaysForGame(game.id!)
      expect(plays).toHaveLength(0)
    })

    it('should update an existing play (edit)', async () => {
      const team1 = await createTeam('Mudcats')
      const team2 = await createTeam('Tigers')
      const game = await createGame(team1.id!, team2.id!, team1.id!)

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

    it('should delete target play and all subsequent plays, preserving earlier plays', async () => {
      const team1 = await createTeam('Mudcats')
      const team2 = await createTeam('Tigers')
      const game = await createGame(team1.id!, team2.id!, team1.id!)

      const play1 = await addPlay(game.id!, {
        inning: 1, half: 'top', batterOrderPosition: 1, playType: 'K',
        notation: 'K', fieldersInvolved: [], basesReached: [],
        runsScoredOnPlay: 0, rbis: 0, pitches: [], isAtBat: true,
      })
      const play2 = await addPlay(game.id!, {
        inning: 1, half: 'top', batterOrderPosition: 2, playType: '1B',
        notation: '1B', fieldersInvolved: [], basesReached: [1],
        runsScoredOnPlay: 0, rbis: 0, pitches: [], isAtBat: true,
      })
      await addPlay(game.id!, {
        inning: 1, half: 'top', batterOrderPosition: 3, playType: 'BB',
        notation: 'BB', fieldersInvolved: [], basesReached: [1],
        runsScoredOnPlay: 0, rbis: 0, pitches: [], isAtBat: true,
      })

      // Delete from play2 onward
      await deletePlayAndSubsequent(game.id!, play2.id!)

      const remaining = await getPlaysForGame(game.id!)
      expect(remaining).toHaveLength(1)
      expect(remaining[0].id).toBe(play1.id)
      expect(remaining[0].playType).toBe('K')
    })

    it('should handle non-existent playId gracefully', async () => {
      const team1 = await createTeam('Mudcats')
      const team2 = await createTeam('Tigers')
      const game = await createGame(team1.id!, team2.id!, team1.id!)

      await addPlay(game.id!, {
        inning: 1, half: 'top', batterOrderPosition: 1, playType: 'K',
        notation: 'K', fieldersInvolved: [], basesReached: [],
        runsScoredOnPlay: 0, rbis: 0, pitches: [], isAtBat: true,
      })

      // Should not throw and should not delete any plays
      await deletePlayAndSubsequent(game.id!, 99999)

      const plays = await getPlaysForGame(game.id!)
      expect(plays).toHaveLength(1)
    })
  })
})
