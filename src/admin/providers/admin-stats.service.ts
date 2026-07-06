import { Injectable } from '@nestjs/common'
import { AdminStatsProvider } from './admin-stats.provider'
import { AdminStatsDto } from '../dto/admin-stats.dto'

@Injectable()
export class AdminStatsService {
  constructor(
    /** inject admin stats provider */
    private readonly adminStatsProvider: AdminStatsProvider,
  ) {}

  public async getStats(): Promise<AdminStatsDto> {
    return this.adminStatsProvider.getStats()
  }
}
