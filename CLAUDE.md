# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Nested guidance: `src/auth/CLAUDE.md` (RBAC, guards), `src/mail/CLAUDE.md`, `src/audit-log/CLAUDE.md`, `src/uploads/CLAUDE.md`, `src/products/CLAUDE.md`, `test/CLAUDE.md`.

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
pnpm run test:e2e            # jest using test/jest-e2e.json (test/**/*.e2e-spec.ts) — sets NODE_ENV=test and NODE_OPTIONS=--experimental-vm-modules automatically, requires .env.test pointing at a separate DB (DB_NAME=nest_portfolio_test)
                             # NODE_OPTIONS=--experimental-vm-modules is required so NestJS's FileTypeValidator can load the file-type ESM package inside Jest's CJS VM
pnpm run test:debug          # node --inspect-brk for debugging a jest run

pnpm run doc                 # compodoc, served on port 3001, output to ./documentation

pnpm run seed:admin          # create or promote the first admin user — works against any NODE_ENV, including production
pnpm run seed:dev            # seed an editor/author/user (plus the admin), tags, posts, product types, and products —
                             # idempotent, safe to re-run; works against any NODE_ENV like seed:admin (see Database seeds section below)

pnpm run generate:schema     # boot the NestJS app (no HTTP server), write openapi.json, exit — requires dev DB running
pnpm run generate:types      # the one you normally run: chains generate:schema then openapi-typescript → openapi-types.ts
                             # both openapi.json and openapi-types.ts are gitignored (generated artifacts)
                             # copy openapi-types.ts to the Svelte frontend and use with openapi-fetch for typed API calls
```

Run a single unit test file: `pnpm jest path/to/file.spec.ts` (or `pnpm exec jest -t "test name"`).
Run a single e2e test file: `pnpm jest --config ./test/jest-e2e.json path/to/file.e2e-spec.ts`.

### Migrations (production/staging only)

**Development** uses `DB_SYNC=true` — TypeORM auto-syncs the schema on startup, no migrations needed during normal development.

**Production/staging** uses `DB_SYNC=false`. Migrations are always run **locally from this repo** against the production DB — never on the server. The server just runs the app; the schema is already up to date before it starts.

**Solo-dev deploy workflow:**
```bash
# 1. Change an entity, then generate a migration (diffs entities vs dev DB).
#    Replace DescribeChange with a short name for what changed.
#    There is no migrate:generate script — the name must be passed directly.
pnpm run typeorm migration:generate src/database/migrations/DescribeChange -d src/database/data-source.ts

# 2. Review the generated file in src/database/migrations/

# 3. Commit the migration file alongside the entity change, then push to GitHub

# 4. Coolify / Railway deploys: runs prestart:prod (migrations) then starts the app
```

```bash
# Other migration commands:
pnpm run migrate:run    # run pending migrations against dev DB
pnpm run migrate:revert # roll back last migration on dev DB
```

Infrastructure files:
- `src/database/data-source.ts` — TypeORM DataSource; loads `.env.<NODE_ENV>` via dotenv (silently skips if file not found — prod env vars come from Coolify/Railway dashboard)
- `tsconfig.typeorm.json` — tsconfig override (commonjs) used by migration CLI scripts
- `src/database/migrations/` — generated migration files, always committed to git alongside the entity change

Rules:
- Never set `DB_SYNC=true` in production or staging
- Always commit the migration file in the same commit/PR as the entity change
- `prestart:prod` runs `node node_modules/typeorm/cli.js migration:run -d dist/database/data-source.js` — uses compiled JS, no ts-node needed on the server
- Coolify/Railway start command must be `pnpm run start:prod` (not `node dist/main` directly) so the `prestart:prod` npm lifecycle fires
- If a migration fails on the server, the app won't start — this is intentional (fail fast rather than boot with wrong schema)

See `test/CLAUDE.md` for the e2e helper infrastructure and spec-writing conventions.

Swagger/OpenAPI docs are served at `/api` in development only (`NODE_ENV !== 'production'`). In production the endpoint returns 404 — Swagger is disabled at startup in `app.create.ts`.

`src/app.create.ts` (beside `main.ts`) contains all post-creation setup: the `extended` query parser (`app.set('query parser', 'extended')` — needed so bracket-nested params like `?specs[tempRange][min]=100` parse into nested objects; Express 5 defaults to `simple`, which does not), global pipes, `cookie-parser` middleware, Swagger, CORS, and `app.listen()`. `main.ts` calls `NestFactory.create(AppModule)`, enables shutdown hooks (`app.enableShutdownHooks()` — lets Coolify drain in-flight requests on SIGTERM before stopping the container), then delegates to `appCreate(app)`. Change global middleware or port config there, not in `main.ts`. Response compression is handled by Coolify's Caddy reverse proxy — do not add Node.js-level compression middleware.

## Environment configuration

Env file selection is driven by `NODE_ENV`: `.env` when unset, otherwise `.env.<NODE_ENV>` (see `app.module.ts`). `.env.example` documents the required variables; `environment.validation.ts` (Joi) is the source of truth for which variables are required vs. defaulted — check it before adding new env vars instead of guessing. Required: DB_PASSWORD, DB_USER, DB_NAME, DB_HOST, JWT_SECRET, JWT_TOKEN_AUDIENCE, JWT_TOKEN_ISSUER, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, API_VERSION, CLOUDINARY_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, MAIL_HOST, MAIL_USER, MAIL_PASSWORD, MAIL_FROM.

`FRONTEND_URL` (default `http://localhost:5173`) controls the CORS allowed origin. Set it in `.env.development` for local Svelte dev and in the Coolify/Railway dashboard for production. It maps to `appConfig.frontendUrl`.

Config is exposed to the app via `@nestjs/config` `registerAs` namespaces, not `process.env` directly outside of `src/config/*` and `src/auth/config/jwt.config.ts`. Inject `ConfigService` and read e.g. `configService.get('appConfig.appPort')` or `configService.get('database.host')`.

## Database seeds

Seed scripts live in `src/database/seeds/`. They use `NestFactory.createApplicationContext(SeedModule)` — this boots the DI container and database connection without starting an HTTP server, runs the script, then exits.

**Admin seed** (`src/database/seeds/admin.seed.ts`):
- Reads `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` from the env file
- If the email exists → promotes that user to `ADMIN`
- If not → creates a new user with `ADMIN` role
- Safe to run multiple times

```bash
pnpm run seed:admin   # uses NODE_ENV=development → .env.development
```

`SeedModule` (`src/database/seeds/seed.module.ts`) is a minimal module — only `ConfigModule` + `TypeOrmModule`. It skips Joi validation intentionally (the seed only needs DB vars). All entities must be listed explicitly in `entities: [...]` because `autoLoadEntities` only works when all feature modules are loaded.

**Data seed** (`src/database/seeds/dev-data.seed.ts`) — works against any environment, exactly like `admin.seed.ts` (point `NODE_ENV` at the target env, it reads that env's DB credentials; there is no production guard):
- Ensures the admin user exists (same `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` env vars and upsert-or-promote logic as `admin.seed.ts`), plus one editor/author/user account via `SEED_EDITOR_EMAIL`/`SEED_EDITOR_PASSWORD`, `SEED_AUTHOR_EMAIL`/`SEED_AUTHOR_PASSWORD`, `SEED_USER_EMAIL`/`SEED_USER_PASSWORD` — same pattern as the admin vars (email defaults to an obvious placeholder, password is required; the script fails fast listing every missing `*_PASSWORD` var before writing anything)
- Seeds ~4 tags, ~4 posts (mixed `PostStatus`, tagged, authored by the seeded editor/author), 2 `ProductType`s (Thermocouples, Cables) with `filterableFields`, and ~6 `Product`s with matching `specs` — **this content is hardcoded placeholder example copy** (precision-tools starter catalog with `placehold.co` images). If you run this against production, edit the tag/post/product-type/product literals in the script first — they are created exactly as written, published and publicly visible.
- Idempotent — every record is looked up by its unique email/slug first and skipped if already present
- Users are created via direct repository writes + `bcryptjs` (mirroring `admin.seed.ts`), **not** `UsersService`/`CreateUserProvider` — that provider fires the `user.created` event (real email via `MailModule`) and leaves `isEmailVerified: false`, which blocks sign-in (`sign-in.provider.ts`). Seeded users get `isEmailVerified: true` set directly so they can sign in immediately.
- Tags, posts, and products are created through their real `TagsService`/`PostsService`/`ProductsService`/`ProductTypesService` — these have no event side effects, so going through the service layer gives free DTO validation and audit-log entries.

```bash
SEED_ADMIN_EMAIL=you@example.com   SEED_ADMIN_PASSWORD=yourpassword   \
SEED_EDITOR_EMAIL=ed@example.com   SEED_EDITOR_PASSWORD=yourpassword  \
SEED_AUTHOR_EMAIL=au@example.com   SEED_AUTHOR_PASSWORD=yourpassword  \
SEED_USER_EMAIL=user@example.com   SEED_USER_PASSWORD=yourpassword    \
pnpm run seed:dev   # NODE_ENV selects the target env's .env.<NODE_ENV> file, same as admin.seed.ts
```

`DevSeedModule` (`src/database/seeds/dev-seed.module.ts`) extends the minimal pattern: it imports `TagsModule`, `PostsModule`, and `ProductsModule` for their real service layer, plus `EventEmitterModule.forRoot()` — required because `PostsModule` pulls in `UsersModule`, and `CreateUserProvider` depends on `EventEmitter2`, which is normally only registered globally by `AppModule`. Its `entities: [...]` list also includes `AvatarOption` and `AuditLog` (pulled in transitively by `UsersModule` and `AuditLogModule`) alongside `Product`/`ProductType` — `seed.module.ts` itself is untouched and still used only by `admin.seed.ts`.

## Architecture

NestJS (v11) + TypeORM + PostgreSQL API for a company webapp (precision tools business). The primary client is a **SvelteKit** web frontend; a **Flutter** mobile client may be added in the future. The `posts` module serves a company blog/news section managed by EDITOR/AUTHOR users. The `products` module is the core catalog. `openapi-types.ts` (generated from the live OpenAPI spec) is the typed contract consumed by the SvelteKit frontend via `openapi-fetch` — keep it up to date when the API surface changes.

Module-per-domain layout: `users`, `posts`, `tags`, `meta-options`, `auth` (with a nested `social` sub-feature for Google), `products`, `contact`, plus cross-cutting `common`, `config`, `crypto`, and `audit-log` directories. `CryptoModule` (`src/crypto/`) is a standalone utility module that provides `HashingProvider` (abstract) and `BcryptProvider` (concrete); both `AuthModule` and `UsersModule` import it — this is how password hashing is shared without a circular dependency between those two modules. `AuditLogModule` (`src/audit-log/`) is imported by `UsersModule`, `PostsModule`, `TagsModule`, `MetaOptionsModule`, and `ProductsModule` — any module whose providers write audit records must import it. `ProductsModule` (`src/products/`) owns two entities (`ProductType`, `Product`) and two controllers (`ProductTypesController`, `ProductsController`); it imports `PaginationModule`, `UploadsModule`, and `AuditLogModule`.

Within each domain module the convention is: `*.module.ts` → `*.controller.ts` → `providers/*.service.ts`, where the service is a **thin facade** that delegates to single-purpose provider classes for individual operations. Each provider handles exactly one responsibility (e.g. `create-post.provider.ts`, `find-one-post.provider.ts`, `remove-post.provider.ts`). DTOs live in `dto(s)/`, TypeORM entities in `entities/`.

Entity relations:
- `User` 1—N `Post` (eager-loaded author on `Post`)
- `Post` 1—1 `MetaOption` (cascade + eager)
- `Post` N—N `Tag` (eager, owning side with `@JoinTable`)
- `Post` 1—N `UploadFile` (non-eager — loaded explicitly for the image picker, single-image delete, and cleanup on post deletion). `Post` also has a `@CreateDateColumn() createdAt: Date` used by the `startDate`/`endDate` filters on `GET /posts`. `Post.featuredImage` is nullable (`string | null`) so it can be explicitly cleared when the image it points at is deleted.
- `Product` 1—N `UploadFile` (non-eager, via nullable `UploadFile.productId` — mirrors `postId`; loaded explicitly for the image picker, single-image delete, and cleanup on product soft-delete)
- `User` 1—N `UploadFile` (non-nullable — every upload is tied to the uploading user)
- `AvatarOption` — standalone entity (`src/users/entities/avatar-option.entity.ts`), no FK to `User`. Columns: `id`, `url`, `publicId`, `createdAt`. Admins populate the pool via `POST /users/avatar-options`; users pick one with `PATCH /users/avatar`.
- `ContactSubmission` — standalone entity (`src/contact/entities/contact-submission.entity.ts`), no FK to any other table. Columns: `id`, `name`, `email`, `subject`, `message`, `createdAt`. Every submission is persisted permanently so the owner can review them even if an email notification is missed.
- `AuditLog` — standalone entity (`src/audit-log/entities/audit-log.entity.ts`), no FK to any other table. Columns: `id`, `userId` (nullable int — null for self-service operations like registration), `action` (varchar 32), `entity` (varchar 64), `entityId` (int), `createdAt`. Written by providers after every successful write; never deleted.
- `ProductType` 1—N `Product` (non-eager — the inverse `products` relation is never loaded automatically; always query products directly). `ProductType` entity (`src/products/entities/product-type.entity.ts`) exports the `FilterableField` interface used in `filterableFields` (jsonb column). It also has a transient (non-column) `productCount` populated only by `GET /product-types` — the published-product count per type, for landing cards.
- `Product` N—1 `ProductType` (eager — `productType` is always included in product responses). `Product` entity (`src/products/entities/product.entity.ts`) has `@DeleteDateColumn deletedAt` for soft-delete, a `specs` jsonb column (no DB index — TypeORM's `@Index` cannot express a `USING gin` index; add one via a raw-SQL migration if production scale needs it), and a B-tree `@Index(['productTypeId'])` at class level for type-based filtering. Soft-deleted products are automatically excluded from all TypeORM queries unless `withDeleted: true` is passed.

### Request pipeline (global, wired in `app.module.ts`)

1. **`ThrottlerGuard`** (`APP_GUARD`, first) enforces rate limits. Global default: 60 req / 60s per IP. Sensitive auth endpoints override this with `@Throttle()` — see the Rate limiting section below.
2. **`AuthenticationGuard`** (`APP_GUARD`, second) reads `AuthType[]` metadata set by `@Auth(...)` (`src/auth/decorators/auth.decorator.ts`); defaults to `[AuthType.Bearer]` if absent. Maps each type to a guard (`Bearer` → `AccessTokenGuard`, `None` → always-allow) and tries them in order. To make a route public, decorate with `@Auth(AuthType.None)`.
3. **`AccessTokenGuard`** extracts a bearer token, verifies it via `JwtService`, and attaches the decoded payload to the request under `REQUEST_USER_KEY` (`src/auth/constants/auth.constants.ts`). Read the current user in controllers via `@ActiveUser()` (`src/auth/decorators/active-user.decorator.ts`).
4. **`RolesGuard`** (`APP_GUARD`, third) reads `UserRole[]` metadata set by `@Roles(...)` (`src/auth/decorators/roles.decorator.ts`). If no `@Roles()` is set, the guard passes. If roles are required but no user is on the request, access is denied. See `src/auth/CLAUDE.md` for full RBAC details.
5. **`DataResponseInterceptor`** (`APP_INTERCEPTOR`, registered first) wraps every response as `{ apiVersion, data }`. Controllers return plain data — do not wrap manually.
6. **`ClassSerializerInterceptor`** (`APP_INTERCEPTOR`, registered second) runs on the raw controller output before `DataResponseInterceptor` wraps it. This activates `@Exclude()` and `@Expose()` decorators on entities globally. See the Serialization section below for the groups pattern used on `User`.
7. A global `ValidationPipe` (`src/app.create.ts`) runs with `whitelist: true, forbidNonWhitelisted: true, transform: true` — extra fields in request bodies are stripped, undeclared fields rejected.

### Rate limiting

`@nestjs/throttler` is configured in `AppModule` with a single named throttler (`default`, 60 req / 60s per IP). `ThrottlerGuard` is the first `APP_GUARD` so rate limits fire before any DB access. Limits use an in-memory store (no Redis needed).

Auth endpoints override the global default with `@Throttle({ default: { limit, ttl } })`:

| Endpoint | Limit |
|---|---|
| `POST /auth/sign-in` | 5 / 60s |
| `POST /auth/refresh-tokens` | 10 / 60s |
| `POST /auth/reset-password` | 5 / 60s |
| `POST /auth/change-password` | 5 / 60s |
| `POST /auth/resend-verification` | 3 / 300s |
| `POST /auth/forgot-password` | 3 / 300s |
| `POST /users` (register) | 5 / 600s |
| `POST /contact` | 3 / 300s |

`ttl` is in milliseconds. To skip throttling on a route entirely, use `@SkipThrottle()`. To tighten limits on a new sensitive endpoint, add `@Throttle({ default: { limit, ttl } })` directly on the handler — no module changes needed.

### Auth

- Local sign-in: `auth/providers/sign-in.provider.ts` + `src/crypto/providers/bcrypt.provider.ts` (implements the `HashingProvider` abstract class from `src/crypto/providers/hashing.provider.ts`). Both live in `CryptoModule` (`src/crypto/crypto.module.ts`), which is imported by both `AuthModule` and `UsersModule`. Uses `bcryptjs` (pure-JS port — no native build tools required).
- Tokens: `generate-tokens.provider.ts` issues access+refresh JWTs. The access token payload includes `sub` (userId), `email`, and `role`. The refresh token carries only `sub`.
- Google OAuth: `auth/social/google-authentication.controller.ts` + `social/providers/google-authentication.service.ts` verify Google ID tokens, then create/find a local user. Both local and Google users are always created with `role: UserRole.USER` — roles must be elevated explicitly by an admin.
- `AuthModule` imports `UsersModule` (one-way only). `UsersModule` does not import `AuthModule` — there is no circular dependency and no `forwardRef()` in either module. See `src/auth/CLAUDE.md` for details.
- RBAC: four roles (`USER`, `EDITOR`, `AUTHOR`, `ADMIN`) defined in `src/auth/enums/user-role.enum.ts`. See `src/auth/CLAUDE.md` for the full access control rules.

**Refresh token dual delivery (browser + mobile):** On sign-in and token refresh, the refresh token is returned in both the JSON body AND set as an `HttpOnly` cookie (`Path=/auth/refresh-tokens`, `SameSite=lax`). Browser clients (Svelte) rely on the cookie; mobile clients (Flutter) read the body. `POST /auth/refresh-tokens` accepts the token from either source — cookie takes precedence, body is the fallback. `POST /auth/sign-out` clears the cookie (mobile clients can ignore it).

**`RefreshTokenDto` optional field pattern:** `refreshToken` in `RefreshTokenDto` is `@IsOptional()` so the global `ValidationPipe` does not reject browser requests that send no body. The controller enforces presence — if neither cookie nor body provides a token it throws `UnauthorizedException`. Downstream (`AuthService.refreshTokens`, `RefreshTokensProvider.refreshTokens`) take `{ refreshToken: string }` (not the DTO) because by that point the controller has already resolved and guaranteed the string.

### Routes

Exact routes, auth levels, and request/response shapes live in the controllers — read the relevant `*.controller.ts` rather than duplicating them here. The non-obvious rules below aren't visible from a controller alone. RBAC details are in `src/auth/CLAUDE.md`.

**Route-ordering gotchas** (literal segment must be declared before `/:id` so `ParseIntPipe` doesn't swallow it):
- `users`: `/me`, `/avatar-options`, `PATCH /me` before `/:id`
- `tags`: `DELETE /tags/soft/:id` before `DELETE /tags/:id`
- `posts`: `/slug/:slug`, `/my`, `/admin` before `/:id`
- `products`: `/slug/:slug` and `/admin` before `/:id`
- `product-types`: `/slug/:slug` before `/:id`

**Tags conflict handling:** `UpdateTagProvider` catches PostgreSQL error 23505 (unique constraint) as `ConflictException`; all other save errors surface as `RequestTimeoutException`.

**MetaOptions creation:** always created via `POST /posts` nested body — there is intentionally no `POST /meta-options` endpoint because it could only produce orphaned rows. Write routes restrict EDITOR and AUTHOR to their own posts' meta-options; only ADMIN bypasses. Logic: load with `{ post: { author: true } }`, then `if activeUser.role !== ADMIN && post.author.id !== activeUser.sub → ForbiddenException`.

**MetaOptions directory note:** new providers live in `src/meta-options/providers/` (correct spelling). The legacy service lives in the misspelled `src/meta-options/provieders/` — known but harmless.

**Draft visibility (Posts):** public routes (`GET /posts`, `/:id`, `/slug/:slug`) hardcode `status = PUBLISHED` at the DB level inside `FindAllPostsProvider` / `FindOnePostProvider.findOnePublishedByIdOrFail` — drafts return 404 not 403, callers cannot override. `GET /posts/my` bypasses this (Bearer-gated, any authenticated role, own posts only). `GET /posts/admin` bypasses it fully (AUTHOR + ADMIN only) — returns all posts from all authors across all statuses; pass `?status=` to narrow to one. Write routes use `findOneByIdOrFail` (any status). `GET /posts/:id/admin` (EDITOR/AUTHOR/ADMIN, `POST_OWNERSHIP` rule — EDITOR limited to own posts) is the single-post counterpart used by the staff edit form: it fetches one post by ID regardless of status via `FindOnePostForEditProvider`, since `GET /posts/:id` cannot return a draft/review/scheduled post for editing.

**Draft visibility (Products):** public routes hardcode `isPublished = true` in `FindAllProductsProvider` / `FindOneProductProvider`. `GET /products/admin` bypasses it (ADMIN only).

**Product type field evolution (`PATCH /product-types/:id`):** `filterableFields` edits are guarded so they can never strand a product's `specs`. Fields match by `key`: adding fields/options, editing `label`/`unit`, and reordering are free; a field's `key` and `type` are **immutable** (400 on change); a field or enum option can be removed only when **no product uses it** (else 409). `UpdateProductTypeProvider` delegates this to `ValidateTypeChangeProvider` + `classify-type-change.util.ts`. Clients must send the **complete** field list (the array is replaced wholesale). Full rules in `src/products/CLAUDE.md`.

**`GetPostsDto` query params** (shared by `GET /posts`, `/posts/my`, and `/posts/admin`): `limit`/`page`; `startDate`/`endDate` (Between/MoreThanOrEqual/LessThanOrEqual on `Post.createdAt` — `GET /posts` and `/posts/admin`, not `/posts/my`); `status` (`/posts/my` and `/posts/admin` — `GET /posts` hardcodes PUBLISHED so `status` is ignored there); `tagIds[]` (OR logic, `GET /posts` only — Transform converts string scalar to `number[]`); `authorId` (`GET /posts` and `/posts/admin`, not `/posts/my` which already scopes to the caller); `q` (1–100 chars, case-insensitive ILIKE on title+content, all three routes — composes as `(title OR content) AND (tag1 OR tag2)`).

**`GetProductsDto` query params:** `limit`/`page`; `productTypeId` (`@Type(() => Number)`) **or** `typeSlug` (matches the joined `productType.slug`; `productTypeId` wins if both sent); `q` (1–100 chars, ILIKE on name+shortDescription); `sort` (`newest` default / `oldest` / `name`); `specs` (bracket-nested params like `specs[sheathMaterial]=Inconel 600&specs[tempRange][min]=1000` parsed into a `Record` object — enum/string facets match exactly, number facets take a scalar or `[min]`/`[max]` range; requires a type context and is validated against the type's `filterableFields`. Needs the `extended` query parser — see `app.create.ts`). `FindAllProductsProvider` builds a `SelectQueryBuilder` (not a simple `where`) because spec filters need jsonb access — see `src/products/CLAUDE.md`. The provider `leftJoinAndSelect`s `productType` because QueryBuilder does not auto-load eager relations.

**Health check:** `GET /health` is public — Terminus `TypeOrmHealthIndicator`, returns 200 `{ status: 'ok' }` or 503. Used by Coolify.

### Serialization

`ClassSerializerInterceptor` is global. Entity fields control their own visibility via class-transformer decorators.

**`User` entity field visibility:**

| Field | Decorator | Visible to |
|---|---|---|
| `password`, `googleId`, `emailVerificationToken`, `emailVerificationTokenExpiry` | `@Exclude()` | nobody |
| `email`, `role`, `isEmailVerified` | `@Expose({ groups: ['admin'] })` | only when 'admin' group is active |
| `id`, `firstName`, `lastName`, `avatarUrl`, `bio` | none | everyone |

`UsersController` is decorated with `@SerializeOptions({ groups: ['admin'] })`, so all its responses include `email`, `role`, and `isEmailVerified`. `PostsController` has no `@SerializeOptions`, so the author object embedded in post responses only contains the public fields (`id`, `firstName`, `lastName`, `avatarUrl`, `bio`) — this is exactly the shape documented by the `PublicAuthor` OpenAPI model (see OpenAPI response typing below).

If a new controller or endpoint needs to expose admin-only fields, add `@SerializeOptions({ groups: ['admin'] })` to it.

A single route can opt *out* of a controller's admin default with `@SerializeOptions({ groups: ['public'] })` — any group name other than `'admin'` hides the admin-only fields (there is no `@Expose({ groups: ['public'] })` on the entity; `'public'` just means "not admin"). `GET /users/:id/profile` uses this to expose a public author view from the otherwise admin-grouped `UsersController`.

### OpenAPI response typing

The `@nestjs/swagger` introspection plugin is intentionally **not** enabled (no `plugins` in `nest-cli.json`), so Swagger only documents what is **manually decorated**. Request DTOs carry `@ApiProperty`; a response/entity shape only gets a real type if its class is `@ApiProperty`-decorated, otherwise its generated type shows `content?: never`.

The **entire HTTP surface is now response-typed** — posts, products, users, tags, meta-options, audit-logs, avatar-options, auth, and contact controllers all describe their responses with the reusable helpers in `src/common/swagger/api-response.helpers.ts` — `ApiDataResponse(Model)`, `ApiArrayDataResponse(Model)`, `ApiPaginatedResponse(Model)` — which describe the global `{ apiVersion, data }` envelope (and the nested `Paginated` shape) so the generated `openapi-types.ts` exposes real response types. Soft-delete/delete endpoints use `DeleteResultDto` (`src/common/dto/delete-result.dto.ts`); endpoints that return only a status string use `MessageResponseDto` (`src/common/dto/message-response.dto.ts`); auth token endpoints use `AuthTokensDto` (`src/auth/dtos/auth-tokens.dto.ts`). The users admin reads use `AdminUser` (`src/users/dto/admin-user.dto.ts`) — a documentation-only DTO holding the admin-group fields, the write-side counterpart to `PublicAuthor` (see the embedded-author note below). The posts read shape pulls in `Post`, `Tag`, `MetaOption`, and `UploadFile` (all `@ApiProperty`-decorated), plus `PublicAuthor` (`src/users/dto/public-author.dto.ts`).

**Auth & roles in the spec — `ApiAuth()`:** `@Roles(...)` is a runtime guard concern and never appears in OpenAPI on its own, and `openapi-typescript` cannot give a client compile-time role enforcement. So every Bearer-protected handler is decorated with `@ApiAuth(...)` from `src/common/swagger/api-auth.helpers.ts`, which `applyDecorators` a `@ApiBearerAuth()` + a `401` response, and — when `roles`/`ownership` are passed — a `403` whose **description names the required roles** (e.g. `Forbidden — requires role: author, admin`). `openapi-typescript` carries that description into `openapi-types.ts` as JSDoc, so the role matrix is a self-documenting part of the typed contract; the frontend reads it to gate its UI and treats a real `403` as authoritative. Usage: `@ApiAuth({ roles: [UserRole.ADMIN] })` for admin-only, `@ApiAuth({ roles: [...], ownership: 'EDITOR limited to their own posts' })` where a provider enforces per-row ownership, and bare `@ApiAuth()` for any-authenticated routes (bearer + 401, no 403). Add it to every new protected route — do not hand-roll `@ApiBearerAuth()` + ad-hoc 401/403 decorators. Endpoint-specific responses (`400`/`404`/`409`) stay as their own `@ApiResponse` decorators alongside it.

**Embedded `author` on post reads — why `PublicAuthor`, not `User`:** Without the introspection plugin, **only `@ApiProperty`-decorated properties appear in a schema**, so the shared `User` entity (which carries no `@ApiProperty`) emits no schema at all. A post's `author` is serialized to public fields only (`PostsController` has no `@SerializeOptions(['admin'])`), but `UsersController` exposes `email`/`role`/`isEmailVerified` from the same `User` class — one `User` schema can't represent both. `Post.author` therefore points at a dedicated documentation-only `PublicAuthor` class (`@ApiProperty({ type: () => PublicAuthor })`) holding exactly the public fields. It does not affect runtime serialization (still driven by `User`'s class-transformer groups). When an embedded relation is serialized differently than its own controller exposes it, prefer a small public-view DTO over decorating the shared entity.

Two gotchas when decorating entities: a nullable union like `string | null` makes TypeScript emit `Object` metadata, so pass an explicit `type` (e.g. `@ApiPropertyOptional({ type: String, nullable: true })`) or the field renders as an empty object. And before decorating an entity with `@Exclude()` fields (e.g. `User`), add `@ApiHideProperty()` to those fields so secrets are not advertised in the schema — or, as posts does, leave internal relations (`UploadFile.user`/`post`, `MetaOption.post`, `Post.uploadFiles`) entirely undecorated so they never enter the schema.

`PaginationQueryDto` now carries `@ApiPropertyOptional` on `page`/`limit`, so paging params appear in the typed query for every paginated endpoint.

### Pagination

`common/pagination` exports a singleton `PaginationProvider` that builds absolute `first/last/current/next/prev` links. Domain providers call `paginationProvider.paginateQuery(paginationQueryDto, repository, where, request)` rather than reimplementing pagination per module. The `request` argument (Express `Request`) is threaded from the controller via `@Req()` down through the service facade and into the provider — it is used only to build the link URLs (`protocol`, `headers.host`, `url`). The `where` parameter filters both the result set and the total count used for page calculations; it accepts either a single condition object or an array of condition objects — when an array is passed, TypeORM treats each element as an OR branch (a row is returned if it matches any one of them).

For filters that a `where` object can't express (jsonb access, numeric casts, joins, custom ordering), use `paginateQueryBuilder(paginationQueryDto, queryBuilder, request)` instead — pass a fully-configured `SelectQueryBuilder` (its own `where`/`join`/`orderBy` already set, since `skip`/`take` without an `ORDER BY` is unstable) and it adds skip/take, runs count + fetch, and returns the same `{ data, meta, links }` shape. `FindAllProductsProvider` uses this for spec filtering. Both methods share one private meta/links builder.

**Important:** `PaginationProvider` must stay a plain singleton — never inject `REQUEST` or any request-scoped token. Doing so bubbles REQUEST scope through every consuming service and silently breaks `OnModuleInit` hooks downstream (this previously stopped `GoogleAuthenticationService.onModuleInit` from firing).

`count()` runs before `find()` and the two queries are not wrapped in a transaction, so under concurrent writes `totalItems` and `data.length` can diverge by a row. This is intentional and accepted — list-count metadata is approximate under concurrency (standard for paginated APIs); the divergence is transient and self-heals on the next request. Do **not** add a transaction or clamp to "fix" it.

Because the e2e suites share one database and run in parallel, **a pagination test must never assert `totalItems >= data.length`** against a table other suites write to (e.g. `user`): a parallel suite can insert a row between this query's `count()` and `find()`. Assert a race-free lower bound instead — e.g. request `limit=1` and check `totalItems >= <number of rows this suite seeded>`. See `test/users-list.e2e-spec.ts`. (The same assertion is safe in `products.e2e-spec.ts` only because no other suite writes products.)

### Events

`@nestjs/event-emitter` (backed by EventEmitter2) is registered globally via `EventEmitterModule.forRoot()` in `AppModule`. Use it to decouple fire-and-forget side-effects (email, future notifications) from the request path.

**Event name constants** live in `src/common/events/app-events.ts`. Always import from there — never use raw string literals in emitters or listeners.

**How it works:** `EventEmitter2.emit()` calls listeners synchronously but does **not** await their returned Promises. An `async` listener's work runs on the Node.js event loop after `emit()` returns, so the HTTP response is not blocked by SMTP.

**Listener registration:** listeners are plain `@Injectable()` classes decorated with `@OnEvent(AppEvents.*)`. Register them in their domain module's `providers` array — they do not need to be exported.

**Current events:**

| Event | Emitted by | Listener | Effect |
|---|---|---|---|
| `user.created` | `CreateUserProvider` | `UserEventsListener` | Sends email verification link |
| `contact.submitted` | `ContactProvider` | `ContactEventsListener` | Emails contact notification to site owner |

**Adding a new event:**
1. Add a constant to `AppEvents` in `src/common/events/app-events.ts`. Add a payload interface if the shape is non-trivial.
2. Inject `EventEmitter2` into the emitting provider and call `this.eventEmitter.emit(AppEvents.YOUR_EVENT, payload)`.
3. Create a listener class in the relevant module's `listeners/` directory with `@OnEvent(AppEvents.YOUR_EVENT)`.
4. Register the listener in the module's `providers` array.

### Mail

`src/mail` is a NestJS module for transactional email using raw nodemailer (SMTP) + EJS templates. Not global — import it explicitly. See `src/mail/CLAUDE.md` for module structure, how to add a new email type, template build configuration, and the current wiring between event listeners and mail providers.

### Uploads

See `src/uploads/CLAUDE.md` for module internals, the `UploadFile` entity, and the `StorageProvider` swap pattern. Key cross-module facts: `UploadsModule` exports both `UploadsService` and `StorageProvider`. `UsersModule` injects `StorageProvider` directly for avatar options (no `UploadFile` row). `PostsModule` and `ProductsModule` go through `UploadsService` so each image becomes a tracked `UploadFile` row — posts pass `{ postId }`, products pass `{ productId }` — and clean them up on deletion (posts on hard-delete, products on soft-delete). Both modules also support deleting a single already-uploaded image: `DELETE /posts/:id/images/:fileId` (EDITOR/AUTHOR/ADMIN, editors limited to their own posts; clears `featuredImage` if it pointed there) and `DELETE /products/:id/images/:fileId` (ADMIN-only; clears `imageUrl`/`images`). Avatars are the only consumer that stores a bare URL with no `UploadFile` row.

### Audit logging

`src/audit-log` writes a permanent record after every write operation. `AuditLogService.log()` swallows errors — it never blocks a request. See `src/audit-log/CLAUDE.md` for module structure, how to add audit logging to a new provider, and the signature-threading pattern. `AuditLogModule` must be imported in any domain module whose providers write audit records.

### TypeORM gotchas

- **Relations must use object syntax** (TypeORM v0.3 breaking change): `relations: { author: true, uploadFiles: true }` — the old array form `relations: ['author']` is silently ignored and returns `undefined` instead of the related entity.
- **Version is `typeorm@1.0.0`**, which **removed `loadRelationCountAndMap`**. To attach a relation count, run an explicit grouped count query (see `FindAllProductTypesProvider`) rather than reaching for that method.
- **Eager relations are not auto-loaded by a `QueryBuilder`** (only by repository `find*`). When using `createQueryBuilder`, `leftJoinAndSelect` the eager relation explicitly (see `FindAllProductsProvider`).

### Code style

- No semicolons, single quotes, `trailingComma: "all"` (`.prettierrc`); ESLint extends `typescript-eslint` recommendedTypeChecked + prettier. `no-explicit-any` and `no-unused-vars` are off; `no-floating-promises`/`no-unsafe-argument` are warnings only.
- After making edits, always run `pnpm run lint` — it runs `eslint --fix` which auto-applies all Prettier formatting. No known unfixable lint errors remain.
- Path aliasing: imports use the `src/...` absolute form (e.g. `src/users/users.module`) rather than deep relative paths, per `tsconfig.json` `baseUrl: "./"`.
- **Comments:** Add comments to providers, service methods, and constructor injections. Use single-line `// ...` for injections and JSDoc `/** ... */` for public methods. Write in plain English — full sentences, say what the code does and why, not how. No analogies. Before writing a comment, ask: would any developer on the team understand every word without looking it up? If not, rewrite it in simpler terms.
- **Task workflow:** For every change — add comments following the style above, decide whether unit and/or e2e tests are needed and write them, check whether the change could break existing tests and fix any that break, then run `pnpm run test` and `pnpm run test:e2e` and confirm both are fully green before marking the task done.
- **TypeScript build config:** Treat `tsconfig.build.json` as the source of truth for NestJS compilation. For build-only issues (such as generated files interfering with `rootDir`), fix `tsconfig.build.json` by excluding those files instead of modifying `tsconfig.json`. Only change `tsconfig.json` when the setting should apply to the entire TypeScript project — path aliases, strict mode, `target`, `moduleResolution`, `types`, etc. If the problem is `nest build` → check `tsconfig.build.json` first. If the problem is the IDE, `tsc`, or path aliases → check `tsconfig.json`.
