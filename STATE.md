# Backend State

NestJS 11 + TypeORM + PostgreSQL backend for a personal blog/portfolio. Auth, posts, tags, uploads (Cloudinary), user management, contact form, and RBAC (USER / EDITOR / AUTHOR / ADMIN) are all complete and in production.

---

## Upcoming features

Each item below is a self-contained feature to implement when the time comes. Before starting any item: add comments following the style in `CLAUDE.md` (single-line `//` for injections, JSDoc `/** */` for public methods). After finishing: decide whether unit and/or e2e tests are needed and write them, check whether the change could break existing tests and fix any that break, then run `pnpm run test` and `pnpm run test:e2e` to confirm everything is green.

---

### Scheduled post auto-publishing

`Post.publishOn` is stored but nothing acts on it. A cron job (`@nestjs/schedule`) should query `status = SCHEDULED AND publishOn <= now()` and flip matching posts to `PUBLISHED`. Needs a migration if any index is added.

---

### Refresh token revocation

Old refresh tokens stay valid until natural expiry (24h). To support logout-all-devices:
- Add a `jti` (JWT ID) claim to refresh tokens in `GenerateTokensProvider`
- Create a `refresh_token_revocations` table `(jti UUID PK, expiresAt TIMESTAMP)` via migration
- Check `jti` in `RefreshTokensProvider` before issuing new tokens — throw `UnauthorizedException` if revoked
- Add a daily cron to purge expired rows
- No Redis needed — a plain DB table is sufficient at this traffic level

---

### Comments

No entity or routes exist yet. Significant scope:
- `Comment` entity with FK to `Post` and `User`
- Nested threading (parent comment FK, nullable)
- Moderation: a `status` field (`pending` / `approved` / `rejected`), ADMIN/AUTHOR can approve
- Event-driven email notification to post author on new approved comment

---

### Post likes / reactions

No engagement tracking. Needs:
- `PostLike` entity `(userId, postId)` with unique constraint
- `POST /posts/:id/like` and `DELETE /posts/:id/like` (Bearer, any role)
- Count exposed on `GET /posts` and `GET /posts/:id` responses

---

### Newsletter subscribers

- `Subscriber` entity `(email, confirmedAt, unsubscribeToken)`
- `POST /newsletter/subscribe` (public) — sends confirmation email
- `GET /newsletter/confirm` (public) — confirms via token
- `POST /newsletter/unsubscribe` (public) — unsubscribes via token
- Admin send-blast endpoint out of scope for now

---

### Decide: should `GET /meta-options/:id` be ownership-gated?

**Current behavior (intentional):** `GET /meta-options/:id` is role-gated
(EDITOR/AUTHOR/ADMIN) but **not** ownership-gated — any of those roles can read any
meta-option regardless of who owns the linked post. The write routes
(`PATCH`/`DELETE`) *are* ownership-gated (non-ADMIN limited to their own posts'
meta-options). This asymmetry is deliberate and is asserted by an explicit test:
`test/meta-options/meta-options.e2e-spec.ts` → "GET /meta-options/:id (as non-owner
AUTHOR) → 200 — read is not ownership-gated".

This was flagged during the OpenAPI auth-docs audit. Meta-option data is per-post SEO
metadata (low sensitivity), so leaving reads open is defensible, but if we want reads
to match the write ownership model:
- Thread `@ActiveUser()` into `MetaOptionsController.findOne` → `MetaOptionsService.findOne`
  → a guarded lookup, reusing the same check as `UpdateMetaOptionProvider`
  (`activeUser.role !== ADMIN && metaOption.post.author.id !== activeUser.sub` → 403).
  `FindOneMetaOptionProvider.findOneById` already eager-loads `post.author`, so no new query.
- Update the e2e test above (the non-owner case flips from 200 to 403) and the
  `@ApiAuth` ownership note on the `GET` route in `meta-options.controller.ts`.
- Decision needed first: is cross-author read of SEO metadata actually a problem? If not, leave as-is.

