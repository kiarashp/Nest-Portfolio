import { Test, TestingModule } from '@nestjs/testing'
import { AppController } from './app.controller'
import { AppService } from './app.service'

// AppController is a thin NestJS controller with no routes of its own right now.
// These tests verify the module wires up correctly and that AppService works.
describe('AppController', () => {
  let appController: AppController
  let appService: AppService

  beforeEach(async () => {
    // Boot the controller + its only dependency (AppService) in an isolated module.
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile()

    appController = module.get(AppController)
    appService = module.get(AppService)
  })

  it('should be defined', () => {
    // The controller must exist after the module compiles — catches DI wiring errors.
    expect(appController).toBeDefined()
  })

  describe('AppService', () => {
    it('getHello returns the expected greeting string', () => {
      // getHello lives on the service, not the controller — test it directly here.
      expect(appService.getHello()).toBe('Hello World!')
    })
  })
})
