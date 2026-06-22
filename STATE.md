# Backend Finalization State

Track implementation progress. Check off each item as done.
Each feature has a corresponding e2e spec path — write the spec alongside the feature.

---

## Priority 1 — Critical (portfolio must-haves)

### 1. User bio + social links fields
- [ ] Add `bio` (text), `website` (varchar 512), `socialLinks` (json) to `User` entity
- [ ] Generate + run migration (`AddUserProfileFields`)
- [ ] Extend `PatchUserProfileDto` with bio/website/socialLinks validators
- [ ] `GET /users/me` automatically returns new fields (no serialization change needed)

**E2E spec:** `test/users-profile-fields.e2e-spec.ts`
- PATCH /users/me with bio, website, socialLinks → 200, fields returned
- GET /users/me → fields present
- Invalid website URL → 400

---

### 2. Public author profile endpoint
- [ ] Add `GET /users/:id/profile` — public, no auth
- [ ] Returns: id, firstName, lastName, avatarUrl, bio, website, socialLinks only
- [ ] 404 if user not found

**E2E spec:** `test/users-public-profile.e2e-spec.ts`
- GET /users/1/profile (unauthenticated) → 200, no email/role/password
- GET /users/999/profile → 404

---

### 3. Contact form endpoint
- [ ] New module: `src/contact/`
- [ ] Entity: `ContactSubmission` (id, name, email, subject, message, createdAt)
- [ ] Migration: `AddContactSubmissionsTable`
- [ ] DTO: `CreateContactDto` — name, email (valid email), subject, message (all required)
- [ ] Controller: `POST /contact` — public, throttle 3/300s
- [ ] Provider: save to DB + send admin notification email
- [ ] Mail template: `src/mail/templates/contact.ejs`
- [ ] `SendContactNotificationProvider` in mail module

**E2E spec:** `test/contact.e2e-spec.ts`
- POST /contact with valid body → 201
- POST /contact with missing fields → 400
- POST /contact with invalid email → 400
- Verify DB row created

---

### 4. Change password endpoint
- [ ] Add `POST /auth/change-password` — requires Bearer auth
- [ ] DTO: `ChangePasswordDto` — currentPassword (string), newPassword (8-96 chars, regex)
- [ ] Provider: `src/auth/providers/change-password.provider.ts`
  - Verify currentPassword against hash
  - Reject if Google-only account (no password hash stored)
  - Hash and save newPassword
- [ ] Throttle: 5/60s

**E2E spec:** `test/auth-change-password.e2e-spec.ts`
- POST /auth/change-password (authenticated) with correct currentPassword → 200
- Wrong currentPassword → 401
- Google-only account → 400
- Weak newPassword → 400
- Sign in with newPassword after change → 200

---

## Priority 2 — CMS completeness

### 5. Author's own posts (with draft visibility)
- [ ] Add `GET /posts/my` — requires Bearer auth (any role)
- [ ] Returns paginated posts where author = current user (all statuses: draft, review, etc.)
- [ ] Same query params as `GET /posts` (limit, page, startDate, endDate) + optional `status` filter
- [ ] Provider: `src/posts/providers/find-my-posts.provider.ts`
- [ ] Declare before `/:id` in controller

**E2E spec:** `test/posts-my.e2e-spec.ts`
- GET /posts/my (authenticated as author) → 200, includes drafts
- GET /posts/my?status=draft → only draft posts
- GET /posts/my (unauthenticated) → 401
- Only returns posts by the calling user, not others

---

### 6. Filter posts by tag and/or author
- [ ] Add optional `tagId?: number` and `authorId?: number` to `GetPostsDto`
- [ ] Apply filters in `FindAllPostsProvider` (public endpoint, published only)
- [ ] Tag filter via join (QueryBuilder if needed)

**E2E spec:** `test/posts-filter.e2e-spec.ts`
- GET /posts?tagId=1 → only posts with that tag, all published
- GET /posts?authorId=1 → only posts by that author, all published
- GET /posts?tagId=1&authorId=1 → intersection
- Non-existent tagId → empty array (not 404)

---

### 7. Tag PATCH (update)
- [ ] Add `PATCH /tags/:id` — roles: AUTHOR, ADMIN
- [ ] DTO: `UpdateTagDto` — `PartialType(CreateTagDto)` (name, slug, description, schema, featuredImage all optional)
- [ ] Provider: `src/tags/providers/update-tag.provider.ts`
- [ ] 404 if tag not found

**E2E spec:** `test/tags-update.e2e-spec.ts`
- PATCH /tags/1 (as ADMIN) with new name → 200, name updated
- PATCH /tags/1 (as USER) → 403
- PATCH /tags/999 → 404
- PATCH with duplicate name → 409 (unique constraint)

---

## Priority 3 — Upload management

### 8. Delete standalone upload
- [ ] Add `DELETE /uploads/:id` — roles: EDITOR/AUTHOR/ADMIN
- [ ] EDITOR can only delete their own uploads (userId check)
- [ ] Delete from Cloudinary (via `DeleteFileProvider`) + remove DB row
- [ ] 404 if not found; 403 if EDITOR tries to delete another user's upload

**E2E spec:** `test/uploads-delete.e2e-spec.ts`
- DELETE /uploads/:id (as ADMIN) → 200
- DELETE /uploads/:id (as EDITOR, own upload) → 200
- DELETE /uploads/:id (as EDITOR, other user's upload) → 403
- DELETE /uploads/999 → 404

---

### 9. List own uploads
- [ ] Add `GET /uploads` — roles: EDITOR/AUTHOR/ADMIN
- [ ] EDITOR/AUTHOR see own uploads only; ADMIN sees all
- [ ] Paginated (limit, page)

**E2E spec:** `test/uploads-list.e2e-spec.ts`
- GET /uploads (as ADMIN) → 200, paginated list
- GET /uploads (as EDITOR) → only own uploads
- GET /uploads (unauthenticated) → 401

---

## Deferred (post-launch)

- [ ] Scheduled post auto-publishing (cron job for `publishOn` field)
- [ ] Comments system
- [ ] Post likes/reactions
- [ ] Newsletter subscribers
- [ ] Refresh token revocation (logout-all-devices)
- [ ] Audit logging

---

## Post-implementation checklist

- [ ] `pnpm run build` — no TS errors
- [ ] `pnpm run lint` — clean
- [ ] `pnpm run test` — unit tests green
- [ ] `pnpm run test:e2e` — all new e2e specs pass
- [ ] `pnpm run generate:types` — regenerate `openapi-types.ts`, confirm new endpoints appear
