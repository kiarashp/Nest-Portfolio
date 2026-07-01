// @Throttle()/@SkipThrottle() decorator args are evaluated at class-definition
// time, before Nest's DI container (and ConfigService) exist, so this must read
// process.env directly — same exception app.module.ts already takes for NODE_ENV.
export const isDevelopmentEnvironment = process.env.NODE_ENV === 'development'
