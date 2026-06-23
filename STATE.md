# Backend Finalization State

This file is the single source of truth for what still needs to be built before the Svelte frontend (and later Flutter app) can be developed. Each feature includes the full picture: why it exists, how the existing codebase relates to it, and what exactly needs to be implemented. Check off tasks as they are completed.

## Project overview

NestJS 11 + TypeORM + PostgreSQL backend for a personal blog/portfolio. Auth is fully implemented (JWT, Google OAuth, email verification, password reset, refresh token dual delivery for browser + mobile). Posts, tags, uploads (Cloudinary), and user management are all in place. RBAC has four roles: USER, EDITOR, AUTHOR, ADMIN. All responses are wrapped in `{ apiVersion, data }` by `DataResponseInterceptor`. The global `ValidationPipe` strips and rejects unknown fields. Rate limiting (`ThrottlerGuard`) is the first guard in the pipeline.

The gaps below are features that either a portfolio site inherently needs (contact form, public profile) or features that complete the CMS experience so the Svelte frontend can actually manage content (draft visibility, tag editing, file cleanup).

---

## Priority 2 — Bugs & correctness (fix before frontend starts)

### 13. Fix `UsersService.findAll()` — pagination params are silently ignored

**Why this exists:**
`GET /users` accepts `?limit` and `?page` query params and the controller passes them to `UsersService.findAll(limit, page)`. But the service implementation ignores both:

```typescript
public findAll(limit: number, page: number) {
  return this.userRepository.find()  // no take/skip
}
```

Every call returns all users with no cap, regardless of what pagination values are sent. This is inconsistent with how posts, tags, and every other collection endpoint works (all use `PaginationProvider`).

**What to do:**
Wire `findAll()` through `PaginationProvider` the same way posts do it. Inject `PaginationProvider` into `UsersService` (or a new `FindAllUsersProvider`) and call `paginateQuery({ limit, page }, userRepository)`.

**Files to touch:**
- `src/users/providers/users.service.ts` — pass limit/page to a real paginated query
- Optionally extract `src/users/providers/find-all-users.provider.ts` (follows existing pattern)

- [ ] Replace `userRepository.find()` with a paginated query using `PaginationProvider`
- [ ] Ensure response shape matches other paginated endpoints (`data`, `meta`, `links`)

---

### 14. Terminus health check

**Why this exists:**
`GET /health` returns `{ status: 'ok' }` unconditionally. Coolify uses this endpoint for container health polling, but it will report the container as healthy even if PostgreSQL is unreachable.

**What to do:**
Install `@nestjs/terminus` and replace the health controller with one that runs a TypeORM ping. A DB failure should return HTTP 503 so Coolify restarts the container instead of routing traffic to it.

```bash
pnpm add @nestjs/terminus
```

**Files to touch:**
- `src/app.controller.ts` — replace the current `GET /health` with Terminus `HealthCheckService` + `TypeOrmHealthIndicator`
- `src/app.module.ts` — import `TerminusModule`

- [ ] Install `@nestjs/terminus`
- [ ] Replace health endpoint with TypeORM ping
- [ ] Verify Coolify health poll still hits `GET /health`

---

## Priority 3 — Upload management

### 10. List own uploads

**Why this exists:**
The Svelte CMS editor needs a media library so authors can browse previously uploaded images and reuse them (e.g. selecting a `featuredImage` from existing uploads instead of re-uploading). Right now there is no `GET /uploads` endpoint — uploads are write-only from the frontend's perspective.

**Current state:**
The `UploadFile` entity has `userId` (who uploaded it) and `postId` (which post it belongs to, nullable). A list endpoint should let EDITOR/AUTHOR see their own uploads, while ADMIN can see all uploads. Both should be paginated using the existing `PaginationProvider`.

**What to build:**
`GET /uploads` — roles: EDITOR, AUTHOR, ADMIN. Paginated (`limit`, `page` from `PaginationQueryDto`). EDITOR and AUTHOR: `where { user: { id: activeUser.sub } }`. ADMIN: no `where` filter (all uploads). Returns `UploadFile` entities with `id`, `name`, `path`, `mime`, `size`, `type`, `createdAt`.

**Files to touch:**
- `src/uploads/providers/find-all-uploads.provider.ts` — new provider
- `src/uploads/uploads.controller.ts` — add `GET /uploads`
- `src/uploads/uploads.module.ts` — register new provider

**E2E spec:** `test/uploads-list.e2e-spec.ts`
- GET /uploads (as ADMIN) → 200, paginated list of all uploads
- GET /uploads (as EDITOR) → only own uploads, not other users'
- GET /uploads (unauthenticated) → 401
- GET /uploads (as USER role) → 403

- [ ] Create `FindAllUploadsProvider`
- [ ] Add `GET /uploads` to `UploadsController` with EDITOR/AUTHOR/ADMIN roles
- [ ] Write e2e spec

---

## Deferred (post-launch)

These are real features but out of scope until the frontend is running and real usage patterns are clear.

- **Scheduled post auto-publishing** — The `publishOn` field is stored on `Post` but nothing acts on it. A cron job (e.g. `@nestjs/schedule`) would query for posts where `status = SCHEDULED AND publishOn <= now()` and flip them to `PUBLISHED`. Deferred because it adds infrastructure complexity and isn't needed to launch.
- **Comments** — No entity, no routes. Significant scope — needs moderation, notifications, threading.
- **Post likes/reactions** — No engagement tracking at all. Needs its own entity and auth-aware endpoints.
- **Newsletter subscribers** — A subscriber list entity and a subscribe/unsubscribe endpoint. Not needed until there is content to send.
- **Refresh token revocation** — Right now old refresh tokens remain valid until they expire (24h). A revocation list (Redis or DB table) would enable logout-all-devices. The no-Redis approach: a `refresh_token_revocations` DB table `(jti, expiresAt)`, a `jti` claim added to refresh tokens in `GenerateTokensProvider`, and a lookup in `RefreshTokensProvider` before issuing new tokens. A daily cron cleans up expired rows. Deferred for now, but prioritise before real employee accounts exist on a production company site.
- **Audit logging** — No trail of who did what. Nice for admin dashboards but not needed to launch.
- **`startDate`/`endDate` filters on `GET /posts`** — `GetPostsDto` declares these two optional fields (validated, Swagger-visible) but `FindAllPostsProvider` never reads them. The filters silently do nothing, which is a misleading API contract. Either wire them into the `where` clause (`Between(startDate, endDate)` on a `createdAt` or `publishOn` column) or remove them from the DTO entirely. Leaving them half-declared is the worst option.
- **Async email** — `CreateUserProvider` and `ContactProvider` send email synchronously, blocking the HTTP response until the SMTP handshake completes. If the mail server is slow or down, requests hang. The lightweight fix is `@nestjs/event-emitter`: providers emit events (`user.created`, `contact.submitted`) and listeners handle mail out-of-band. No Redis or Bull queue needed. Deferred because Mailtrap is reliable enough in dev, but should be wired before production launch.
- **`GET /tags` response cap** — `TagsService.findAll()` runs `repository.find()` with no limit, returning all tags in one query. Safe for now, worth adding a simple `take: 200` cap before launch.
- **Full-text search** — No `GET /posts?q=keyword` endpoint exists. PostgreSQL supports full-text search natively via `tsvector`/`tsquery` — no Elasticsearch needed at this scale. A `GIN`-indexed generated column on `title + content` would support fast keyword queries. Deferred until there is enough content for search to be useful.

---

## Post-implementation checklist

Run these after finishing all features above:

- [ ] `pnpm run build` — TypeScript compilation must pass with zero errors
- [ ] `pnpm run lint` — ESLint + Prettier auto-fix; no unfixable errors (the only known unfixable error is the stale `src/app.controller.spec.ts`)
- [ ] `pnpm run test` — all unit tests green
- [ ] `pnpm run test:e2e` — all new e2e specs pass (requires `.env.test` pointing at the test DB `nest_portfolio_test`)
- [ ] `pnpm run generate:types` — regenerate `openapi-types.ts`; open it and confirm the new endpoints appear with correct request/response types
- [ ] Manually smoke-test via Swagger at `/api`: tag update, upload list, post filters
