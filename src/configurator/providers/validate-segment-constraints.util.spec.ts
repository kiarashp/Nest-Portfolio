import { BadRequestException } from '@nestjs/common'
import { SegmentDataType } from '../enums/segment-data-type.enum'
import { validateSegmentConstraints } from './validate-segment-constraints.util'

describe('validateSegmentConstraints', () => {
  describe('dataType = STRING', () => {
    it('accepts a valid shape and drops nothing', () => {
      const result = validateSegmentConstraints(SegmentDataType.STRING, {
        minLength: 1,
        maxLength: 5,
        pattern: '^[a-z]+$',
      })
      expect(result).toEqual({
        minLength: 1,
        maxLength: 5,
        pattern: '^[a-z]+$',
      })
    })

    it('accepts the optional pattern being omitted', () => {
      const result = validateSegmentConstraints(SegmentDataType.STRING, {
        minLength: 1,
        maxLength: 5,
      })
      expect(result).toEqual({ minLength: 1, maxLength: 5 })
    })

    it('throws when constraints are missing', () => {
      expect(() =>
        validateSegmentConstraints(SegmentDataType.STRING, undefined),
      ).toThrow(BadRequestException)
      expect(() =>
        validateSegmentConstraints(SegmentDataType.STRING, null),
      ).toThrow(BadRequestException)
    })

    it('throws when a required key is missing', () => {
      expect(() =>
        validateSegmentConstraints(SegmentDataType.STRING, { minLength: 1 }),
      ).toThrow(BadRequestException)
    })

    it('throws when an unknown key is present', () => {
      expect(() =>
        validateSegmentConstraints(SegmentDataType.STRING, {
          minLength: 1,
          maxLength: 5,
          digits: 4,
        }),
      ).toThrow(BadRequestException)
    })

    it('throws when a value has the wrong type', () => {
      expect(() =>
        validateSegmentConstraints(SegmentDataType.STRING, {
          minLength: 'one',
          maxLength: 5,
        }),
      ).toThrow(BadRequestException)
    })
  })

  describe('dataType = NUMBER', () => {
    it('accepts a valid shape', () => {
      const result = validateSegmentConstraints(SegmentDataType.NUMBER, {
        digits: 4,
        min: 50,
        max: 2000,
      })
      expect(result).toEqual({ digits: 4, min: 50, max: 2000 })
    })

    it('throws when a required key is missing', () => {
      expect(() =>
        validateSegmentConstraints(SegmentDataType.NUMBER, { digits: 4 }),
      ).toThrow(BadRequestException)
    })

    it('throws when an unknown key is present', () => {
      expect(() =>
        validateSegmentConstraints(SegmentDataType.NUMBER, {
          digits: 4,
          min: 50,
          max: 2000,
          pattern: '^[a-z]+$',
        }),
      ).toThrow(BadRequestException)
    })
  })

  describe('dataType = SELECT', () => {
    it('accepts undefined constraints and returns an empty object', () => {
      expect(
        validateSegmentConstraints(SegmentDataType.SELECT, undefined),
      ).toEqual({})
    })

    it('accepts null constraints and returns an empty object', () => {
      expect(validateSegmentConstraints(SegmentDataType.SELECT, null)).toEqual(
        {},
      )
    })

    it('accepts an empty object', () => {
      expect(validateSegmentConstraints(SegmentDataType.SELECT, {})).toEqual({})
    })

    it('throws when constraints carry any keys', () => {
      expect(() =>
        validateSegmentConstraints(SegmentDataType.SELECT, { minLength: 1 }),
      ).toThrow(BadRequestException)
    })
  })
})
