import {
  ControllerResolvedState,
  evaluateCondition,
} from './evaluate-condition.util'
import { AssignmentCondition } from '../entities/product-segment-assignment.entity'
import { SegmentDataType } from '../enums/segment-data-type.enum'

// Shorthand builders for the two inputs, keeping each test to its point.
const condition = (
  partial: Partial<AssignmentCondition> & Pick<AssignmentCondition, 'operator'>,
): AssignmentCondition => ({
  controllingAssignmentId: 1,
  effect: 'zero_fill',
  ...partial,
})

const select = (
  value: string | null,
  active = true,
): ControllerResolvedState => ({
  active,
  value,
  dataType: SegmentDataType.SELECT,
})

const number = (
  value: string | null,
  active = true,
): ControllerResolvedState => ({
  active,
  value,
  dataType: SegmentDataType.NUMBER,
})

describe('evaluateCondition', () => {
  describe('SELECT controllers (string comparison)', () => {
    it('eq is met when the values match and not met otherwise', () => {
      expect(
        evaluateCondition(
          condition({ operator: 'eq', value: 'yes' }),
          select('yes'),
        ),
      ).toBe(true)
      expect(
        evaluateCondition(
          condition({ operator: 'eq', value: 'yes' }),
          select('no'),
        ),
      ).toBe(false)
    })

    it('neq is met when the values differ and not met otherwise', () => {
      expect(
        evaluateCondition(
          condition({ operator: 'neq', value: 'yes' }),
          select('no'),
        ),
      ).toBe(true)
      expect(
        evaluateCondition(
          condition({ operator: 'neq', value: 'yes' }),
          select('yes'),
        ),
      ).toBe(false)
    })
  })

  describe('NUMBER controllers (numeric comparison)', () => {
    it('eq and neq compare numerically, so padded values match', () => {
      expect(
        evaluateCondition(
          condition({ operator: 'eq', value: '45' }),
          number('0045'),
        ),
      ).toBe(true)
      expect(
        evaluateCondition(
          condition({ operator: 'neq', value: '45' }),
          number('0045'),
        ),
      ).toBe(false)
    })

    it('gt and lt are strict', () => {
      expect(
        evaluateCondition(
          condition({ operator: 'gt', value: '50' }),
          number('51'),
        ),
      ).toBe(true)
      expect(
        evaluateCondition(
          condition({ operator: 'gt', value: '50' }),
          number('50'),
        ),
      ).toBe(false)
      expect(
        evaluateCondition(
          condition({ operator: 'lt', value: '50' }),
          number('49'),
        ),
      ).toBe(true)
      expect(
        evaluateCondition(
          condition({ operator: 'lt', value: '50' }),
          number('50'),
        ),
      ).toBe(false)
    })

    it('between is inclusive at both bounds', () => {
      const between = condition({ operator: 'between', min: 30, max: 99 })
      expect(evaluateCondition(between, number('30'))).toBe(true)
      expect(evaluateCondition(between, number('99'))).toBe(true)
      expect(evaluateCondition(between, number('29'))).toBe(false)
      expect(evaluateCondition(between, number('100'))).toBe(false)
    })
  })

  describe('cascade rule', () => {
    it('an inactive controller means NOT MET for every operator, including neq', () => {
      const inactiveSelect = select('0', false)
      const inactiveNumber = number('000', false)
      expect(
        evaluateCondition(
          condition({ operator: 'eq', value: '0' }),
          inactiveSelect,
        ),
      ).toBe(false)
      expect(
        evaluateCondition(
          condition({ operator: 'neq', value: 'x' }),
          inactiveSelect,
        ),
      ).toBe(false)
      expect(
        evaluateCondition(
          condition({ operator: 'gt', value: '-1' }),
          inactiveNumber,
        ),
      ).toBe(false)
      expect(
        evaluateCondition(
          condition({ operator: 'lt', value: '1000' }),
          inactiveNumber,
        ),
      ).toBe(false)
      expect(
        evaluateCondition(
          condition({ operator: 'between', min: 0, max: 1000 }),
          inactiveNumber,
        ),
      ).toBe(false)
    })
  })

  describe('errored controller', () => {
    it('an active controller with no usable value means NOT MET', () => {
      expect(
        evaluateCondition(
          condition({ operator: 'neq', value: 'x' }),
          select(null),
        ),
      ).toBe(false)
      expect(
        evaluateCondition(
          condition({ operator: 'between', min: 0, max: 1000 }),
          number(null),
        ),
      ).toBe(false)
    })
  })
})
