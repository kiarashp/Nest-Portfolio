import { PaginationQueryDto } from 'src/common/pagination/dtos/pagination-query.dto'

// No filters beyond pagination — CONFIGURATOR.md §5.1/§7 don't ask for any on
// this list route (mirrors GetSegmentDefinitionsDto).
export class GetConfiguratorProductsDto extends PaginationQueryDto {}
