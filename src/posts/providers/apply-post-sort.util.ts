import { SelectQueryBuilder } from 'typeorm'
import { Post } from '../entities/post.entity'
import { PostSortField, PostSortOrder } from '../dto/get-posts.dto'

/**
 * Applies the requested sort plus an id tiebreaker so pagination stays stable
 * when the primary sort column ties. sortBy is safe to interpolate — it is
 * constrained to POST_SORT_FIELDS by @IsIn before it ever reaches this
 * function, mirroring FindAllAuditLogsProvider.applySort.
 */
export function applyPostSort(
  qb: SelectQueryBuilder<Post>,
  sortBy: PostSortField,
  order: PostSortOrder,
): void {
  const direction = order.toUpperCase() as 'ASC' | 'DESC'
  qb.orderBy(`post.${sortBy}`, direction)
  qb.addOrderBy('post.id', direction)
}
