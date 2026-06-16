# CLAUDE.md — src/auth

Guidance specific to this module. See the root `CLAUDE.md` for the global request pipeline overview; this file covers things only visible by reading multiple files inside `auth`.

## Guard/AuthType extension point

`AuthenticationGuard` (`authentication.guard.ts`) is the single `APP_GUARD` for the whole app. It builds an `authTypeGuardMap: Record<AuthType, CanActivate>` (currently `{ [AuthType.Bearer]: AccessTokenGuard, [AuthType.None]: AlwaysAllowGuard }`) and tries the guards for the route's `AuthType[]` (from `@Auth()` metadata, default `[AuthType.Bearer]`) in order, throwing the **last** thrown `HttpException` if all fail.

To add a new auth strategy (e.g. an API-key guard): add the enum member to `enums/auth-type.enum.ts`, implement a `CanActivate`, and register it in `authTypeGuardMap`. Don't bypass the guard map by checking auth ad hoc in a controller.

## Circular dependency: Auth ↔ Users

`AuthModule` and `UsersModule` depend on each other (`UsersService` needs `HashingProvider`/`AuthService` for password hashing and lookups; `auth`'s sign-in/refresh/google flows need `UsersService` to find/create users). Both sides use `forwardRef()`:
- `UsersModule` imports `forwardRef(() => AuthModule)`; `UsersService` injects `@Inject(forwardRef(() => AuthService)) authService`.
- Individual auth providers (`SignInProvider`, `RefreshTokensProvider`, `GoogleAuthenticationService`) inject `@Inject(forwardRef(() => UsersService)) usersService`.

If you add a new provider that crosses this boundary, it also needs `forwardRef()` on whichever side closes the cycle — a plain constructor injection will fail at bootstrap with a "Nest can't resolve dependencies" error.

## Token issuance

`GenerateTokensProvider.generateTokens(user)` signs access + refresh JWTs **in parallel** via `Promise.all`, using `signToken<T>(userId, expiresIn, payload?)` (payload only on the access token — refresh tokens carry just `sub`). Both come from `jwtConfig` (`auth/config/jwt.config.ts`), whose `registerAs` namespace key is `'jwt'` (not `'jwtConfig'` — note the inconsistency with `cloudinaryConfig`/`appConfig` if you go looking for it via `ConfigService.get(...)`). Errors during signing are wrapped as `InternalServerErrorException`, not propagated raw.

`RefreshTokensProvider.refreshTokens` throws `UnauthorizedException('Invalid refresh token')` on a bad/expired refresh JWT, then re-derives the user via `usersService.findOneById(payload.sub)` and re-issues both tokens (rotation — no refresh token reuse/revocation list exists yet).

## Local vs. Google accounts

A `User` row can exist without a `password` (Google-only signup). `SignInProvider.signIn` checks for this and throws `UnauthorizedException('This account uses Google Sign-In')` rather than attempting a hash comparison against `null`/`undefined` — keep this check if you touch sign-in.

`google-authentication.service.ts` implements `OnModuleInit` to construct its `OAuth2Client` lazily (not in the constructor) — needed because `googleClientId`/`googleClientSecret` come from `jwtConfig` and must be resolved after DI config is ready. It verifies the ID token, requires `email_verified`, then does find-or-create by Google ID (`findOneByGoogleId` / `createGoogleUser`), not by email — two accounts with the same email but different sign-in methods are treated as distinct users today.
