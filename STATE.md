# Backend Finalization State

This file is the single source of truth for what still needs to be built before the Svelte frontend (and later Flutter app) can be developed. Each feature includes the full picture: why it exists, how the existing codebase relates to it, and what exactly needs to be implemented. Check off tasks as they are completed.

## Project overview

NestJS 11 + TypeORM + PostgreSQL backend for a personal blog/portfolio. Auth is fully implemented (JWT, Google OAuth, email verification, password reset, refresh token dual delivery for browser + mobile). Posts, tags, uploads (Cloudinary), and user management are all in place. RBAC has four roles: USER, EDITOR, AUTHOR, ADMIN. All responses are wrapped in `{ apiVersion, data }` by `DataResponseInterceptor`. The global `ValidationPipe` strips and rejects unknown fields. Rate limiting (`ThrottlerGuard`) is the first guard in the pipeline.

The gaps below are features that either a portfolio site inherently needs (contact form, public profile) or features that complete the CMS experience so the Svelte frontend can actually manage content (draft visibility, tag editing, file cleanup).

---

## Priority 2 — CMS completeness

### 8. Tag PATCH (update)

**Why this exists:**
Tags can be created and (soft/hard) deleted but not edited. If a tag name has a typo, or the slug needs to change, the only option right now is to delete and recreate — which breaks any existing post associations because the tag ID changes. A simple PATCH endpoint prevents this data loss.

**Current state:**
`src/tags/tags.controller.ts` has `POST /tags` (create), `DELETE /tags/soft/:id` and `DELETE /tags/:id` (delete). `src/tags/providers/tags.service.ts` only has `create()`, `findAll()`, and both delete methods. There is no `update()` method anywhere. The existing `CreateTagDto` has all the right fields — we just need a `PartialType` wrapper to make them all optional for PATCH.

**What to build:**
`PATCH /tags/:id` — roles: AUTHOR, ADMIN (same as create/delete). DTO is `UpdateTagDto = PartialType(CreateTagDto)`. Provider looks up the tag by ID, applies the partial update, saves, and returns the updated entity. Returns 404 if the tag is not found. If a name or slug that's already taken is submitted, the DB unique constraint will throw — let TypeORM's error bubble up as a 409 or catch it explicitly and throw `ConflictException`.

**Files to touch:**
- `src/tags/dto/update-tag.dto.ts` — new DTO, `PartialType(CreateTagDto)`
- `src/tags/providers/update-tag.provider.ts` — new provider
- `src/tags/providers/tags.service.ts` — expose `update()` delegating to new provider
- `src/tags/tags.controller.ts` — add `PATCH /tags/:id`
- `src/tags/tags.module.ts` — register new provider

**E2E spec:** `test/tags-update.e2e-spec.ts`
- PATCH /tags/1 (as ADMIN) with `{ name: 'New Name' }` → 200, name updated
- PATCH /tags/1 (as USER) → 403
- PATCH /tags/999 → 404
- PATCH /tags/1 with a name already taken by another tag → 409

- [x] Create `UpdateTagDto = PartialType(CreateTagDto)`
- [x] Create `UpdateTagProvider`
- [x] Expose `update()` on `TagsService`
- [x] Add `PATCH /tags/:id` to `TagsController` with `@Roles(UserRole.AUTHOR, UserRole.ADMIN)`
- [x] Register provider in `TagsModule`
- [x] Write e2e spec (extended `test/tags/tags.e2e-spec.ts`)

---

## Priority 3 — Upload management

### 9. Delete standalone upload

**Why this exists:**
Currently, uploads are only deleted when the post they are linked to is deleted (via the cascade in `RemovePostProvider` which calls `DeleteFileProvider`). But uploads made via `POST /uploads` (the generic upload endpoint, not the post-image one) are standalone — their `postId` is null and they are never automatically cleaned up. An EDITOR or AUTHOR who uploaded a wrong file has no way to delete it. Over time this creates orphaned Cloudinary assets and cluttered DB rows.

**Current state:**
`src/uploads/providers/delete-file.provider.ts` already exists and handles both the Cloudinary deletion (`cloudinary.uploader.destroy(publicId)`) and the DB row removal. It's used by `RemovePostProvider`. We just need to expose it through a new controller route with an ownership check.

**Ownership rule:** EDITOR can only delete uploads they own (`userId === activeUser.sub`). AUTHOR and ADMIN can delete any upload. This mirrors the same ownership pattern used in `UpdatePostProvider` for posts.

**Files to touch:**
- `src/uploads/providers/find-one-upload.provider.ts` — new provider to look up a single UploadFile by ID (needed for ownership check before deletion)
- `src/uploads/uploads.controller.ts` — add `DELETE /uploads/:id`
- `src/uploads/uploads.service.ts` (or equivalent facade) — expose `deleteById()` method
- `src/uploads/uploads.module.ts` — register new provider if needed

**E2E spec:** `test/uploads-delete.e2e-spec.ts`
- DELETE /uploads/:id (as ADMIN) → 200, upload gone from DB
- DELETE /uploads/:id (as EDITOR, own upload) → 200
- DELETE /uploads/:id (as EDITOR, upload owned by another user) → 403
- DELETE /uploads/999 (non-existent) → 404

- [ ] Create `FindOneUploadProvider` (lookup by ID)
- [ ] Add `deleteById()` method to uploads service/facade
- [ ] Add `DELETE /uploads/:id` to `UploadsController` with EDITOR/AUTHOR/ADMIN roles and ownership check
- [ ] Write e2e spec

---

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
- **Refresh token revocation** — Right now old refresh tokens remain valid until they expire (24h). A revocation list (Redis or DB table) would enable logout-all-devices. Deferred because it adds a Redis dependency.
- **Audit logging** — No trail of who did what. Nice for admin dashboards but not needed to launch.
- **`startDate`/`endDate` filters on `GET /posts`** — `GetPostsDto` declares these two optional fields (validated, Swagger-visible) but `FindAllPostsProvider` never reads them — only `page` and `limit` are passed to `paginateQuery`. The filters silently do nothing. Wire them up when date-range filtering is actually needed by the frontend.

---

## Post-implementation checklist

Run these after finishing all features above:

- [ ] `pnpm run build` — TypeScript compilation must pass with zero errors
- [ ] `pnpm run lint` — ESLint + Prettier auto-fix; no unfixable errors (the only known unfixable error is the stale `src/app.controller.spec.ts`)
- [ ] `pnpm run test` — all unit tests green
- [ ] `pnpm run test:e2e` — all new e2e specs pass (requires `.env.test` pointing at the test DB `nest_portfolio_test`)
- [ ] `pnpm run generate:types` — regenerate `openapi-types.ts`; open it and confirm the new endpoints appear with correct request/response types
- [ ] Manually smoke-test via Swagger at `/api`: tag update, upload list, upload delete, post filters
