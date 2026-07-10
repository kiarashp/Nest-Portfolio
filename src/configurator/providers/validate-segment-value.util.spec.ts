import { validateSegmentValue } from './validate-segment-value.util'
import { SegmentDataType } from '../enums/segment-data-type.enum'
import { SegmentDefinition } from '../entities/segment-definition.entity'
import { SegmentOption } from '../entities/segment-option.entity'

// Minimal definition stubs — validateSegmentValue only reads label, dataType,
// constraints, and options.
const stringDef = (pattern?: string) => ({
  label: 'Marker',
  dataType: SegmentDataType.STRING,
  constraints: { minLength: 2, maxLength: 5, pattern },
  options: undefined,
})

const numberDef = {
  label: 'Insertion length (mm)',
  dataType: SegmentDataType.NUMBER,
  constraints: { digits: 4, min: 50, max: 2000 },
  options: undefined,
}

const selectDef: Pick<
  SegmentDefinition,
  'label' | 'dataType' | 'constraints' | 'options'
> = {
  label: 'Sensor type',
  dataType: SegmentDataType.SELECT,
  constraints: {},
  options: [
    { value: '1m', label: 'single Pt100' },
    { value: '2d', label: 'double Pt500' },
  ] as SegmentOption[],
}

describe('validateSegmentValue', () => {
  describe('dataType = STRING', () => {
    it('accepts a value within the length bounds', () => {
      expect(validateSegmentValue(stringDef(), 'abc')).toEqual({
        ok: true,
        value: 'abc',
      })
    })

    it('rejects the reserved value "0"', () => {
      const shortZeroDef = {
        ...stringDef(),
        constraints: { minLength: 1, maxLength: 5 },
      }
      const result = validateSegmentValue(shortZeroDef, '0')
      expect(result.ok).toBe(false)
      expect(!result.ok && result.message).toContain('reserved')
    })

    it('rejects values outside the length bounds', () => {
      expect(validateSegmentValue(stringDef(), 'a').ok).toBe(false)
      expect(validateSegmentValue(stringDef(), 'abcdef').ok).toBe(false)
    })

    it('rejects values that do not match the pattern when one is set', () => {
      expect(validateSegmentValue(stringDef('^[a-z]+$'), 'ab1').ok).toBe(false)
      expect(validateSegmentValue(stringDef('^[a-z]+$'), 'abc').ok).toBe(true)
    })
  })

  describe('dataType = NUMBER', () => {
    it('normalizes "50" to the padded "0050"', () => {
      expect(validateSegmentValue(numberDef, '50')).toEqual({
        ok: true,
        value: '0050',
      })
    })

    it('accepts an already-padded value', () => {
      expect(validateSegmentValue(numberDef, '0050')).toEqual({
        ok: true,
        value: '0050',
      })
    })

    it('rejects non-numeric values', () => {
      expect(validateSegmentValue(numberDef, 'abc').ok).toBe(false)
      expect(validateSegmentValue(numberDef, '4.5').ok).toBe(false)
      expect(validateSegmentValue(numberDef, '-5').ok).toBe(false)
    })

    it('rejects values that do not fit in the digits width', () => {
      const wide = {
        ...numberDef,
        constraints: { digits: 4, min: 50, max: 99999 },
      }
      expect(validateSegmentValue(wide, '20000').ok).toBe(false)
    })

    it('enforces min and max numerically, boundaries included', () => {
      expect(validateSegmentValue(numberDef, '49').ok).toBe(false)
      expect(validateSegmentValue(numberDef, '2001').ok).toBe(false)
      expect(validateSegmentValue(numberDef, '50').ok).toBe(true)
      expect(validateSegmentValue(numberDef, '2000').ok).toBe(true)
    })
  })

  describe('dataType = SELECT', () => {
    it('accepts a value matching one of the options', () => {
      expect(validateSegmentValue(selectDef, '2d')).toEqual({
        ok: true,
        value: '2d',
      })
    })

    it('rejects a value that matches no option', () => {
      const result = validateSegmentValue(selectDef, 'xx')
      expect(result.ok).toBe(false)
      expect(!result.ok && result.message).toContain('not a valid option')
    })

    it('matches case-sensitively', () => {
      expect(validateSegmentValue(selectDef, '2D').ok).toBe(false)
    })
  })
})
