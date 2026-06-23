# CLAUDE.md — src/auth

Guidance specific to this module. See the root `CLAUDE.md` for the global request pipeline overview; this file covers things only visible by reading multiple files inside `auth`.

## Guard/AuthType extension point

`AuthenticationGuard` (`authentication.guard.ts`) is the **second** `APP_GUARD` (after `ThrottlerGuard`). It builds an `authTypeGuardMap: Record<AuthType, CanActivate>` (currently `{ [AuthType.Bearer]: AccessTokenGuard, [AuthType.None]: AlwaysAllowGuard }`) and tries the guards for the route's `AuthType[]` (from `@Auth()` metadata, default `[AuthType.Bearer]`) in order, throwing the last `HttpException` if all fail.

To add a new auth strategy (e.g. an API-key guard): add the enum member to `enums/auth-type.enum.ts`, implement a `CanActivate`, and register it in `authTypeGuardMap`. Don't bypass the guard map by checking auth ad hoc in a controller.

## RBAC — roles and authorization

Authorization runs as a **third** `APP_GUARD` (`RolesGuard`, `guards/authorization/roles.guard.ts`), after `ThrottlerGuard` and `AuthenticationGuard`. The two guards are independent: authentication proves who you are, authorization decides what you can do.

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

### Ownership checks

**Post write routes (EDITOR restriction only):**

`EDITOR` can only act on their own posts. `AUTHOR` and `ADMIN` skip the check entirely. Implemented in the provider, not the guard:

- `UpdatePostProvider.update()` — throws `ForbiddenException` if `EDITOR` and `post.author.id !== activeUser.sub`
- `RemovePostProvider.remove()` — same check
- `UploadPostImageProvider.uploadPostImage()` — same check

**Meta-option write routes (EDITOR and AUTHOR restriction):**

Unlike post routes, MetaOption write routes restrict both EDITOR and AUTHOR to their own posts' meta-options. Only ADMIN may update or delete any meta-option regardless of ownership. Implemented in:

- `UpdateMetaOptionProvider.update()` — throws `ForbiddenException` if `activeUser.role !== ADMIN && post.author.id !== activeUser.sub`
- `DeleteMetaOptionProvider.delete()` — same check

This stricter model is intentional: MetaOption holds per-post SEO metadata and there is no cross-author reuse case analogous to an AUTHOR editing someone else's post content.

### `ActiveUserData`

`src/auth/interfaces/active-user-data.interface.ts` — the shape of the JWT payload attached to every request. Includes `sub` (userId), `email`, and `role`. Always read via `@ActiveUser()` in controllers, never access `request[REQUEST_USER_KEY]` directly outside of guards.

## Token issuance

`GenerateTokensProvider.generateTokens(user)` signs access + refresh JWTs **in parallel** via `Promise.all`. The access token payload includes `{ sub, email, role }`; the refresh token carries only `sub`. Both tokens come from `jwtConfig` (`auth/config/jwt.config.ts`), whose `registerAs` namespace key is `'jwt'` (not `'jwtConfig'` — note the inconsistency with `cloudinaryConfig`/`appConfig`). Errors during signing are wrapped as `InternalServerErrorException`.

**Dual delivery:** `AuthController.signIn` and `AuthController.refreshTokens` set the refresh token as an `HttpOnly` cookie (`refreshToken`, `Path=/auth/refresh-tokens`, `SameSite=lax`, `maxAge` from `jwtConfiguration.refreshTokenTtl`) **and** return it in the JSON body. Browser clients (Svelte) use the cookie automatically; mobile clients (Flutter) read the body. `POST /auth/sign-out` clears the cookie — mobile clients can call it too, the absent cookie is a no-op.

**`POST /auth/refresh-tokens` token resolution:** the controller reads `req.cookies.refreshToken` first; falls back to `refreshTokenDto.refreshToken` from the body if no cookie. Throws `UnauthorizedException` if neither is present. `RefreshTokenDto.refreshToken` is `@IsOptional()` so the `ValidationPipe` does not reject browser requests with no body — presence is enforced by the controller, not the pipe.

**`RefreshTokensProvider.refreshTokens`** takes `{ refreshToken: string }` (not `RefreshTokenDto`) because by the time the controller calls it the token is already a guaranteed string. It throws `UnauthorizedException('Invalid refresh token')` on a bad/expired JWT, re-derives the user via `usersService.findOneById(payload.sub)`, and re-issues both tokens (rotation — no revocation list exists yet).

## Module dependency: Auth → Users (one-way, no cycle)

`AuthModule` imports `UsersModule` and `CryptoModule`. `UsersModule` imports only `CryptoModule` — it does not import `AuthModule`. There is no circular dependency and no `forwardRef()` anywhere in these two modules.

`HashingProvider` and `BcryptProvider` live in `src/crypto/`. Both modules import `CryptoModule` to access `HashingProvider`. Auth providers (`SignInProvider`, `RefreshTokensProvider`, `GoogleAuthenticationService`, `ChangePasswordProvider`) inject `UsersService` directly using constructor parameter types — no `@Inject()` or `forwardRef()` needed.

## Local vs. Google accounts

A `User` row can exist without a `password` (Google-only signup). Two places enforce this boundary:
- `SignInProvider.signIn` — throws `UnauthorizedException('This account uses Google Sign-In')` if `user.password` is null. Keep this check if you touch sign-in.
- `ChangePasswordProvider.changePassword` — throws `BadRequestException('This account uses Google Sign-In. Use account settings to manage your password.')` for the same reason. The distinction (401 vs 400) is intentional: sign-in is an authentication failure, change-password is a precondition failure for an already-authenticated user.

**`ChangePasswordProvider`** (`src/auth/providers/change-password.provider.ts`) handles `POST /auth/change-password` (Bearer-auth required, throttled 5 / 60s). It loads the user via `usersService.findOneById()`, verifies the current password with `hashingProvider.comparePassword()`, hashes the new password, then delegates the DB write to `usersService.updatePassword()`. The `updatePassword()` method on `UsersService` is a thin wrapper around `userRepository.save({ id, password })` — it lives in `UsersModule` to avoid `AuthModule` needing its own `TypeOrmModule.forFeature([User])`.

`google-authentication.service.ts` implements `OnModuleInit` to construct its `OAuth2Client` lazily — needed because config values must be resolved after DI is ready. It verifies the ID token, requires `email_verified`, then does find-or-create by Google ID, not by email. Both `CreateUserProvider` and `CreateGoogleUserProvider` explicitly set `role: UserRole.USER` — the DTO's `whitelist: true` pipe and the explicit assignment together prevent a malicious user from injecting a higher role at registration.

**Google re-login sync:** When an existing Google user signs in again, `google-authentication.service.ts` calls `usersService.syncGoogleUser()` (backed by `src/users/providers/sync-google-user.provider.ts`) before generating tokens. This updates the stored `firstName`, `lastName`, and `email` if Google is now returning different values. Email sync is skipped silently if another account already owns that email address — the login still succeeds. The tokens are then issued from the (possibly updated) user record so the JWT always reflects current data.
