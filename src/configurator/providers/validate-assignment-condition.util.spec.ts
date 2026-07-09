import { BadRequestException } from '@nestjs/common'
import { validateAssignmentCondition } from './validate-assignment-condition.util'

describe('validateAssignmentCondition', () => {
  describe('comparison operators (eq/neq/gt/lt)', () => {
    it('accepts a valid shape', () => {
      const result = validateAssignmentCondition({
        controllingAssignmentId: 12,
        operator: 'eq',
        value: 'yes',
        effect: 'zero_fill',
      })
      expect(result).toEqual({
        controllingAssignmentId: 12,
        operator: 'eq',
        value: 'yes',
        effect: 'zero_fill',
      })
    })

    it('throws when value is missing', () => {
      expect(() =>
        validateAssignmentCondition({
          controllingAssignmentId: 12,
          operator: 'eq',
          effect: 'zero_fill',
        }),
      ).toThrow(BadRequestException)
    })

    it('throws when an unknown key is present', () => {
      expect(() =>
        validateAssignmentCondition({
          controllingAssignmentId: 12,
          operator: 'eq',
          value: 'yes',
          effect: 'zero_fill',
          min: 1,
        }),
      ).toThrow(BadRequestException)
    })

    it('throws when effect is not zero_fill', () => {
      expect(() =>
        validateAssignmentCondition({
          controllingAssignmentId: 12,
          operator: 'eq',
          value: 'yes',
          effect: 'something_else',
        }),
      ).toThrow(BadRequestException)
    })
  })

  describe('between operator', () => {
    it('accepts a valid shape', () => {
      const result = validateAssignmentCondition({
        controllingAssignmentId: 12,
        operator: 'between',
        min: 30,
        max: 99,
        effect: 'zero_fill',
      })
      expect(result).toEqual({
        controllingAssignmentId: 12,
        operator: 'between',
        min: 30,
        max: 99,
        effect: 'zero_fill',
      })
    })

    it('throws when min >= max', () => {
      expect(() =>
        validateAssignmentCondition({
          controllingAssignmentId: 12,
          operator: 'between',
          min: 99,
          max: 30,
          effect: 'zero_fill',
        }),
      ).toThrow(BadRequestException)
      expect(() =>
        validateAssignmentCondition({
          controllingAssignmentId: 12,
          operator: 'between',
          min: 50,
          max: 50,
          effect: 'zero_fill',
        }),
      ).toThrow(BadRequestException)
    })

    it('throws when a comparison-only key (value) is present', () => {
      expect(() =>
        validateAssignmentCondition({
          controllingAssignmentId: 12,
          operator: 'between',
          min: 30,
          max: 99,
          value: 'x',
          effect: 'zero_fill',
        }),
      ).toThrow(BadRequestException)
    })
  })

  describe('malformed input', () => {
    it('throws when condition is not an object', () => {
      expect(() => validateAssignmentCondition('nope')).toThrow(
        BadRequestException,
      )
    })

    it('throws when operator is missing', () => {
      expect(() =>
        validateAssignmentCondition({ controllingAssignmentId: 12 }),
      ).toThrow(BadRequestException)
    })

    it('throws when operator is unrecognized', () => {
      expect(() =>
        validateAssignmentCondition({
          controllingAssignmentId: 12,
          operator: 'ne',
          value: 'x',
          effect: 'zero_fill',
        }),
      ).toThrow(BadRequestException)
    })
  })
})
