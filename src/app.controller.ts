import { Controller, Get } from '@nestjs/common'
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus'
import { Auth } from './auth/decorators/auth.decorator'
import { AuthType } from './auth/enums/auth-type.enum'

@Controller()
export class AppController {
  constructor(
    // Orchestrates running health indicators and aggregating their results
    private readonly health: HealthCheckService,
    // Pings the default TypeORM connection to verify the database is reachable
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  /** Returns 200 with DB info when healthy; 503 when the database is unreachable. Used by Coolify. */
  @Get('health')
  @Auth(AuthType.None)
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check([() => this.db.pingCheck('database')])
  }
}
