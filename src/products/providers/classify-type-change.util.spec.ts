import { BadRequestException } from '@nestjs/common'
import { FilterableField } from '../entities/product-type.entity'
import { classifyTypeChange } from './classify-type-change.util'

const baseFields: FilterableField[] = [
  { key: 'brand', label: 'Brand', type: 'string' },
  {
    key: 'head',
    label: 'Head',
    type: 'enum',
    options: ['withHead', 'noHead'],
  },
  { key: 'temp', label: 'Temperature', type: 'number', unit: '°C' },
]

// Deep-clones the base fields so a test can mutate its copy without leaking state.
const clone = (): FilterableField[] =>
  baseFields.map((f) => ({
    ...f,
    options: f.options ? [...f.options] : undefined,
  }))

describe('classifyTypeChange', () => {
  it('returns [] when a new field is added', () => {
    const next = [
      ...clone(),
      { key: 'sheath', label: 'Sheath', type: 'string' as const },
    ]
    expect(classifyTypeChange(baseFields, next)).toEqual([])
  })

  it('returns [] when only label/unit change on a kept field', () => {
    const next = clone()
    next[2].label = 'Max Temperature'
    next[2].unit = 'K'
    expect(classifyTypeChange(baseFields, next)).toEqual([])
  })

  it('returns [] when only isFilterable changes on a kept field', () => {
    const next = clone()
    next[2].isFilterable = false
    expect(classifyTypeChange(baseFields, next)).toEqual([])
  })

  it('returns [] when enum options are only added', () => {
    const next = clone()
    next[1].options = ['withHead', 'noHead', 'partialHead']
    expect(classifyTypeChange(baseFields, next)).toEqual([])
  })

  it('returns [] when fields are only reordered', () => {
    const next = [clone()[2], clone()[0], clone()[1]]
    expect(classifyTypeChange(baseFields, next)).toEqual([])
  })

  it('throws BadRequestException when a field type changes', () => {
    const next = clone()
    next[0].type = 'number'
    expect(() => classifyTypeChange(baseFields, next)).toThrow(
      BadRequestException,
    )
  })

  it('flags a removed field for a usage-check', () => {
    const next = clone().filter((f) => f.key !== 'brand')
    expect(classifyTypeChange(baseFields, next)).toEqual([
      { key: 'brand', kind: 'fieldRemoved' },
    ])
  })

  it('flags removed enum options for a usage-check', () => {
    const next = clone()
    next[1].options = ['noHead']
    expect(classifyTypeChange(baseFields, next)).toEqual([
      { key: 'head', kind: 'optionsRemoved', removedOptions: ['withHead'] },
    ])
  })

  it('treats a null old array with additions as fully safe', () => {
    expect(classifyTypeChange(null, baseFields)).toEqual([])
  })

  it('flags every old field when the new array is null or empty', () => {
    expect(classifyTypeChange(baseFields, null)).toEqual([
      { key: 'brand', kind: 'fieldRemoved' },
      { key: 'head', kind: 'fieldRemoved' },
      { key: 'temp', kind: 'fieldRemoved' },
    ])
  })
})
