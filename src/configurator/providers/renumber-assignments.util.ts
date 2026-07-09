import { EntityManager } from 'typeorm'
import { ProductSegmentAssignment } from '../entities/product-segment-assignment.entity'

// Shifts every assignment matching `condition` by `delta` (+1 or -1), safely
// against the (productId, position) unique constraint. PostgreSQL checks a
// unique constraint per row as a bulk UPDATE processes it, not once at
// statement end, so a naive single-statement `position = position + delta`
// over several rows can momentarily try to write a value another
// not-yet-processed row in the same statement still holds, in whatever
// (unspecified) order Postgres happens to visit them — a genuine 23505, not
// a race with another transaction. The fix is two statements: first negate
// the matching rows (negative values can never collide with any real
// positive position, and negation is injective so the matching rows can't
// collide with each other either), then flip them to their final positive
// values — by then every target value is free, again regardless of row order.
async function shiftRange(
  manager: EntityManager,
  productId: number,
  condition: string,
  params: Record<string, unknown>,
  delta: 1 | -1,
): Promise<void> {
  await manager
    .createQueryBuilder()
    .update(ProductSegmentAssignment)
    .set({ position: () => '-position' })
    .where(`"productId" = :productId AND (${condition})`, {
      productId,
      ...params,
    })
    .execute()

  await manager
    .createQueryBuilder()
    .update(ProductSegmentAssignment)
    .set({ position: () => (delta === 1 ? '-position + 1' : '-position - 1') })
    .where('"productId" = :productId AND position < 0', { productId })
    .execute()
}

/**
 * Shifts every assignment in a product with position >= fromPosition up by
 * one, making room for a new row inserted at fromPosition. Used by
 * CreateAssignmentProvider.
 */
export async function shiftPositionsUpFrom(
  manager: EntityManager,
  productId: number,
  fromPosition: number,
): Promise<void> {
  await shiftRange(
    manager,
    productId,
    'position >= :fromPosition',
    { fromPosition },
    1,
  )
}

/**
 * Shifts every assignment in a product with position > afterPosition down by
 * one, closing the gap left by a deleted row. Used by DeleteAssignmentProvider.
 */
export async function shiftPositionsDownAfter(
  manager: EntityManager,
  productId: number,
  afterPosition: number,
): Promise<void> {
  await shiftRange(
    manager,
    productId,
    'position > :afterPosition',
    { afterPosition },
    -1,
  )
}

/**
 * Moves one assignment from oldPosition to newPosition within the same
 * product, shifting the assignments in between by one to keep positions
 * gapless. Used by UpdateAssignmentProvider for a position change (reorder).
 * First parks the moving row at position 0 (disjoint from every real
 * position) so its old slot doesn't collide with a row shifting into it,
 * then shifts the affected range (via the same negate-then-finalize
 * technique as shiftPositionsUpFrom/DownAfter), then sets the row's final
 * position — optionally alongside other changed columns, e.g. condition, via
 * extraSet.
 */
export async function moveAssignmentPosition(
  manager: EntityManager,
  assignmentId: number,
  productId: number,
  oldPosition: number,
  newPosition: number,
  extraSet: Partial<ProductSegmentAssignment> = {},
): Promise<void> {
  await manager
    .createQueryBuilder()
    .update(ProductSegmentAssignment)
    .set({ position: 0 })
    .where('id = :id', { id: assignmentId })
    .execute()

  if (newPosition < oldPosition) {
    await shiftRange(
      manager,
      productId,
      'position >= :newPosition AND position < :oldPosition',
      { newPosition, oldPosition },
      1,
    )
  } else {
    await shiftRange(
      manager,
      productId,
      'position > :oldPosition AND position <= :newPosition',
      { oldPosition, newPosition },
      -1,
    )
  }

  await manager
    .createQueryBuilder()
    .update(ProductSegmentAssignment)
    .set({ position: newPosition, ...extraSet })
    .where('id = :id', { id: assignmentId })
    .execute()
}

/**
 * Pure projection (no DB access): where a sibling assignment's position would
 * land after moving one assignment from oldPosition to newPosition, without
 * actually running the shift. Used to validate condition direction rules
 * before a reorder transaction runs — see moveAssignmentPosition for the
 * matching real shift.
 */
export function shiftedPosition(
  position: number,
  oldPosition: number,
  newPosition: number,
): number {
  if (oldPosition === newPosition) return position
  if (oldPosition < newPosition) {
    return position > oldPosition && position <= newPosition
      ? position - 1
      : position
  }
  return position >= newPosition && position < oldPosition
    ? position + 1
    : position
}
