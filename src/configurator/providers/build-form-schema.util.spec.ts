import { buildFormSchema } from './build-form-schema.util'
import { ConfigurableProduct } from '../entities/configurable-product.entity'
import { ProductSegmentAssignment } from '../entities/product-segment-assignment.entity'
import { SegmentDataType } from '../enums/segment-data-type.enum'

// Builds an in-memory product tree the way FindOneConfigurableProductProvider
// loads it: assignments ordered by position, each with its definition and
// (for SELECT) sortOrder-ordered options.
const makeProduct = (): ConfigurableProduct =>
  ({
    id: 7,
    name: 'Resistive sensor with cap',
    slug: 'frh',
    codePrefix: 'FRH',
    separator: '-',
    description: 'A sensor family',
    imageUrl: 'https://example.com/frh.png',
    imagePublicId: 'configurator/frh',
    isPublished: true,
    assignments: [
      {
        id: 11,
        position: 1,
        condition: null,
        definition: {
          id: 1,
          label: 'Sensor type',
          dataType: SegmentDataType.SELECT,
          constraints: null,
          options: [
            { id: 1, value: '1m', label: 'single Pt100', sortOrder: 0 },
            { id: 2, value: '2d', label: 'double Pt500', sortOrder: 1 },
          ],
        },
      },
      {
        id: 12,
        position: 2,
        condition: {
          controllingAssignmentId: 11,
          operator: 'eq',
          value: '2d',
          effect: 'zero_fill',
        },
        definition: {
          id: 2,
          label: 'Insertion length (mm)',
          dataType: SegmentDataType.NUMBER,
          constraints: { digits: 4, min: 50, max: 2000 },
          options: [],
        },
      },
    ] as unknown as ProductSegmentAssignment[],
  }) as ConfigurableProduct

describe('buildFormSchema', () => {
  it('exposes only the curated product fields', () => {
    const schema = buildFormSchema(makeProduct())
    expect(schema.product).toEqual({
      name: 'Resistive sensor with cap',
      description: 'A sensor family',
      imageUrl: 'https://example.com/frh.png',
      codePrefix: 'FRH',
      separator: '-',
    })
    // Internal/admin fields must not leak onto the public schema.
    expect(schema.product).not.toHaveProperty('id')
    expect(schema.product).not.toHaveProperty('slug')
    expect(schema.product).not.toHaveProperty('imagePublicId')
    expect(schema.product).not.toHaveProperty('isPublished')
  })

  it('nulls missing description and imageUrl instead of omitting them', () => {
    const product = makeProduct()
    product.description = undefined
    product.imageUrl = undefined
    const schema = buildFormSchema(product)
    expect(schema.product.description).toBeNull()
    expect(schema.product.imageUrl).toBeNull()
  })

  it('flattens each assignment and its definition into one segment', () => {
    const schema = buildFormSchema(makeProduct())
    expect(schema.segments).toHaveLength(2)
    expect(schema.segments[0]).toMatchObject({
      assignmentId: 11,
      position: 1,
      label: 'Sensor type',
      dataType: SegmentDataType.SELECT,
      constraints: null,
      condition: null,
    })
    expect(schema.segments[1]).toMatchObject({
      assignmentId: 12,
      position: 2,
      label: 'Insertion length (mm)',
      dataType: SegmentDataType.NUMBER,
      constraints: { digits: 4, min: 50, max: 2000 },
      condition: {
        controllingAssignmentId: 11,
        operator: 'eq',
        value: '2d',
        effect: 'zero_fill',
      },
    })
  })

  it('maps options to {value, label} for SELECT segments only', () => {
    const schema = buildFormSchema(makeProduct())
    expect(schema.segments[0].options).toEqual([
      { value: '1m', label: 'single Pt100' },
      { value: '2d', label: 'double Pt500' },
    ])
    expect(schema.segments[1].options).toBeUndefined()
  })

  it('returns an empty segments array for a product with no assignments', () => {
    const product = makeProduct()
    product.assignments = undefined
    expect(buildFormSchema(product).segments).toEqual([])
  })
})
