/**
 * Renders a definition's meaningTemplate into one human summary line
 * (CONFIGURATOR.md §4.3 step 5). Every occurrence of `{value}` is replaced
 * with the segment's resolved value; every occurrence of `{label}` is
 * replaced with the matching SegmentOption's label, but only when a label is
 * passed (SELECT segments) — for other dataTypes a stray `{label}` in the
 * template is left untouched, since there is nothing meaningful to put there.
 */
export function renderMeaning(
  template: string,
  value: string,
  label?: string,
): string {
  let rendered = template.split('{value}').join(value)
  if (label !== undefined) {
    rendered = rendered.split('{label}').join(label)
  }
  return rendered
}
