import { SetMetadata } from '@nestjs/common'
import { AuthType } from '../enums/auth-type.enum'
import { AUTH_TYPE_KEY } from '../constants/auth.constants'

/**
 * WHAT THIS DOES:
 * This decorator labels a route with the type of login protection it needs.
 * For example, adding `@Auth(AuthType.None)` tells the app that this
 * specific endpoint is public (like a sign-in page) and does not require a token.
 * 1. It uses NestJS's built-in `SetMetadata` function.
 * 2. It saves the `authTypes` array (e.g., `[AuthType.None]`) into the route's metadata configuration.
 * 3. The key used to store this data is the value of the `AUTH_TYPE_KEY` constant (which is the string 'authType').
 * 4. A NestJS Guard will later call `Reflector.get()` using that exact same `AUTH_TYPE_KEY` constant
 * to retrieve the array and evaluate whether to allow or block the incoming HTTP request.
 */
export const Auth = (...authTypes: AuthType[]) =>
  SetMetadata(AUTH_TYPE_KEY, authTypes)
