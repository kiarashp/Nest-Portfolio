import { Test, TestingModule } from '@nestjs/testing'
import {
  HealthCheckResult,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus'
import { AppController } from './app.controller'

describe('AppController', () => {
  let appController: AppController
  let healthCheckService: jest.Mocked<HealthCheckService>

  beforeEach(async () => {
    // Boot the controller with mocked Terminus providers — no real DB connection needed.
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: { check: jest.fn() },
        },
        {
          provide: TypeOrmHealthIndicator,
          useValue: { pingCheck: jest.fn() },
        },
      ],
    }).compile()

    appController = module.get(AppController)
    healthCheckService = module.get(HealthCheckService)
  })

  it('should be defined', () => {
    expect(appController).toBeDefined()
  })

  it('check() delegates to HealthCheckService', async () => {
    const mockResult: HealthCheckResult = {
      status: 'ok',
      info: { database: { status: 'up' } },
      error: {},
      details: { database: { status: 'up' } },
    }
    healthCheckService.check.mockResolvedValue(mockResult)

    const result = await appController.check()

    expect(healthCheckService.check).toHaveBeenCalledTimes(1)
    expect(result.status).toBe('ok')
  })
})
