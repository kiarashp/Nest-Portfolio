import { BadRequestException } from '@nestjs/common'
import { ConfiguratorResolverService } from './configurator-resolver.service'
import { ConfigurableProduct } from '../entities/configurable-product.entity'
import { ProductSegmentAssignment } from '../entities/product-segment-assignment.entity'
import { SegmentDataType } from '../enums/segment-data-type.enum'

// In-memory build of the CONFIGURATOR.md §6 worked example ("Resistive
// sensor with cap", prefix FRH): pos 1 sensor type (SELECT), pos 2 has
// extension (SELECT), pos 3 extension length (NUMBER, active if pos 2 eq
// "yes"), pos 4 extension diameter (NUMBER, active if pos 3 between 30..99),
// pos 5 insertion length (NUMBER, unconditional). Assignment ids are 11-15.
const makeProduct = (): ConfigurableProduct =>
  ({
    id: 1,
    name: 'Resistive sensor with cap',
    codePrefix: 'FRH',
    separator: '-',
    assignments: [
      {
        id: 11,
        position: 1,
        condition: null,
        definition: {
          label: 'Sensor type',
          dataType: SegmentDataType.SELECT,
          constraints: {},
          meaningTemplate: 'Sensor: {label}',
          options: [
            { value: '1m', label: 'single Pt100', sortOrder: 0 },
            { value: '2m', label: 'double Pt100', sortOrder: 1 },
            { value: '1d', label: 'Pt500', sortOrder: 2 },
            { value: '2d', label: 'double Pt500', sortOrder: 3 },
          ],
        },
      },
      {
        id: 12,
        position: 2,
        condition: null,
        definition: {
          label: 'Has extension?',
          dataType: SegmentDataType.SELECT,
          constraints: {},
          meaningTemplate: 'Extension: {label}',
          options: [
            { value: 'yes', label: 'with extension', sortOrder: 0 },
            { value: 'no', label: 'without extension', sortOrder: 1 },
          ],
        },
      },
      {
        id: 13,
        position: 3,
        condition: {
          controllingAssignmentId: 12,
          operator: 'eq',
          value: 'yes',
          effect: 'zero_fill',
        },
        definition: {
          label: 'Extension length (cm)',
          dataType: SegmentDataType.NUMBER,
          constraints: { digits: 2, min: 10, max: 99 },
          meaningTemplate: 'Extension length: {value} cm',
          options: [],
        },
      },
      {
        id: 14,
        position: 4,
        condition: {
          controllingAssignmentId: 13,
          operator: 'between',
          min: 30,
          max: 99,
          effect: 'zero_fill',
        },
        definition: {
          label: 'Extension diameter (mm)',
          dataType: SegmentDataType.NUMBER,
          constraints: { digits: 3, min: 100, max: 800 },
          meaningTemplate: 'Extension diameter: {value} mm',
          options: [],
        },
      },
      {
        id: 15,
        position: 5,
        condition: null,
        definition: {
          label: 'Insertion length (mm)',
          dataType: SegmentDataType.NUMBER,
          constraints: { digits: 4, min: 50, max: 2000 },
          meaningTemplate: 'Insertion length: {value} mm',
          options: [],
        },
      },
    ] as unknown as ProductSegmentAssignment[],
  }) as ConfigurableProduct

describe('ConfiguratorResolverService', () => {
  const service = new ConfiguratorResolverService()

  it('resolves the full happy path with every segment active', () => {
    const result = service.resolve(makeProduct(), {
      '11': '2d',
      '12': 'yes',
      '13': '45',
      '14': '300',
      '15': '450',
    })
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.code).toBe('FRH-2d-yes-45-300-0450')
    expect(result.summary).toEqual([
      'Sensor: double Pt500',
      'Extension: with extension',
      'Extension length: 45 cm',
      'Extension diameter: 300 mm',
      'Insertion length: 0450 mm',
    ])
    expect(result.segments).toHaveLength(5)
    expect(result.segments.every((segment) => segment.active)).toBe(true)
  })

  it('cascades zero-fill down the chain when the controller is "no"', () => {
    const result = service.resolve(makeProduct(), {
      '11': '2d',
      '12': 'no',
      '15': '450',
    })
    expect(result.valid).toBe(true)
    // Pos 3 zero-fills (condition not met); pos 4 cascades because its
    // controller (pos 3) is itself zero-filled.
    expect(result.code).toBe('FRH-2d-no-00-000-0450')
    expect(result.summary).toEqual([
      'Sensor: double Pt500',
      'Extension: without extension',
      'Insertion length: 0450 mm',
    ])
    expect(result.segments[2]).toMatchObject({ active: false, value: '00' })
    expect(result.segments[3]).toMatchObject({ active: false, value: '000' })
  })

  it('zero-fills a dependent when the between condition is not met and ignores its supplied value', () => {
    const result = service.resolve(makeProduct(), {
      '11': '2d',
      '12': 'yes',
      '13': '15',
      '14': '300',
      '15': '450',
    })
    expect(result.valid).toBe(true)
    expect(result.code).toBe('FRH-2d-yes-15-000-0450')
    expect(result.segments[3]).toMatchObject({ active: false, value: '000' })
  })

  it('ignores a supplied value for a zero-filled segment without erroring', () => {
    const result = service.resolve(makeProduct(), {
      '11': '2d',
      '12': 'no',
      '13': '45',
      '15': '450',
    })
    expect(result.valid).toBe(true)
    expect(result.code).toBe('FRH-2d-no-00-000-0450')
  })

  it('normalizes NUMBER values by zero-padding them in the code', () => {
    const result = service.resolve(makeProduct(), {
      '11': '1m',
      '12': 'no',
      '15': '50',
    })
    expect(result.code).toBe('FRH-1m-no-00-000-0050')
  })

  it('reports an error for a missing active segment and zero-fills its dependent', () => {
    // Pos 3 is active (pos 2 = yes) but has no value → error; pos 4 watches
    // pos 3, whose value is unusable → zero-fills instead of erroring too.
    const result = service.resolve(makeProduct(), {
      '11': '2d',
      '12': 'yes',
      '15': '450',
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].assignmentId).toBe(13)
    expect(result.errors[0].message).toContain('required')
    expect(result.segments[3]).toMatchObject({ active: false, value: '000' })
    expect(result.code).toBeUndefined()
    expect(result.summary).toBeUndefined()
  })

  it('collects every validation failure instead of stopping at the first', () => {
    const result = service.resolve(makeProduct(), {
      '11': 'xx',
      '12': 'yes',
      '13': '5',
      '15': '9999',
    })
    expect(result.valid).toBe(false)
    const erroredIds = result.errors.map((error) => error.assignmentId).sort()
    expect(erroredIds).toEqual([11, 13, 15])
    expect(result).not.toHaveProperty('code')
    expect(result).not.toHaveProperty('summary')
    // segments is always present, even when invalid.
    expect(result.segments).toHaveLength(5)
  })

  it('echoes the raw input in segments for an errored segment', () => {
    const result = service.resolve(makeProduct(), {
      '11': 'xx',
      '12': 'no',
      '15': '450',
    })
    expect(result.segments[0]).toMatchObject({ active: true, value: 'xx' })
  })

  it('silently ignores selection keys that match no assignment', () => {
    const result = service.resolve(makeProduct(), {
      '11': '2d',
      '12': 'no',
      '15': '450',
      '999999': 'stale',
    })
    expect(result.valid).toBe(true)
    expect(result.code).toBe('FRH-2d-no-00-000-0450')
  })

  it('resolves a product with no assignments to just the code prefix', () => {
    const product = makeProduct()
    product.assignments = []
    const result = service.resolve(product, {})
    expect(result.valid).toBe(true)
    expect(result.code).toBe('FRH')
    expect(result.summary).toEqual([])
    expect(result.segments).toEqual([])
  })

  it('throws BadRequestException on a malformed selections map', () => {
    expect(() => service.resolve(makeProduct(), { abc: '1' })).toThrow(
      BadRequestException,
    )
    expect(() => service.resolve(makeProduct(), { '11': 5 })).toThrow(
      BadRequestException,
    )
  })
})
