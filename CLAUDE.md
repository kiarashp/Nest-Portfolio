# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm** (see `pnpm-workspace.yaml` / `.npmrc`).

```bash
pnpm install              # install deps

pnpm run start            # run (no watch)
pnpm run start:dev        # run with watch, NODE_ENV=development (loads .env.development)
pnpm run start:debug      # run with --debug --watch
pnpm run start:prod       # run compiled dist/main.js

pnpm run build             # nest build
pnpm run lint               # eslint --fix on src/apps/libs/test
pnpm run format             # prettier --write on src/test

pnpm run test                # jest unit tests (*.spec.ts colocated with source)
pnpm run test:watch
pnpm run test:cov
pnpm run test:e2e            # jest using test/jest-e2e.json (test/**/*.e2e-spec.ts)
pnpm run test:debug          # node --inspect-brk for debugging a jest run

pnpm run doc                 # compodoc, served on port 3001, output to ./documentation
```

Run a single unit test file: `pnpm jest path/to/file.spec.ts` (or `pnpm exec jest -t "test name"`).
Run a single e2e test file: `pnpm jest --config ./test/jest-e2e.json path/to/file.e2e-spec.ts`.

Swagger/OpenAPI docs are served at `/api` once the app is running (see `main.ts`).

## Environment configuration

Env file selection is driven by `NODE_ENV`: `.env` when unset, otherwise `.env.<NODE_ENV>` (see `app.module.ts`). `.env.example` documents the required variables; `environment.validation.ts` (Joi) is the source of truth for which variables are required vs. defaulted — check it before adding new env vars instead of guessing. Required: DB_PASSWORD, DB_USER, DB_NAME, DB_HOST, JWT_SECRET, JWT_TOKEN_AUDIENCE, JWT_TOKEN_ISSUER, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, API_VERSION, CLOUDINARY_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.

Config is exposed to the app via `@nestjs/config` `registerAs` namespaces, not `process.env` directly outside of `src/config/*` and `src/auth/config/jwt.config.ts`. Inject `ConfigService` and read e.g. `configService.get('appConfig.appPort')` or `configService.get('database.host')`.

## Architecture

NestJS (v11) + TypeORM + PostgreSQL blog/portfolio API. Module-per-domain layout: `users`, `posts`, `tags`, `meta-options`, `auth` (with a nested `social` sub-feature for Google), plus cross-cutting `common` and `config` directories.

Within each domain module the convention is: `*.module.ts` → `*.controller.ts` → `providers/*.service.ts`, with single-purpose provider classes for individual operations (e.g. `users/providers/create-user.provider.ts`, `find-one-by-id.provider.ts`, `find-one-by-google-id.provider.ts`) injected into the domain service rather than putting all logic in one service class. DTOs live in `dto(s)/`, TypeORM entities in `entities/`.

Entity relations: `User` 1—N `Post` (eager-loaded author on `Post`), `Post` 1—1 `MetaOption` (cascade + eager), `Post` N—N `Tag` (eager, owning side with `@JoinTable`).

### Request pipeline (global, wired in `app.module.ts`)

1. **`AuthenticationGuard`** (`APP_GUARD`) runs on every route. It reads `AuthType[]` metadata set by the `@Auth(...)` decorator (`src/auth/decorators/auth.decorator.ts`); if absent, defaults to `AuthType.Bearer`. It maps each `AuthType` to a guard (`Bearer` → `AccessTokenGuard`, `None` → always-allow) and tries them in order, throwing the last `HttpException` if none pass. To make a route/controller public, decorate with `@Auth(AuthType.None)`.
2. **`AccessTokenGuard`** extracts a bearer token from the `Authorization` header, verifies it via `JwtService` using `jwtConfig`, and attaches the decoded payload to the request under `REQUEST_USER_KEY` (`src/auth/constants/auth.constants.ts`). Read the current user in controllers via the `@ActiveUser()` decorator (`src/auth/decorators/active-user.decorator.ts`).
3. **`DataResponseInterceptor`** (`APP_INTERCEPTOR`) wraps every controller's return value as `{ apiVersion, data }`, where `apiVersion` comes from `appConfig.apiVersion` (env `API_VERSION`). Controllers should just return plain data/entities; do not wrap responses manually.
4. A global `ValidationPipe` is configured in `main.ts` with `whitelist: true, forbidNonWhitelisted: true, transform: true` — DTOs must declare every accepted field with `class-validator` decorators or requests are rejected.

### Auth

- Local sign-in: `auth/providers/sign-in.provider.ts` + `bcrypt.provider.ts` (implements `HashingProvider` abstract class via DI token).
- Tokens: `generate-tokens.provider.ts` issues access+refresh JWTs from `jwtConfig`; `refresh-tokens.provider.ts` handles refresh flow.
- Google OAuth: `auth/social/google-authentication.controller.ts` + `social/providers/google-authentication.service.ts` verify Google ID tokens via `google-auth-library`, then create/find a local user (`users/providers/create-google-user.provider.ts`, `find-one-by-google-id.provider.ts`).
- `AuthModule` uses `forwardRef(() => UsersModule)` because `UsersModule` also depends back on auth (hashing provider) — keep that in mind if you touch either module's imports/exports.

### Pagination

`common/pagination` exports a request-scoped `PaginationProvider` (injects `REQUEST` to build absolute `first/last/current/next/prev` links). Domain services call `paginationProvider.paginateQuery(paginationQueryDto, repository)` rather than reimplementing pagination per module.

### Uploads

`src/uploads` is a dedicated, reusable module for Cloudinary image uploads — it exports `UploadsService` so other feature modules (e.g. `posts`, a future user avatar) can later `imports: [UploadsModule]` and inject it directly, the same way `PaginationModule` is consumed today.

- `UploadFile` entity (`src/uploads/entities/upload-file.entity.ts`) records every upload: `name`, `path` (Cloudinary `secure_url`), `publicId` (needed later to delete/transform the asset), `type` (`FileType` enum — currently only `IMAGE`), `mime`, `size`, `userId`.
- `CloudinaryProvider` (`src/uploads/providers/cloudinary.provider.ts`) is the SDK-specific worker — analogous to how `BcryptProvider` implements `HashingProvider`. `UploadsService` orchestrates: upload via `CloudinaryProvider`, then persist the `UploadFile` row.
- Config: `src/config/cloudinary.config.ts` (`registerAs('cloudinaryConfig', ...)`), injected via `@Inject(cloudinaryConfig.KEY)` — same pattern as `jwtConfig`.
- Route: `POST /uploads`, multipart field name `file`, Bearer-auth by default (uploader's id comes from `@ActiveUser('sub')`), validated via `ParseFilePipe` (5MB cap, image MIME types only via `FileTypeValidator`). Uses `FileInterceptor('file', { storage: memoryStorage() })` since Cloudinary's `upload_stream` needs an in-memory buffer, not a disk path.

### Code style

- No semicolons, single quotes, trailing commas (`.prettierrc`); ESLint extends `typescript-eslint` recommendedTypeChecked + prettier. `no-explicit-any` and `no-unused-vars` are turned off; `no-floating-promises`/`no-unsafe-argument` are warnings only.
- Path aliasing: imports use the `src/...` absolute form (e.g. `src/users/users.module`) rather than deep relative paths, per `tsconfig.json` `baseUrl: "./"`.
