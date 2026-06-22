# Backend Finalization State

This file is the single source of truth for what still needs to be built before the Svelte frontend (and later Flutter app) can be developed. Each feature includes the full picture: why it exists, how the existing codebase relates to it, and what exactly needs to be implemented. Check off tasks as they are completed.

## Project overview

NestJS 11 + TypeORM + PostgreSQL backend for a personal blog/portfolio. Auth is fully implemented (JWT, Google OAuth, email verification, password reset, refresh token dual delivery for browser + mobile). Posts, tags, uploads (Cloudinary), and user management are all in place. RBAC has four roles: USER, EDITOR, AUTHOR, ADMIN. All responses are wrapped in `{ apiVersion, data }` by `DataResponseInterceptor`. The global `ValidationPipe` strips and rejects unknown fields. Rate limiting (`ThrottlerGuard`) is the first guard in the pipeline.

The gaps below are features that either a portfolio site inherently needs (contact form, public profile) or features that complete the CMS experience so the Svelte frontend can actually manage content (draft visibility, tag editing, file cleanup).

---

## Priority 1 — Critical (portfolio must-haves)

### 1. User bio field

**Why this exists:**
The `User` entity currently only has `firstName`, `lastName`, and `avatarUrl` as profile fields. For a portfolio "About Me" page and author cards on blog posts, a short bio paragraph is needed. Website URL and social links were considered but removed from scope — the USER role doesn't need them, and adding them now would be premature.

**Current state:**
`src/users/entities/user.entity.ts` — no `bio` column exists. `PATCH /users/me` uses `PatchUserProfileDto` which only accepts `firstName` and `lastName`. All `UsersController` responses have `@SerializeOptions({ groups: ['admin'] })` active at the class level, so any new field added to the entity without an `@Expose({ groups })` restriction will automatically appear in responses — no extra serialization config needed.

**What to build:**
One new nullable column on `User`: `bio` (PostgreSQL `text` type, nullable, default null). `text` has no DB-level length limit — the limit is enforced only in the DTO.

`bio` DTO constraints in `PatchUserProfileDto`:
- `@IsOptional()` — field can be absent from the request body entirely
- `@IsString()` — must be a string if present
- `@MaxLength(500)` — 500 characters is enough for a short intro; longer becomes a page, not a bio
- `@Transform(({ value }) => value?.trim() || null)` — trim whitespace and convert empty string to `null` so that clearing the bio stores `null` cleanly instead of `""`

**Safety note for the frontend:** The DTO only validates it is a string — it does not strip HTML tags. The Svelte and Flutter frontends must render `bio` as plain text (not raw HTML) to prevent XSS.

**Files to touch:**
- `src/users/entities/user.entity.ts` — add `bio` column
- `src/users/dtos/patch-user-profile.dto.ts` — add optional `bio` field with constraints
- `src/database/migrations/` — generate `AddUserBioField`

**E2E spec:** `test/users-profile-fields.e2e-spec.ts`
- PATCH /users/me with bio → 200, bio returned in response
- GET /users/me → bio field present in data
- PATCH /users/me with bio exceeding 500 chars → 400
- PATCH /users/me with `bio: ""` → 200, stored as null (trimmed to empty, converted to null)

- [x] Add `bio` (text, nullable, default null) to `User` entity
- [x] Generate + run migration: `pnpm run typeorm migration:generate src/database/migrations/AddUserBioField -d src/database/data-source.ts`
- [x] Extend `PatchUserProfileDto` with optional `bio` field (IsOptional, IsString, MaxLength 500, Transform trim/null)
- [x] Write e2e spec (`test/users/users-profile-fields.e2e-spec.ts` — 7 tests passing)

---

### 2. Predefined avatar selection (Cloudinary-hosted)

**Why this exists:**
The existing `PATCH /users/avatar` accepts a file upload (multipart), pushes it to Cloudinary, creates an `UploadFile` DB row, and stores the URL in `user.avatarUrl`. This is the right design for content editors managing post images, but wrong for regular users — it gives any USER-role account unlimited Cloudinary storage with no guardrails.

The correct pattern for user accounts: pre-upload a fixed set of avatar illustrations to Cloudinary **once**, hardcode their URLs in a backend constants file, and let users pick one by key. The value stored in `avatarUrl` is still a Cloudinary URL — so both Svelte and Flutter just render `<img src={user.avatarUrl}>` with no local image mapping. Cloudinary CDN and transformations work automatically.

**One-time developer setup (not automated):**
Upload 8–12 avatar image files manually via the Cloudinary dashboard (numbered SVGs or illustrations). Copy each `secure_url` into the constants file. These assets are never touched by user actions.

**What to build:**

1. **`src/users/constants/avatar-options.ts`**  
   Exports `AVATAR_OPTIONS: { key: string, label: string, url: string }[]`.  
   The `url` is the Cloudinary `secure_url` for that avatar. Keys are short strings like `'avatar-1'` through `'avatar-8'`. The frontend renders them directly as image sources.

2. **`GET /users/avatar-options`** — `@Auth(AuthType.None)` (public), no DB hit, returns `AVATAR_OPTIONS`. Both Svelte and Flutter call this to render the avatar picker — URLs are immediately usable as `<img src>`.

3. **`PATCH /users/avatar`** — rewrite from multipart file upload to JSON body:
   - Remove `@UseInterceptors(FileInterceptor)`, `@ApiConsumes('multipart/form-data')`, `ParseFilePipe`, and all file validators
   - New DTO: `SelectAvatarDto { avatarKey: string }` — `@IsIn(AVATAR_OPTIONS.map(o => o.key))` rejects any unknown key
   - New provider `SelectAvatarProvider`: find user, look up `AVATAR_OPTIONS` by key, set `user.avatarUrl = option.url`, save. No Cloudinary call at request time, no `UploadFile` row.
   - The `avatarUrl` column is `varchar(2048)` — unchanged, still stores a Cloudinary URL

4. **`UploadsModule` import in `UsersModule`:** After this change, avatars no longer go through `UploadsService`. Verify no other provider in `UsersModule` needs it, then remove the `UploadsModule` import to keep the dependency graph clean. (Email verification and password reset are in `UsersModule` too — confirm they don't use `UploadsService`.)

**Files to touch:**
- `src/users/constants/avatar-options.ts` — new file (fill `url` values after one-time Cloudinary upload)
- `src/users/dtos/select-avatar.dto.ts` — new DTO
- `src/users/providers/select-avatar.provider.ts` — new provider, replaces `UploadAvatarProvider` logic
- `src/users/providers/upload-avatar.provider.ts` — delete or repurpose (no longer needed for USER avatar flow)
- `src/users/providers/users.service.ts` — replace `uploadAvatar()` with `selectAvatar()`
- `src/users/users.controller.ts` — rewrite `PATCH /users/avatar`, add `GET /users/avatar-options`
- `src/users/users.module.ts` — register `SelectAvatarProvider`, remove `UploadAvatarProvider`, check if `UploadsModule` import can be removed

**E2E spec:** `test/users-avatar-selection.e2e-spec.ts`
- GET /users/avatar-options (unauthenticated) → 200, array of `{ key, label, url }` with non-empty url strings
- PATCH /users/avatar with valid `avatarKey` (authenticated) → 200, `user.avatarUrl` equals the Cloudinary URL for that key from `AVATAR_OPTIONS`
- PATCH /users/avatar with unknown `avatarKey` → 400
- PATCH /users/avatar (unauthenticated) → 401
- GET /users/me after selection → `avatarUrl` reflects the selected Cloudinary URL

**Note on mocks:** No new mocks needed in `create-app.helper.ts` — avatar selection makes no external calls at request time.

- [x] Create `src/users/constants/avatar-options.ts` (8 entries, placeholder Cloudinary URLs)
- [x] Create `src/users/dtos/select-avatar.dto.ts` with `@IsIn(AVATAR_OPTIONS.map(o => o.key))`
- [x] Create `src/users/providers/select-avatar.provider.ts`
- [x] Delete `src/users/providers/upload-avatar.provider.ts`
- [x] Update `users.service.ts` — swap `UploadAvatarProvider` → `SelectAvatarProvider`, replace `uploadAvatar()` with `selectAvatar()`
- [x] Update `users.controller.ts` — rewrite `PATCH /users/avatar` to JSON body, add `GET /users/avatar-options` public route
- [x] Update `users.module.ts` — swap provider, remove `UploadsModule` import
- [x] Fix pre-existing `bcrypt.provider.ts` TS errors (cast `data as string` in hash + compare calls)
- [x] Build passes, lint clean
- [x] Write + run e2e spec (`test/users/users-avatar-selection.e2e-spec.ts` — 5 tests passing)
- [ ] **Developer action required:** Upload 8 avatar illustrations to Cloudinary and replace placeholder URLs in `src/users/constants/avatar-options.ts`

---

### 3. Public author profile endpoint

**Why this exists:**
The Svelte frontend will have public-facing author pages (e.g. `/authors/1`) and author cards on each blog post. The current `GET /users/:id` endpoint is ADMIN-only — unauthenticated visitors cannot fetch any user's public info. There is also `GET /users/me` but that requires the user to be logged in. We need a route that anyone (including Flutter app visitors) can call to get a safe subset of a user's profile.

**Current state:**
`UsersController` has `@SerializeOptions({ groups: ['admin'] })` at the class level, meaning every route in it — including any new public one — would expose `email`, `role`, and `isEmailVerified` to the caller. We must NOT rely on the class-level serialization here. The solution is a handler with an explicit `@SerializeOptions({ excludeExtraneousValues: true })` override combined with a dedicated `PublicUserProfileDto` that only `@Expose()`s safe fields — this resets the groups and locks down what the response contains regardless of what the entity has.

**What to build:**
`GET /users/:id/profile` — `@Auth(AuthType.None)` (public), returns only the safe fields: `id`, `firstName`, `lastName`, `avatarUrl` (Cloudinary URL of selected avatar), `bio`. Must NOT return `email`, `role`, `isEmailVerified`, password tokens, or any other internal fields. Reuses `FindOneUserProvider` (already exists) for the DB lookup — no new provider needed. Returns 404 if the user does not exist. Route `/:id/profile` does not conflict with `/:id` because the second segment disambiguates it.

**Files to touch:**
- `src/users/dtos/public-user-profile.dto.ts` — new DTO with only `@Expose()` on id, firstName, lastName, avatarUrl, bio
- `src/users/users.controller.ts` — add `GET /users/:id/profile` with `@Auth(AuthType.None)` and `@SerializeOptions({ excludeExtraneousValues: true })`

**E2E spec:** `test/users-public-profile.e2e-spec.ts`
- GET /users/1/profile (unauthenticated) → 200, contains id, firstName, lastName, avatarUrl, bio
- GET /users/1/profile → does NOT contain email, role, isEmailVerified, password (check explicitly)
- GET /users/999/profile → 404

**Revised approach (implemented):** No DTO needed. `@SerializeOptions({ groups: ['public'] })` on the handler overrides the class-level `{ groups: ['admin'] }`. Un-decorated fields (id, firstName, lastName, avatarUrl, bio) appear normally. Admin-gated fields (email, role, isEmailVerified) are hidden. `@Exclude()` fields (password, tokens) are always hidden. Role check: `if (user.role === UserRole.USER) throw NotFoundException` — regular accounts are not publicly discoverable.

- [x] Add `GET /users/:id/profile` to `UsersController` with `@Auth(AuthType.None)` and `@SerializeOptions({ groups: ['public'] })`
- [x] Write e2e spec (`test/users/users-public-profile.e2e-spec.ts` — 5 tests passing)

---

### 4. Contact form endpoint

**Why this exists:**
Every portfolio site needs a contact form. Visitors (clients, recruiters, collaborators) need a way to reach the owner without knowing their email address. Currently the backend has no public submission endpoint of any kind outside of auth flows. This is the single biggest functional gap for a portfolio use case.

**What to build:**
A new `ContactModule` at `src/contact/`. It has three responsibilities: validate and persist the submission, send a notification email to the site owner, and rate-limit aggressively to prevent spam.

The `ContactSubmission` entity stores every submission permanently so the owner can review them later (useful if an email is missed). The notification email goes to the owner's address (read from an env var like `ADMIN_EMAIL` or just `MAIL_FROM`). The contact form itself is public (`@Auth(AuthType.None)`) and throttled at 3 requests per 300 seconds per IP — stricter than most endpoints because it directly triggers email sending.

The mail template (`contact.ejs`) is a simple HTML email showing the sender's name, email, subject, and message body. `SendContactNotificationProvider` in `src/mail/providers/` handles rendering and sending; it must be registered in `MailModule` and `MailService` must expose a `sendContactNotification()` method. `ContactModule` imports `MailModule` to get access to `MailService`.

**New env var:** May need `ADMIN_CONTACT_EMAIL` (the address that receives contact notifications) unless we reuse `MAIL_FROM`. Add to `environment.validation.ts` if a new var is needed.

**Files to touch:**
- `src/contact/contact.module.ts` — new module, import MailModule
- `src/contact/entities/contact-submission.entity.ts` — new entity
- `src/contact/dtos/create-contact.dto.ts` — name, email, subject, message all required
- `src/contact/providers/contact.provider.ts` — save + send
- `src/contact/contact.controller.ts` — POST /contact, public, throttled
- `src/app.module.ts` — import ContactModule
- `src/database/migrations/` — generate `AddContactSubmissionsTable`
- `src/mail/templates/contact.ejs` — new email template
- `src/mail/providers/send-contact-notification.provider.ts` — new mail provider
- `src/mail/mail.module.ts` — register new provider
- `src/mail/mail.service.ts` — expose `sendContactNotification()`
- `src/config/environment.validation.ts` — add new var if needed

**E2E spec:** `test/contact.e2e-spec.ts`
- POST /contact with valid name/email/subject/message → 201
- POST /contact with missing required field → 400
- POST /contact with invalid email format → 400
- Verify ContactSubmission row exists in DB after successful submission

- [ ] Create `ContactSubmission` entity
- [ ] Generate + run migration: `AddContactSubmissionsTable`
- [ ] Create `CreateContactDto` with validation
- [ ] Create `ContactProvider` (save + call mailService)
- [ ] Create `ContactController` with `POST /contact`, `@Auth(AuthType.None)`, `@Throttle({ default: { limit: 3, ttl: 300000 } })`
- [ ] Create `ContactModule` and import into `AppModule`
- [ ] Create `contact.ejs` mail template
- [ ] Create `SendContactNotificationProvider` and register in `MailModule`
- [ ] Expose `sendContactNotification()` on `MailService`
- [ ] Add new env var to `environment.validation.ts` if needed
- [ ] Write e2e spec

---

### 5. Change password endpoint

**Why this exists:**
Currently, an authenticated user who wants to change their password has no way to do it other than logging out and going through the forgot-password email flow. This is bad UX — a logged-in user on a settings page should be able to change their password directly by providing their current one. This is a standard feature of any auth system.

**Current state:**
`src/auth/auth.controller.ts` already has `POST /auth/reset-password` (token-based, for users who forgot their password). What's missing is an authenticated equivalent. The `BcryptProvider` (implements `HashingProvider`) is already injectable and has `hashPassword()` and `comparePassword()` methods. The `AccessTokenGuard` already puts the current user on the request, readable via `@ActiveUser()`.

**Edge case — Google-only accounts:** If a user signed up via Google OAuth, their `password` field in the DB is `null`. They cannot set a current password to verify against. The provider must check for this and throw a `BadRequestException` with a clear message like `'This account uses Google Sign-In. Use account settings to manage your password.'`

**What to build:**
- `ChangePasswordDto` — `currentPassword: string`, `newPassword: string` (same 8-96 char regex + uppercase/lowercase/number/special char as `ResetPasswordDto`)
- `ChangePasswordProvider` — injects `UsersService` (to load user with password), `HashingProvider` (to compare and hash), `InjectRepository(User)` (to save). Verifies `currentPassword`, rejects if Google-only, hashes `newPassword`, saves.
- Handler in `AuthController`: `POST /auth/change-password`, requires Bearer auth (default, no `@Auth` override needed), throttle 5/60s.

**Files to touch:**
- `src/auth/dtos/change-password.dto.ts` — new DTO
- `src/auth/providers/change-password.provider.ts` — new provider
- `src/auth/auth.controller.ts` — new route
- `src/auth/auth.module.ts` — register new provider

**E2E spec:** `test/auth-change-password.e2e-spec.ts`
- POST /auth/change-password (authenticated) with correct currentPassword and strong newPassword → 200
- POST /auth/change-password with wrong currentPassword → 401
- POST /auth/change-password on a Google-only account → 400
- POST /auth/change-password with weak newPassword (no special char) → 400
- POST /auth/sign-in with the newPassword after a successful change → 200 (confirms password actually changed)

- [ ] Create `ChangePasswordDto`
- [ ] Create `ChangePasswordProvider`
- [ ] Add `POST /auth/change-password` to `AuthController` with `@Throttle({ default: { limit: 5, ttl: 60000 } })`
- [ ] Register provider in `AuthModule`
- [ ] Write e2e spec

---

## Priority 2 — CMS completeness

### 6. Author's own posts (with draft visibility)

**Why this exists:**
The public `GET /posts` endpoint only returns published posts — by design, so visitors never see drafts. But EDITOR and AUTHOR users need a CMS dashboard that shows their own posts in all statuses (draft, review, scheduled, published) so they can manage their content. Without this endpoint, the Svelte CMS UI cannot list unpublished posts at all.

**Current state:**
`src/posts/providers/find-all-posts.provider.ts` filters by `status: PostStatus.PUBLISHED` and also applies the `where` param passed by the controller. There is currently no route that bypasses this filter for authenticated authors. The `GetPostsDto` already has `startDate` and `endDate` optional filters but no `status` filter.

**What to build:**
A new `GET /posts/my` route — authenticated (default Bearer guard, any role). Returns paginated posts where `author.id` equals the active user's `sub` (from the JWT payload). All statuses are included by default, with an optional `status` query param to filter down to one specific status. Reuses `GetPostsDto` for the `limit`/`page`/`startDate`/`endDate` params, extended with optional `status`.

Important: this route must be declared **before** `GET /posts/:id` in the controller file, otherwise NestJS will try to parse `my` as an integer ID and hit `ParseIntPipe` before even reaching the handler.

**Files to touch:**
- `src/posts/dto/get-posts.dto.ts` — add optional `status?: PostStatus` field
- `src/posts/providers/find-my-posts.provider.ts` — new provider, injects repository, queries by authorId + optional status
- `src/posts/providers/posts.service.ts` — expose `findMyPosts()` delegating to new provider
- `src/posts/posts.controller.ts` — add `GET /posts/my` before `/:id`
- `src/posts/posts.module.ts` — register new provider

**E2E spec:** `test/posts-my.e2e-spec.ts`
- GET /posts/my (as AUTHOR) → 200, paginated, includes own draft posts
- GET /posts/my?status=draft → only draft posts returned
- GET /posts/my (unauthenticated) → 401
- Create two users, each with posts; GET /posts/my as user A → does not include user B's posts

- [ ] Add optional `status?: PostStatus` to `GetPostsDto`
- [ ] Create `FindMyPostsProvider`
- [ ] Expose `findMyPosts()` on `PostsService`
- [ ] Add `GET /posts/my` to `PostsController` (before `/:id`)
- [ ] Register provider in `PostsModule`
- [ ] Write e2e spec

---

### 7. Filter posts by tag and/or author

**Why this exists:**
The public `GET /posts` currently supports only `startDate`/`endDate` query filters. The Svelte frontend will need tag pages (`/tags/javascript` showing all posts tagged `javascript`) and author pages showing all posts by a specific author. Without server-side filters, the frontend would have to fetch all posts and filter client-side — not viable with pagination.

**Current state:**
`src/posts/providers/find-all-posts.provider.ts` calls `paginationProvider.paginateQuery(dto, repository, where)` with a simple `where` object `{ status: PostStatus.PUBLISHED }`. The `PaginationProvider` supports a `where` param typed as `FindOptionsWhere<T>` which works for simple conditions. For tag filtering, a many-to-many join is needed — TypeORM's `FindOptionsWhere` supports relation filters with `{ tags: { id: tagId } }` syntax, which TypeORM translates into a JOIN under the hood. This avoids needing a raw QueryBuilder for the simple case.

**What to build:**
Add optional `tagId?: number` and `authorId?: number` to `GetPostsDto`. In `FindAllPostsProvider`, build the `where` object conditionally: always include `{ status: PostStatus.PUBLISHED }`, add `{ tags: { id: tagId } }` if `tagId` is provided, add `{ author: { id: authorId } }` if `authorId` is provided. All are combined with TypeORM's `AND` (default when keys are merged in one object). A non-existent `tagId` or `authorId` returns an empty array, not a 404 — consistent with how pagination works everywhere else.

**Files to touch:**
- `src/posts/dto/get-posts.dto.ts` — add `tagId` and `authorId` optional fields
- `src/posts/providers/find-all-posts.provider.ts` — conditionally build `where` object

**E2E spec:** `test/posts-filter.e2e-spec.ts`
- GET /posts?tagId=1 → only published posts with that tag
- GET /posts?authorId=1 → only published posts by that author
- GET /posts?tagId=1&authorId=1 → intersection of both filters
- GET /posts?tagId=999 (non-existent) → 200, empty data array

- [ ] Add optional `tagId?: number` and `authorId?: number` to `GetPostsDto`
- [ ] Update `FindAllPostsProvider` to apply conditional `where` filters
- [ ] Write e2e spec

---

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

- [ ] Create `UpdateTagDto = PartialType(CreateTagDto)`
- [ ] Create `UpdateTagProvider`
- [ ] Expose `update()` on `TagsService`
- [ ] Add `PATCH /tags/:id` to `TagsController` with `@Roles(UserRole.AUTHOR, UserRole.ADMIN)`
- [ ] Register provider in `TagsModule`
- [ ] Write e2e spec

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

---

## Post-implementation checklist

Run these after finishing all features above:

- [ ] `pnpm run build` — TypeScript compilation must pass with zero errors
- [ ] `pnpm run lint` — ESLint + Prettier auto-fix; no unfixable errors (the only known unfixable error is the stale `src/app.controller.spec.ts`)
- [ ] `pnpm run test` — all unit tests green
- [ ] `pnpm run test:e2e` — all new e2e specs pass (requires `.env.test` pointing at the test DB `nest_portfolio_test`)
- [ ] `pnpm run generate:types` — regenerate `openapi-types.ts`; open it and confirm the 9 new endpoints appear with correct request/response types
- [ ] Manually smoke-test via Swagger at `/api`: contact form, change password, public profile, my posts, tag update, upload list, upload delete
