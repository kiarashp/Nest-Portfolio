import { BadRequestException } from '@nestjs/common'
import { parseSelections } from './parse-selections.util'

describe('parseSelections', () => {
  it('parses a valid map into integer-keyed entries', () => {
    const result = parseSelections({ '11': '2d', '12': 'yes' })
    expect(result.get(11)).toBe('2d')
    expect(result.get(12)).toBe('yes')
    expect(result.size).toBe(2)
  })

  it('returns an empty map for an empty object', () => {
    expect(parseSelections({}).size).toBe(0)
  })

  it('throws when a key is not a plain integer literal', () => {
    expect(() => parseSelections({ abc: '1' })).toThrow(BadRequestException)
    expect(() => parseSelections({ '1.5': '1' })).toThrow(BadRequestException)
    expect(() => parseSelections({ '-1': '1' })).toThrow(BadRequestException)
  })

  it('throws when a value is not a string', () => {
    expect(() => parseSelections({ '11': 5 })).toThrow(BadRequestException)
    expect(() => parseSelections({ '11': null })).toThrow(BadRequestException)
    expect(() => parseSelections({ '11': { nested: true } })).toThrow(
      BadRequestException,
    )
  })
})
