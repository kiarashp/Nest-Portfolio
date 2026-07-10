import { PaginationQueryDto } from 'src/common/pagination/dtos/pagination-query.dto'

// No filters beyond pagination — CONFIGURATOR.md §5.3 only asks for a
// paginated list of the caller's own snapshots (mirrors
// GetConfiguratorProductsDto).
export class GetSavedConfigurationsDto extends PaginationQueryDto {}
