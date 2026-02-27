import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { GameProvider, useGame } from '../GameContext'
import { db } from '../../db/database'
import { createTeam, addPlayer, createGame, saveLineup } from '../../db/gameService'

function wrapper({ children }: { children: ReactNode }) {
  return <GameProvider>{children}</GameProvider>
}

describe('GameContext', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  afterEach(async () => {
    await db.close()
  })

  it('should start with null game state', () => {
    const { result } = renderHook(() => useGame(), { wrapper })
    expect(result.current.game).toBeNull()
    expect(result.current.snapshot).toBeNull()
  })

  it('should load a game and compute snapshot', async () => {
    // Set up test data
    const team = await createTeam('Mudcats')
    await addPlayer(team.id!, 'Player 1', 1, 'P')
    const game = await createGame(team.id!, 'Tigers', 'home')
    await saveLineup(game.id!, 'us', [
      { orderPosition: 1, playerId: 1, playerName: 'Player 1', jerseyNumber: 1, position: 'P', substitutions: [] },
    ])
    await saveLineup(game.id!, 'them', [
      { orderPosition: 1, playerId: null, playerName: 'Opp 1', jerseyNumber: 10, position: 'P', substitutions: [] },
    ])

    const { result } = renderHook(() => useGame(), { wrapper })

    await act(async () => {
      await result.current.loadGame(game.id!)
    })

    expect(result.current.game).not.toBeNull()
    expect(result.current.game?.id).toBe(game.id)
    expect(result.current.snapshot).not.toBeNull()
    expect(result.current.snapshot?.inning).toBe(1)
    expect(result.current.snapshot?.half).toBe('top')
  })

  it('should record a play and update snapshot', async () => {
    const team = await createTeam('Mudcats')
    const game = await createGame(team.id!, 'Tigers', 'away')
    await saveLineup(game.id!, 'us', [
      { orderPosition: 1, playerId: 1, playerName: 'P1', jerseyNumber: 1, position: 'P', substitutions: [] },
      { orderPosition: 2, playerId: 2, playerName: 'P2', jerseyNumber: 2, position: 'C', substitutions: [] },
    ])
    await saveLineup(game.id!, 'them', [
      { orderPosition: 1, playerId: null, playerName: 'O1', jerseyNumber: 10, position: 'P', substitutions: [] },
    ])

    const { result } = renderHook(() => useGame(), { wrapper })

    await act(async () => {
      await result.current.loadGame(game.id!)
    })

    await act(async () => {
      await result.current.recordPlay({
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
    })

    expect(result.current.snapshot?.outs).toBe(1)
    expect(result.current.snapshot?.currentBatterUs).toBe(2)
    expect(result.current.plays).toHaveLength(1)
  })

  it('should undo the last play', async () => {
    const team = await createTeam('Mudcats')
    const game = await createGame(team.id!, 'Tigers', 'away')
    await saveLineup(game.id!, 'us', [
      { orderPosition: 1, playerId: 1, playerName: 'P1', jerseyNumber: 1, position: 'P', substitutions: [] },
    ])
    await saveLineup(game.id!, 'them', [
      { orderPosition: 1, playerId: null, playerName: 'O1', jerseyNumber: 10, position: 'P', substitutions: [] },
    ])

    const { result } = renderHook(() => useGame(), { wrapper })

    await act(async () => {
      await result.current.loadGame(game.id!)
    })

    await act(async () => {
      await result.current.recordPlay({
        inning: 1, half: 'top', batterOrderPosition: 1, playType: 'K',
        notation: 'K', fieldersInvolved: [], basesReached: [],
        runsScoredOnPlay: 0, rbis: 0, pitches: [], isAtBat: true,
      })
    })

    expect(result.current.snapshot?.outs).toBe(1)

    await act(async () => {
      await result.current.undoLastPlay()
    })

    expect(result.current.snapshot?.outs).toBe(0)
    expect(result.current.plays).toHaveLength(0)
  })

  it('should undo from a specific play (undoFromPlay)', async () => {
    const team = await createTeam('Mudcats')
    const game = await createGame(team.id!, 'Tigers', 'away')
    await saveLineup(game.id!, 'us', [
      { orderPosition: 1, playerId: 1, playerName: 'P1', jerseyNumber: 1, position: 'P', substitutions: [] },
      { orderPosition: 2, playerId: 2, playerName: 'P2', jerseyNumber: 2, position: 'C', substitutions: [] },
      { orderPosition: 3, playerId: 3, playerName: 'P3', jerseyNumber: 3, position: '1B', substitutions: [] },
      { orderPosition: 4, playerId: 4, playerName: 'P4', jerseyNumber: 4, position: '2B', substitutions: [] },
    ])
    await saveLineup(game.id!, 'them', [
      { orderPosition: 1, playerId: null, playerName: 'O1', jerseyNumber: 10, position: 'P', substitutions: [] },
    ])

    const { result } = renderHook(() => useGame(), { wrapper })

    await act(async () => {
      await result.current.loadGame(game.id!)
    })

    // Record 3 plays: K (out), 1B (hit), K (out)
    await act(async () => {
      await result.current.recordPlay({
        inning: 1, half: 'top', batterOrderPosition: 1,
        playType: 'K', notation: 'K',
        fieldersInvolved: [], basesReached: [],
        runsScoredOnPlay: 0, rbis: 0,
        pitches: ['S', 'S', 'S'], isAtBat: true,
      })
    })
    await act(async () => {
      await result.current.recordPlay({
        inning: 1, half: 'top', batterOrderPosition: 2,
        playType: '1B', notation: '1B',
        fieldersInvolved: [], basesReached: [1],
        runsScoredOnPlay: 0, rbis: 0,
        pitches: ['B', 'S', 'F', 'B'], isAtBat: true,
      })
    })
    await act(async () => {
      await result.current.recordPlay({
        inning: 1, half: 'top', batterOrderPosition: 3,
        playType: 'K', notation: 'K',
        fieldersInvolved: [], basesReached: [],
        runsScoredOnPlay: 0, rbis: 0,
        pitches: ['S', 'S', 'S'], isAtBat: true,
      })
    })

    expect(result.current.plays).toHaveLength(3)
    expect(result.current.snapshot?.outs).toBe(2)

    // Undo from play 2 (should delete play 2 and play 3, leaving only play 1)
    const play2Id = result.current.plays[1].id!

    await act(async () => {
      await result.current.undoFromPlay(play2Id)
    })

    expect(result.current.plays).toHaveLength(1)
    expect(result.current.plays[0].batterOrderPosition).toBe(1)
    expect(result.current.snapshot?.outs).toBe(1)
    expect(result.current.snapshot?.currentBatterUs).toBe(2)
  })
})
