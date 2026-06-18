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
pnpm run test:e2e            # jest using test/jest-e2e.json (test/**/*.e2e-spec.ts) — sets NODE_ENV=test automatically, requires .env.test pointing at a separate DB (DB_NAME=nest_portfolio_test)
pnpm run test:debug          # node --inspect-brk for debugging a jest run

pnpm run doc                 # compodoc, served on port 3001, output to ./documentation

pnpm run seed:admin          # create or promote the first admin user (reads NODE_ENV=development)
```

Run a single unit test file: `pnpm jest path/to/file.spec.ts` (or `pnpm exec jest -t "test name"`).
Run a single e2e test file: `pnpm jest --config ./test/jest-e2e.json path/to/file.e2e-spec.ts`.

See `test/CLAUDE.md` for the e2e helper infrastructure and spec-writing conventions.

Swagger/OpenAPI docs are served at `/api` once the app is running (see `main.ts`).

`src/app.create.ts` (beside `main.ts`) contains all post-creation setup: global pipes, Swagger, CORS, and `app.listen()`. `main.ts` just calls `NestFactory.create(AppModule)` then delegates to `appCreate(app)`. Change global middleware or port config there, not in `main.ts`.

## Environment configuration

Env file selection is driven by `NODE_ENV`: `.env` when unset, otherwise `.env.<NODE_ENV>` (see `app.module.ts`). `.env.example` documents the required variables; `environment.validation.ts` (Joi) is the source of truth for which variables are required vs. defaulted — check it before adding new env vars instead of guessing. Required: DB_PASSWORD, DB_USER, DB_NAME, DB_HOST, JWT_SECRET, JWT_TOKEN_AUDIENCE, JWT_TOKEN_ISSUER, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, API_VERSION, CLOUDINARY_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, MAIL_HOST, MAIL_USER, MAIL_PASSWORD, MAIL_FROM.

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

## Architecture

NestJS (v11) + TypeORM + PostgreSQL blog/portfolio API. Module-per-domain layout: `users`, `posts`, `tags`, `meta-options`, `auth` (with a nested `social` sub-feature for Google), plus cross-cutting `common` and `config` directories.

Within each domain module the convention is: `*.module.ts` → `*.controller.ts` → `providers/*.service.ts`, where the service is a **thin facade** that delegates to single-purpose provider classes for individual operations. Each provider handles exactly one responsibility (e.g. `create-post.provider.ts`, `find-one-post.provider.ts`, `remove-post.provider.ts`). DTOs live in `dto(s)/`, TypeORM entities in `entities/`.

Entity relations:
- `User` 1—N `Post` (eager-loaded author on `Post`)
- `Post` 1—1 `MetaOption` (cascade + eager)
- `Post` N—N `Tag` (eager, owning side with `@JoinTable`)
- `Post` 1—N `UploadFile` (non-eager — only loaded explicitly, e.g. on post deletion for cleanup)
- `User` 1—N `UploadFile` (non-nullable — every upload is tied to the uploading user)

### Request pipeline (global, wired in `app.module.ts`)

1. **`AuthenticationGuard`** (`APP_GUARD`, first) reads `AuthType[]` metadata set by `@Auth(...)` (`src/auth/decorators/auth.decorator.ts`); defaults to `[AuthType.Bearer]` if absent. Maps each type to a guard (`Bearer` → `AccessTokenGuard`, `None` → always-allow) and tries them in order. To make a route public, decorate with `@Auth(AuthType.None)`.
2. **`AccessTokenGuard`** extracts a bearer token, verifies it via `JwtService`, and attaches the decoded payload to the request under `REQUEST_USER_KEY` (`src/auth/constants/auth.constants.ts`). Read the current user in controllers via `@ActiveUser()` (`src/auth/decorators/active-user.decorator.ts`).
3. **`RolesGuard`** (`APP_GUARD`, second) reads `UserRole[]` metadata set by `@Roles(...)` (`src/auth/decorators/roles.decorator.ts`). If no `@Roles()` is set, the guard passes. If roles are required but no user is on the request, access is denied. See `src/auth/CLAUDE.md` for full RBAC details.
4. **`DataResponseInterceptor`** (`APP_INTERCEPTOR`, registered first) wraps every response as `{ apiVersion, data }`. Controllers return plain data — do not wrap manually.
5. **`ClassSerializerInterceptor`** (`APP_INTERCEPTOR`, registered second) runs on the raw controller output before `DataResponseInterceptor` wraps it. This activates `@Exclude()` and `@Expose()` decorators on entities globally. See the Serialization section below for the groups pattern used on `User`.
6. A global `ValidationPipe` (`src/app.create.ts`) runs with `whitelist: true, forbidNonWhitelisted: true, transform: true` — extra fields in request bodies are stripped, undeclared fields rejected.

### Auth

- Local sign-in: `auth/providers/sign-in.provider.ts` + `bcrypt.provider.ts` (implements `HashingProvider` abstract class via DI token).
- Tokens: `generate-tokens.provider.ts` issues access+refresh JWTs. The access token payload includes `sub` (userId), `email`, and `role`. The refresh token carries only `sub`.
- Google OAuth: `auth/social/google-authentication.controller.ts` + `social/providers/google-authentication.service.ts` verify Google ID tokens, then create/find a local user. Both local and Google users are always created with `role: UserRole.USER` — roles must be elevated explicitly by an admin.
- `AuthModule` uses `forwardRef(() => UsersModule)` because of a circular dependency — keep that in mind if you touch either module's imports/exports. See `src/auth/CLAUDE.md` for details.
- RBAC: four roles (`USER`, `EDITOR`, `AUTHOR`, `ADMIN`) defined in `src/auth/enums/user-role.enum.ts`. See `src/auth/CLAUDE.md` for the full access control rules.

### Users routes

| Route | Auth | Notes |
|---|---|---|
| `POST /users` | None (public) | Registration — triggers email verification flow |
| `GET /users` | ADMIN | Paginated list |
| `GET /users/me` | Bearer (any role) | Returns the caller's own profile |
| `GET /users/:id` | ADMIN | Lookup any user by ID — **not** accessible to regular users; use `/me` for self |
| `PATCH /users/avatar` | Bearer (any role) | Uploads and replaces the caller's avatar |
| `PATCH /users/:id/role` | ADMIN | Elevate or downgrade a user's role |
| `DELETE /users/:id` | ADMIN | Remove a user |

`GET /users/me` must be declared before `GET /users/:id` in the controller so NestJS routes the literal segment `me` before trying to parse it as an integer ID via `ParseIntPipe`.

### Posts — public routes and draft visibility

Public blog routes are decorated with `@Auth(AuthType.None)` and only return posts with `status = published`. Draft, scheduled, and review posts are never exposed to unauthenticated callers — they appear as 404.

- `GET /posts` — paginated list of published posts
- `GET /posts/:id` — single published post by database ID
- `GET /posts/slug/:slug` — single published post by slug (via `FindPostBySlugProvider`)

The status filter is applied in `FindAllPostsProvider` (via the `where` param on `paginateQuery`) and `FindOnePostProvider.findOnePublishedByIdOrFail`. The internal `findOneByIdOrFail` method (used by update/delete/image-upload providers) is unchanged and returns any status — authenticated operations need to see drafts.

### Serialization

`ClassSerializerInterceptor` is global. Entity fields control their own visibility via class-transformer decorators.

**`User` entity field visibility:**

| Field | Decorator | Visible to |
|---|---|---|
| `password`, `googleId` | `@Exclude()` | nobody |
| `email`, `role` | `@Expose({ groups: ['admin'] })` | only when 'admin' group is active |
| `id`, `firstName`, `lastName`, `avatarUrl` | none | everyone |

`UsersController` is decorated with `@SerializeOptions({ groups: ['admin'] })`, so all its responses include `email` and `role`. `PostsController` has no `@SerializeOptions`, so the author object embedded in post responses only contains the public fields.

If a new controller or endpoint needs to expose admin-only fields, add `@SerializeOptions({ groups: ['admin'] })` to it.

### Pagination

`common/pagination` exports a request-scoped `PaginationProvider` (injects `REQUEST` to build absolute `first/last/current/next/prev` links). Domain services call `paginationProvider.paginateQuery(paginationQueryDto, repository, where?)` rather than reimplementing pagination per module. The optional `where` parameter filters both the result set and the total count used for page calculations.

### Mail

`src/mail` is a dedicated module for transactional email. It uses raw `nodemailer` (SMTP) + EJS templates. `MailModule` is not global — import it explicitly in any feature module that needs to send email.

**Structure:**
- `mail.config.ts` — `registerAs('mail', ...)` namespace; reads `MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE`, `MAIL_USER`, `MAIL_PASSWORD`, `MAIL_FROM` from env.
- `providers/nodemailer.provider.ts` — custom DI token `NODEMAILER_TRANSPORTER`; creates the nodemailer transporter once via `useFactory`.
- `providers/send-mail.provider.ts` — core send logic: renders an EJS template then calls `transporter.sendMail()`. Template path resolves to `dist/mail/templates/<name>.ejs` at runtime.
- `providers/send-welcome-mail.provider.ts` — dedicated provider for the welcome email; calls `SendMailProvider` with `template: 'welcome'`.
- `mail.service.ts` — thin facade; currently exposes `sendMail(options)` and `sendWelcomeMail({ email, firstName })`.
- `templates/` — EJS files; one per email type (e.g. `welcome.ejs`). Variables are injected via the `context` field of `MailOptions`.

**Adding a new email type:**
1. Add a `<name>.ejs` file in `src/mail/templates/`.
2. Create `src/mail/providers/send-<name>-mail.provider.ts` — inject `SendMailProvider`, call `.send()` with the right template and context.
3. Register the new provider in `mail.module.ts` `providers: [...]`.
4. Add a `send<Name>Mail()` method to `MailService` that delegates to the new provider.

**Templates and build:** `nest-cli.json` is configured with `assets: [{ include: "mail/templates/**/*.ejs", watchAssets: true }]` so EJS files are copied to `dist/` on build and watched in dev mode. If you add a new template subdirectory, update the glob in `nest-cli.json`.

**Dev testing:** Use [Mailtrap](https://mailtrap.io) sandbox — set `MAIL_HOST=sandbox.smtp.mailtrap.io`, `MAIL_PORT=2525`, `MAIL_SECURE=false` and your Mailtrap credentials in `.env.development`. Sent emails appear in the Mailtrap inbox without reaching real recipients.

**Current wiring:** `UsersModule` imports `MailModule`. `CreateUserProvider` calls `mailService.sendWelcomeMail()` after saving a new user.

### Uploads

`src/uploads` is a dedicated, reusable module for Cloudinary image uploads. It exports `UploadsService`, which is consumed by `PostsModule` and `UsersModule`.

- `UploadFile` entity (`src/uploads/entities/upload-file.entity.ts`) records every upload: `name`, `path` (Cloudinary `secure_url`), `publicId`, `type` (`FileType` enum), `mime`, `size`, `userId`, and optional `postId`. When `postId` is set, the upload is linked to that post and will be deleted from Cloudinary when the post is deleted.
- `UploadsService` is split into two providers: `UploadFileProvider` (validates buffer magic bytes, uploads to storage, persists the row) and `DeleteFileProvider` (looks up by URL, deletes from Cloudinary, removes the DB row).
- `StorageProvider` is an abstract class (not an interface) so it can serve as a NestJS DI token at runtime. `CloudinaryProvider` is its only current implementation, registered via `{ provide: StorageProvider, useClass: CloudinaryProvider }` in `UploadsModule`. Swap backends by changing only that line.
- Generic upload route: `POST /uploads` — requires `EDITOR / AUTHOR / ADMIN` role, multipart field `file`, 5MB cap, image types only.
- Post image upload route: `POST /posts/:id/images` — requires `EDITOR / AUTHOR / ADMIN`. EDITORs can only upload to their own posts. Returns the `UploadFile` record; the client decides whether to use the URL as `featuredImage` via `PATCH /posts/:id`.
- Avatar upload route: `PATCH /users/avatar` — any authenticated user, no role restriction.

### TypeORM gotchas

- **Relations must use object syntax** (TypeORM v0.3 breaking change): `relations: { author: true, uploadFiles: true }` — the old array form `relations: ['author']` is silently ignored and returns `undefined` instead of the related entity.

### Code style

- No semicolons, single quotes, `trailingComma: "all"` (`.prettierrc`); ESLint extends `typescript-eslint` recommendedTypeChecked + prettier. `no-explicit-any` and `no-unused-vars` are off; `no-floating-promises`/`no-unsafe-argument` are warnings only.
- After making edits, always run `pnpm run lint` — it runs `eslint --fix` which auto-applies all Prettier formatting. The only expected unfixable error is the stale `src/app.controller.spec.ts`.
- Path aliasing: imports use the `src/...` absolute form (e.g. `src/users/users.module`) rather than deep relative paths, per `tsconfig.json` `baseUrl: "./"`.
