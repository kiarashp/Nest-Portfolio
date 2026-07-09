# Backend State

NestJS 11 + TypeORM + PostgreSQL backend for a personal blog/portfolio. Auth, posts, tags, uploads (Cloudinary), user management, contact form, and RBAC (USER / EDITOR / AUTHOR / ADMIN) are all complete and in production.

---

## Upcoming features

Each item below is a self-contained feature to implement when the time comes. Before starting any item: add comments following the style in `CLAUDE.md` (single-line `//` for injections, JSDoc `/** */` for public methods). After finishing: decide whether unit and/or e2e tests are needed and write them, check whether the change could break existing tests and fix any that break, then run `pnpm run test` and `pnpm run test:e2e` to confirm everything is green.

---

### Configurator module (ordering-code builder)

An industrial "type code" configurator: the admin defines reusable segment definitions and
assembles them into configurable products; customers compose an ordering code position by
position (e.g. `FRH-2d-no-00-000-0450`) and the backend resolver validates selections,
evaluates conditions (zero-fill/cascade), and renders the code + human summary. Fully
separate from the existing `products` module — all tables use the `configurator_` prefix.

The complete design and a 7-step implementation plan (already adapted to this codebase's
conventions: int PKs, no `/admin` URL prefix, soft-delete only on the product entity,
avatar-style image handling, audit logging, Jest) live in **`CONFIGURATOR.md`**. Implement
its steps 1–7 in order, one step per session/commit, each ending fully green.

**Step 1 (module skeleton + entities + migration) is done** — `src/configurator/` has the
four Phase-1 entities, the `SegmentDataType` enum, `ConfiguratorModule` (registered in
`AppModule`), and migration `1783085011665-AddConfiguratorTables`.

**Step 2 (segment definition library CRUD + options) is done** — `ConfiguratorDefinitionsController`
(no base prefix; mixes `/configurator-definitions/*` and `/configurator-options/*` literal
paths per CONFIGURATOR.md §5.1), `ConfiguratorDefinitionsService` facade, and single-purpose
providers for create/find-all(paginated)/find-one/update/delete on `SegmentDefinition` plus
create/update/delete on `SegmentOption`. `validate-segment-constraints.util.ts` does the
per-type dispatch for the `constraints` jsonb shape (mirrors `classify-type-change.util.ts`).
Enforced: option `value` never `'0'`; options only addable to a `SELECT` definition;
`dataType` immutable once any `ProductSegmentAssignment` references the definition (409);
deleting a definition RESTRICTs (409, names the product) if assigned; deleting an option
RESTRICTs (409) if it would drop an assigned SELECT below 2 options. The "assigned" guard
paths are exercised in `test/configurator/definitions.e2e-spec.ts` by seeding a
`ConfigurableProduct`/`ProductSegmentAssignment` row directly through the repositories,
since assignment creation has no route yet. No entity/migration changes were needed — Step 1
already had the right columns. **Next: Step 3** (`ConfigurableProduct` CRUD + image, per
`CONFIGURATOR.md` §7).

---

### Scheduled post auto-publishing

`Post.publishOn` is stored but nothing acts on it. A cron job (`@nestjs/schedule`) should query `status = SCHEDULED AND publishOn <= now()` and flip matching posts to `PUBLISHED`. Needs a migration if any index is added. `Post.publishedAt` now exists (stamped by `UpdatePostProvider`/`CreatePostProvider` whenever `status` transitions into `PUBLISHED` manually) — the cron job must stamp it the same way (`post.publishedAt = new Date()`) when it flips a scheduled post, not just update `status`.

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

### Add `GET /products/sku/:sku` lookup endpoint

**Why:** The frontend wants a UI where a user types/scans a short code (e.g. into
a row of boxes, like `TC-K-1260-IC`) to jump straight to a specific product —
similar to a barcode lookup. `Product.sku` (`product.entity.ts`) already exists
as exactly the right field for this: unique, optional, varchar. What's missing
is a way to resolve a SKU into a product — there is currently a
`GET /products/slug/:slug` route but **no** `GET /products/sku/:sku` equivalent,
so the frontend has no endpoint to call.

**What to do:** Add `GET /products/sku/:sku` to `ProductsController`, mirroring
the existing slug lookup (`FindOneProductProvider.findOneBySlugOrFail` pattern —
add a `findOneBySkuOrFail`, published-only, 404 if not found or draft). Route
ordering doesn't matter relative to `/:id` since `/sku` is a literal segment,
same as `/slug`. Document with the existing OpenAPI helpers
(`ApiDataResponse(Product)`), same as the slug route.

**Open question (needs an answer before/while implementing):** `sku` is a free-form
`varchar(128)` today with no length/format constraint. If the frontend UI is a
fixed row of boxes (e.g. exactly 10 characters), should the backend enforce a
fixed length/charset on `sku` (via DTO validation, e.g. `@Length(10, 10)` /
a regex), or should the format stay backend-agnostic and be purely a frontend
UI concern? Decide this before building the endpoint, since it affects the DTO.
