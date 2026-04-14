import type { PlayType } from './types'

interface ParsedPlay {
  playType: PlayType
  fieldersInvolved: number[]
  basesReached: number[]
  isAtBat: boolean
}

const SIMPLE_PLAYS: Record<string, { playType: PlayType; basesReached: number[]; isAtBat: boolean }> = {
  'K': { playType: 'K', basesReached: [], isAtBat: true },
  'KL': { playType: 'KL', basesReached: [], isAtBat: true },
  'BB': { playType: 'BB', basesReached: [1], isAtBat: true },
  'HBP': { playType: 'HBP', basesReached: [1], isAtBat: true },
  '1B': { playType: '1B', basesReached: [1], isAtBat: true },
  '2B': { playType: '2B', basesReached: [1, 2], isAtBat: true },
  '3B': { playType: '3B', basesReached: [1, 2, 3], isAtBat: true },
  'HR': { playType: 'HR', basesReached: [1, 2, 3, 4], isAtBat: true },
  'SB': { playType: 'SB', basesReached: [], isAtBat: false },
  'CS': { playType: 'CS', basesReached: [], isAtBat: false },
  'WP': { playType: 'WP', basesReached: [], isAtBat: false },
  'PB': { playType: 'PB', basesReached: [], isAtBat: false },
  'BK': { playType: 'BK', basesReached: [], isAtBat: false },
  'FC': { playType: 'FC', basesReached: [1], isAtBat: true },
  'SAC': { playType: 'SAC', basesReached: [], isAtBat: true },
}

export function parseShorthand(input: string): ParsedPlay | null {
  const trimmed = input.trim().toUpperCase()

  if (SIMPLE_PLAYS[trimmed]) {
    const p = SIMPLE_PLAYS[trimmed]
    return { playType: p.playType, fieldersInvolved: [], basesReached: p.basesReached, isAtBat: p.isAtBat }
  }

  // Hit with direction: "1B7", "2B8", "3B9"
  const hitWithDir = trimmed.match(/^([123]B)(\d)$/)
  if (hitWithDir) {
    const base = SIMPLE_PLAYS[hitWithDir[1]]
    return {
      playType: base.playType,
      fieldersInvolved: [parseInt(hitWithDir[2])],
      basesReached: base.basesReached,
      isAtBat: true,
    }
  }

  // Fly/line/pop out: "F8", "L6", "P4"
  const flyMatch = trimmed.match(/^([FLP])(\d)$/)
  if (flyMatch) {
    const typeMap: Record<string, PlayType> = { 'F': 'FO', 'L': 'LO', 'P': 'PO' }
    return {
      playType: typeMap[flyMatch[1]],
      fieldersInvolved: [parseInt(flyMatch[2])],
      basesReached: [],
      isAtBat: true,
    }
  }

  // Fielding sequence: "6-3", "6-4-3"
  const fieldingMatch = trimmed.match(/^(\d)-(\d)(?:-(\d))?$/)
  if (fieldingMatch) {
    const fielders = [parseInt(fieldingMatch[1]), parseInt(fieldingMatch[2])]
    if (fieldingMatch[3]) {
      fielders.push(parseInt(fieldingMatch[3]))
      return { playType: 'DP', fieldersInvolved: fielders, basesReached: [], isAtBat: true }
    }
    return { playType: 'GO', fieldersInvolved: fielders, basesReached: [], isAtBat: true }
  }

  // Error: "E6"
  const errorMatch = trimmed.match(/^E(\d)$/)
  if (errorMatch) {
    return { playType: 'E', fieldersInvolved: [parseInt(errorMatch[1])], basesReached: [1], isAtBat: true }
  }

  return null
}

export function generateNotation(playType: PlayType, fieldersInvolved: number[]): string {
  switch (playType) {
    case 'GO':
    case 'DP':
      return fieldersInvolved.join('-')
    case 'FO':
      return `F${fieldersInvolved[0] ?? ''}`
    case 'LO':
      return `L${fieldersInvolved[0] ?? ''}`
    case 'PO':
      return `P${fieldersInvolved[0] ?? ''}`
    case '1B':
    case '2B':
    case '3B':
      return fieldersInvolved.length > 0 ? `${playType}${fieldersInvolved[0]}` : playType
    case 'E':
      return `E${fieldersInvolved[0] ?? ''}`
    default:
      return playType
  }
}
