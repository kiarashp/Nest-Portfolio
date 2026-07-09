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
already had the right columns.

**Step 3 (ConfigurableProduct CRUD + image) is done** — `ConfiguratorProductsController`
(base prefix `/configurator-products`, a single path family unlike its Step 2 sibling),
`ConfiguratorProductsService` facade, and single-purpose providers for
create/find-all(paginated, admin view incl. unpublished)/find-one/update/soft-delete on
`ConfigurableProduct`, plus upload/delete for its single image slot. Image handling follows
the avatar-options pattern (`src/users/`): `imageUrl`/`imagePublicId` are bare columns with no
`UploadFile` row, uploaded/replaced/cleared directly via the injected `StorageProvider`
(destroy-old-before-new on replace). `imageUrl`/`imagePublicId` are deliberately absent from
the create/update DTOs — only reachable via `POST`/`DELETE /configurator-products/:id/image` —
so a client can never hand-supply a Cloudinary `publicId` that a later delete call would pass
to `StorageProvider.delete()`. Soft-deleting a product (`DELETE /configurator-products/:id`)
deliberately keeps its Cloudinary image rather than purging it, per CONFIGURATOR.md §2.1/§7 —
the opposite of `Product`'s soft-delete, which does purge. No entity/migration changes were
needed — Step 1 already had every column. Covered by 36 new e2e tests in
`test/configurator/products.e2e-spec.ts`.

**Step 4 (Assignments) is done** — `ProductSegmentAssignment` now has a working CRUD surface:
`POST /configurator-products/:id/assignments` (on the existing `ConfiguratorProductsController`,
default position = append) plus a new `ConfiguratorAssignmentsController`
(`PATCH`/`DELETE /configurator-assignments/:assignmentId`, base prefix — not nested under a
product id, since the assignment id alone locates its product). `ConfigurableProduct` gained
the inverse `assignments` relation (pure TypeORM metadata, no migration — the FK already
existed via `productId`), and `FindOneConfigurableProductProvider` now eager-loads
`assignments.definition.options` ordered by `position`/`sortOrder`, so `GET
/configurator-products/:id` returns the full ordered assignment tree per CONFIGURATOR.md §5.1.
New provider-layer utils: `validate-assignment-condition.util.ts` (shape dispatch on `operator`,
mirrors `validate-segment-constraints.util.ts`; has a colocated unit spec) and
`validate-assignment-condition-rules.util.ts` (DB-dependent rules: controller exists in the same
product at a strictly lower position, operator×dataType matrix — SELECT allows eq/neq, NUMBER
allows all 5, STRING never a controller — and a NUMBER-typed target definition must have
`constraints.min >= 1`). Gapless renumbering (insert/reorder/delete) runs inside a
`DataSource.createQueryRunner()` transaction (the same manual-transaction pattern
`UserCreateManyProvider` already uses) via `renumber-assignments.util.ts` —
**non-obvious gotcha**: a naive single-statement bulk `position = position ± 1` shift is
**not** safe against the `(productId, position)` unique constraint, because PostgreSQL checks a
unique constraint per row as it processes a multi-row `UPDATE`, not once at statement end, so a
shifted row can momentarily try to write a value a not-yet-processed sibling in the same
statement still holds — a genuine 23505, not a race with another transaction (this was caught
by the e2e suite, not code review: two tests failed with unexpected 409s). The fix is a
negate-then-finalize two-step shift (negative positions can never collide with any real
positive position, and negation is injective so the shifted rows can't collide with each other
either) — reuse `shiftRange` from `renumber-assignments.util.ts` for any future bulk position
shift, do not reach for a single-statement `position = position ± 1` update. A position change
(`PATCH .../:assignmentId` with a new `position`) is re-validated against every direction rule
a shift could break: the assignment's own condition (if any) must still point at a strictly
lower position (400, input-invalid), and every other assignment that targets this one as its
controller must still end up at a strictly higher position (409, conflict with existing sibling
state) — a uniform ±1 shift can only ever flip order at the edges touching the one deliberately
repositioned row, so only those two edges need re-checking. Deleting a controller with
dependents is rejected outright (409, lists the dependent positions) — no reorder can rescue
that. Covered by 36 new e2e tests in `test/configurator/assignments.e2e-spec.ts`, built through
the real Step 2/3 HTTP APIs (no more direct-repository assignment seeding needed, though
`definitions.e2e-spec.ts` was left as-is — swapping it would only churn a passing suite).
**Next: Step 5** (the resolver + public `GET /configurators/:slug` /
`POST /configurators/:slug/resolve` endpoints, per `CONFIGURATOR.md` §7 — the largest remaining
step).

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
