import { PaginationQueryDto } from 'src/common/pagination/dtos/pagination-query.dto'

// No filters beyond pagination — a thread is fetched newest-first and the
// frontend reverses the page for display.
export class GetQuoteMessagesDto extends PaginationQueryDto {}
