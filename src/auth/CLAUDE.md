# CLAUDE.md — src/auth

Guidance specific to this module. See the root `CLAUDE.md` for the global request pipeline overview; this file covers things only visible by reading multiple files inside `auth`.

## Guard/AuthType extension point

`AuthenticationGuard` (`authentication.guard.ts`) is the **first** `APP_GUARD`. It builds an `authTypeGuardMap: Record<AuthType, CanActivate>` (currently `{ [AuthType.Bearer]: AccessTokenGuard, [AuthType.None]: AlwaysAllowGuard }`) and tries the guards for the route's `AuthType[]` (from `@Auth()` metadata, default `[AuthType.Bearer]`) in order, throwing the last `HttpException` if all fail.

To add a new auth strategy (e.g. an API-key guard): add the enum member to `enums/auth-type.enum.ts`, implement a `CanActivate`, and register it in `authTypeGuardMap`. Don't bypass the guard map by checking auth ad hoc in a controller.

## RBAC — roles and authorization

Authorization runs as a **second** `APP_GUARD` (`RolesGuard`, `guards/authorization/roles.guard.ts`), after `AuthenticationGuard`. The two guards are independent: authentication proves who you are, authorization decides what you can do.

### Roles

Defined in `src/auth/enums/user-role.enum.ts`:

| Role | What they can do |
|---|---|
| `USER` | Read-only for now |
| `EDITOR` | Create/update/delete/upload images for **their own posts** only |
| `AUTHOR` | Create/update/delete/upload images for **any post** |
| `ADMIN` | Full access — same as AUTHOR plus user management |

All new users (local and Google) are created with `UserRole.USER`. An admin can change a user's role via `PATCH /users/:id/role`.

### How `@Roles()` works

```ts
@Roles(UserRole.EDITOR, UserRole.AUTHOR, UserRole.ADMIN)
@Post()
createPost(...) {}
```

`RolesGuard` reads the `ROLES_KEY` metadata via `Reflector`. If no `@Roles()` is set, the guard passes through. If roles are required but no user is on the request (which would only happen if `@Auth(AuthType.None)` and `@Roles()` are mistakenly combined), access is **denied** — not silently allowed.

### Ownership checks (EDITOR restriction)

`EDITOR` can only act on their own posts. This check lives in the provider, not the guard:

- `UpdatePostProvider.update()` — throws `ForbiddenException` if `EDITOR` and `post.author.id !== activeUser.sub`
- `RemovePostProvider.remove()` — same check
- `UploadPostImageProvider.uploadPostImage()` — same check

`AUTHOR` and `ADMIN` skip the ownership check entirely.

### `ActiveUserData`

`src/auth/interfaces/active-user-data.interface.ts` — the shape of the JWT payload attached to every request. Includes `sub` (userId), `email`, and `role`. Always read via `@ActiveUser()` in controllers, never access `request[REQUEST_USER_KEY]` directly outside of guards.

## Token issuance

`GenerateTokensProvider.generateTokens(user)` signs access + refresh JWTs **in parallel** via `Promise.all`. The access token payload includes `{ sub, email, role }`; the refresh token carries only `sub`. Both tokens come from `jwtConfig` (`auth/config/jwt.config.ts`), whose `registerAs` namespace key is `'jwt'` (not `'jwtConfig'` — note the inconsistency with `cloudinaryConfig`/`appConfig`). Errors during signing are wrapped as `InternalServerErrorException`.

**Dual delivery:** `AuthController.signIn` and `AuthController.refreshTokens` set the refresh token as an `HttpOnly` cookie (`refreshToken`, `Path=/auth/refresh-tokens`, `SameSite=lax`, `maxAge` from `jwtConfiguration.refreshTokenTtl`) **and** return it in the JSON body. Browser clients (Svelte) use the cookie automatically; mobile clients (Flutter) read the body. `POST /auth/sign-out` clears the cookie — mobile clients can call it too, the absent cookie is a no-op.

**`POST /auth/refresh-tokens` token resolution:** the controller reads `req.cookies.refreshToken` first; falls back to `refreshTokenDto.refreshToken` from the body if no cookie. Throws `UnauthorizedException` if neither is present. `RefreshTokenDto.refreshToken` is `@IsOptional()` so the `ValidationPipe` does not reject browser requests with no body — presence is enforced by the controller, not the pipe.

**`RefreshTokensProvider.refreshTokens`** takes `{ refreshToken: string }` (not `RefreshTokenDto`) because by the time the controller calls it the token is already a guaranteed string. It throws `UnauthorizedException('Invalid refresh token')` on a bad/expired JWT, re-derives the user via `usersService.findOneById(payload.sub)`, and re-issues both tokens (rotation — no revocation list exists yet).

## Circular dependency: Auth ↔ Users

`AuthModule` and `UsersModule` depend on each other. Both sides use `forwardRef()`:
- `UsersModule` imports `forwardRef(() => AuthModule)`; `UsersService` injects `@Inject(forwardRef(() => AuthService)) authService`.
- Individual auth providers (`SignInProvider`, `RefreshTokensProvider`, `GoogleAuthenticationService`) inject `@Inject(forwardRef(() => UsersService)) usersService`.

If you add a new provider that crosses this boundary, it also needs `forwardRef()` on whichever side closes the cycle.

## Local vs. Google accounts

A `User` row can exist without a `password` (Google-only signup). `SignInProvider.signIn` checks for this and throws `UnauthorizedException('This account uses Google Sign-In')` — keep this check if you touch sign-in.

`google-authentication.service.ts` implements `OnModuleInit` to construct its `OAuth2Client` lazily — needed because config values must be resolved after DI is ready. It verifies the ID token, requires `email_verified`, then does find-or-create by Google ID, not by email. Both `CreateUserProvider` and `CreateGoogleUserProvider` explicitly set `role: UserRole.USER` — the DTO's `whitelist: true` pipe and the explicit assignment together prevent a malicious user from injecting a higher role at registration.
