import { renderMeaning } from './render-meaning.util'

describe('renderMeaning', () => {
  it('substitutes {value}', () => {
    expect(renderMeaning('Insertion length: {value} mm', '0450')).toBe(
      'Insertion length: 0450 mm',
    )
  })

  it('substitutes {label} when a label is passed', () => {
    expect(renderMeaning('Sensor: {label}', '2d', 'double Pt500')).toBe(
      'Sensor: double Pt500',
    )
  })

  it('substitutes both placeholders in one template', () => {
    expect(renderMeaning('{label} ({value})', '2d', 'double Pt500')).toBe(
      'double Pt500 (2d)',
    )
  })

  it('substitutes repeated occurrences of the same placeholder', () => {
    expect(renderMeaning('{value}-{value}', '45')).toBe('45-45')
  })

  it('returns templates without placeholders unchanged', () => {
    expect(renderMeaning('Fixed text', '45')).toBe('Fixed text')
  })

  it('leaves {label} untouched when no label is passed', () => {
    expect(renderMeaning('Sensor: {label}', '2d')).toBe('Sensor: {label}')
  })
})
