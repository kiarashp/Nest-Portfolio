import { renderZeroFill } from './render-zero-fill.util'
import { SegmentDataType } from '../enums/segment-data-type.enum'

describe('renderZeroFill', () => {
  it('renders STRING segments as a single "0"', () => {
    expect(
      renderZeroFill({
        dataType: SegmentDataType.STRING,
        constraints: { minLength: 1, maxLength: 5 },
      }),
    ).toBe('0')
  })

  it('renders SELECT segments as a single "0"', () => {
    expect(
      renderZeroFill({ dataType: SegmentDataType.SELECT, constraints: {} }),
    ).toBe('0')
  })

  it('renders NUMBER segments as "0" repeated to the digits width', () => {
    expect(
      renderZeroFill({
        dataType: SegmentDataType.NUMBER,
        constraints: { digits: 2, min: 10, max: 99 },
      }),
    ).toBe('00')
    expect(
      renderZeroFill({
        dataType: SegmentDataType.NUMBER,
        constraints: { digits: 3, min: 100, max: 800 },
      }),
    ).toBe('000')
    expect(
      renderZeroFill({
        dataType: SegmentDataType.NUMBER,
        constraints: { digits: 4, min: 50, max: 2000 },
      }),
    ).toBe('0000')
  })
})
