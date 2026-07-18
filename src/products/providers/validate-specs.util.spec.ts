import { BadRequestException } from '@nestjs/common'
import { FilterableField } from '../entities/product-type.entity'
import {
  findFilterableField,
  findQueryableField,
  validateSpecsAgainstType,
} from './validate-specs.util'

const fields: FilterableField[] = [
  { key: 'tempRange', label: 'Temperature Range', type: 'number', unit: '°C' },
  {
    key: 'sheathMaterial',
    label: 'Sheath Material',
    type: 'enum',
    options: ['Inconel 600', 'Stainless 316'],
  },
  { key: 'note', label: 'Note', type: 'string' },
]

describe('findFilterableField', () => {
  it('returns the field when the key is declared', () => {
    expect(findFilterableField(fields, 'tempRange').type).toBe('number')
  })

  it('throws BadRequestException for an undeclared key', () => {
    expect(() => findFilterableField(fields, 'ghost')).toThrow(
      BadRequestException,
    )
  })

  it('throws when filterableFields is null', () => {
    expect(() => findFilterableField(null, 'tempRange')).toThrow(
      BadRequestException,
    )
  })
})

describe('findQueryableField', () => {
  it('returns the field when isFilterable is true', () => {
    const withFlag: FilterableField[] = [
      {
        key: 'tempRange',
        label: 'Temperature Range',
        type: 'number',
        isFilterable: true,
      },
    ]
    expect(findQueryableField(withFlag, 'tempRange').key).toBe('tempRange')
  })

  it('returns the field when isFilterable is omitted (defaults to filterable)', () => {
    expect(findQueryableField(fields, 'tempRange').key).toBe('tempRange')
  })

  it('throws BadRequestException when isFilterable is false', () => {
    const nonFilterable: FilterableField[] = [
      { key: 'note', label: 'Note', type: 'string', isFilterable: false },
    ]
    expect(() => findQueryableField(nonFilterable, 'note')).toThrow(
      BadRequestException,
    )
  })

  it('throws BadRequestException for an undeclared key, same as findFilterableField', () => {
    expect(() => findQueryableField(fields, 'ghost')).toThrow(
      BadRequestException,
    )
  })
})

describe('validateSpecsAgainstType', () => {
  it('passes when every spec matches its field type', () => {
    expect(() =>
      validateSpecsAgainstType(
        { tempRange: 1260, sheathMaterial: 'Inconel 600', note: 'ok' },
        fields,
      ),
    ).not.toThrow()
  })

  it('is a no-op when specs is null or undefined', () => {
    expect(() => validateSpecsAgainstType(null, fields)).not.toThrow()
    expect(() => validateSpecsAgainstType(undefined, fields)).not.toThrow()
  })

  it('rejects an undeclared spec key', () => {
    expect(() => validateSpecsAgainstType({ unknown: 1 }, fields)).toThrow(
      BadRequestException,
    )
  })

  it('rejects a number field given a non-number value', () => {
    expect(() =>
      validateSpecsAgainstType({ tempRange: '1260' }, fields),
    ).toThrow(BadRequestException)
  })

  it('rejects an enum value not in options', () => {
    expect(() =>
      validateSpecsAgainstType({ sheathMaterial: 'Unobtanium' }, fields),
    ).toThrow(BadRequestException)
  })

  it('rejects a string field given a non-string value', () => {
    expect(() => validateSpecsAgainstType({ note: 42 }, fields)).toThrow(
      BadRequestException,
    )
  })
})
