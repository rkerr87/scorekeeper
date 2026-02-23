import { describe, it, expect } from 'vitest'
import { parseShorthand, generateNotation } from '../notation'

describe('parseShorthand', () => {
  it('should parse strikeout', () => {
    const result = parseShorthand('K')
    expect(result.playType).toBe('K')
    expect(result.fieldersInvolved).toEqual([])
  })

  it('should parse single', () => {
    expect(parseShorthand('1B').playType).toBe('1B')
  })

  it('should parse single with direction', () => {
    const result = parseShorthand('1B7')
    expect(result.playType).toBe('1B')
    expect(result.fieldersInvolved).toEqual([7])
  })

  it('should parse ground out', () => {
    const result = parseShorthand('6-3')
    expect(result.playType).toBe('GO')
    expect(result.fieldersInvolved).toEqual([6, 3])
  })

  it('should parse double play', () => {
    const result = parseShorthand('6-4-3')
    expect(result.playType).toBe('DP')
    expect(result.fieldersInvolved).toEqual([6, 4, 3])
  })

  it('should parse fly out', () => {
    const result = parseShorthand('F8')
    expect(result.playType).toBe('FO')
    expect(result.fieldersInvolved).toEqual([8])
  })

  it('should parse walk', () => {
    expect(parseShorthand('BB').playType).toBe('BB')
  })

  it('should parse home run', () => {
    expect(parseShorthand('HR').playType).toBe('HR')
  })
})

describe('generateNotation', () => {
  it('should generate ground out notation', () => {
    expect(generateNotation('GO', [6, 3])).toBe('6-3')
  })

  it('should generate fly out notation', () => {
    expect(generateNotation('FO', [8])).toBe('F8')
  })

  it('should generate single with direction', () => {
    expect(generateNotation('1B', [7])).toBe('1B7')
  })

  it('should generate simple plays', () => {
    expect(generateNotation('K', [])).toBe('K')
    expect(generateNotation('BB', [])).toBe('BB')
    expect(generateNotation('HR', [])).toBe('HR')
  })
})
