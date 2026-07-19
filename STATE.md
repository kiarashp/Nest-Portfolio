# Backend State

NestJS 11 + TypeORM + PostgreSQL backend for a personal blog/portfolio. Auth, posts, tags, uploads (swappable local-disk/Cloudinary backend, local disk by default), user management, contact form, and RBAC (USER / EDITOR / AUTHOR / ADMIN) are all complete and in production.

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

**Step 5 (resolver + public endpoints) is done** — the public surface is live: `ConfiguratorsController`
(`/configurators`, base prefix, both routes `@Auth(AuthType.None)`) exposes `GET /configurators/:slug`
(curated form schema per §5.2 — product header limited to name/description/imageUrl/codePrefix/separator,
segments flattened to one object per assignment keyed by `assignmentId`, options only for SELECT) and
`POST /configurators/:slug/resolve` (`@HttpCode(200)` — a computed result, not a created resource).
Neither route audit-logs (reads/stateless), and `ConfiguratorsService` is the one facade that injects no
`AuditLogService`. `FindOneConfigurableProductProvider` gained `findOneBySlugPublishedOrFail(slug)`
(`isPublished: true` + soft-delete auto-exclusion → public 404s for drafts, same rule as `Product`),
sharing the ordered assignment-tree `relations`/`order` constants with the admin `findOneByIdOrFail`.
`ConfiguratorResolverService` implements the §4.3 algorithm as a dependency-free `@Injectable`
(unit-tested via `new`, in-memory §6 fixture): single forward pass in position order, all errors
collected (never stops at the first), inactive segments zero-fill and are omitted from the summary,
`code`/`summary` keys present only when valid, and a per-segment `segments` state array on every
response (errored segments echo the raw input). The pure pieces are six utils in
`src/configurator/providers/` (each with a colocated spec): `render-zero-fill`, `evaluate-condition`
(cascade rule: inactive controller → false for every operator incl. `neq`), `validate-segment-value`
(NUMBER normalizes `'50'`→`'0050'`; STRING `'0'` reserved; SELECT exact case-sensitive),
`render-meaning` (`{value}` always, `{label}` SELECT-only), `parse-selections` (malformed shape → 400),
and `build-form-schema` — placed in `providers/` alongside the Step 2/4 utils, a **user-confirmed
deviation** from CONFIGURATOR.md's literal `utils/` wording. Two further user-confirmed edge decisions
(documented in the new `src/configurator/CLAUDE.md`): unknown-but-well-formed selection keys are
silently ignored (stale form after an admin edit must not hard-fail), and a dependent whose controller
is active-but-errored zero-fills (cascade rule extended — no derived error, the result is already
invalid via the controller's own error). No entity/migration changes; no per-route throttle (global
default suffices). Covered by 20 new e2e tests in `test/configurator/resolve.e2e-spec.ts` (seeds the
§6 worked example through the real admin HTTP API; asserts every §6 bullet plus 404/400 shapes)
and ~71 new unit tests.

**Step 6 (Phase 2 — SavedConfiguration) is done** — registered users can now persist frozen
snapshots of resolved configurations. New entity `SavedConfiguration`
(`configurator_saved_configuration`, migration `1783690069236-AddConfiguratorSavedConfiguration`;
also added to `data-source.ts`): `userId` FK → `user` `ON DELETE CASCADE`, nullable `productId`
FK → `configurator_product` `ON DELETE SET NULL` (the row survives a hard product delete;
soft-delete doesn't touch it), snapshot columns `productName`/`code`/`summary` (jsonb
`string[]`)/`selections` (jsonb raw map), and a nullable `quoteRequestedAt` column that ships
now but is only written by Step 7's request-quote endpoint. No inverse relation on `User`
(matches `UploadFile.userId`), no soft delete (only `ConfigurableProduct` soft-deletes).
`POST /configurators/:slug/save` lives on the existing `ConfiguratorsController` (same path
family; `@Auth(AuthType.None)` there is per-route, so this one handler is plain Bearer + bare
`@ApiAuth()`) but delegates to a new `SavedConfigurationsService` facade — keeping
`ConfiguratorsService` the one facade with no `AuditLogService`. Save re-resolves server-side
via `FindOneConfigurableProductProvider.findOneBySlugPublishedOrFail` +
`ConfiguratorResolverService` (never trusts a client-composed code; unknown/unpublished/deleted
slug → 404) and rejects an invalid resolve with 400 carrying the resolver's per-segment error
messages as a class-validator-style string array. `SavedConfigurationsController`
(`/saved-configurations`, base prefix, all routes bare `@ApiAuth()` — any authenticated role)
exposes `GET /` (paginated, `paginateQueryBuilder` for the guaranteed `createdAt DESC, id DESC`
ordering, contact-inbox reasoning) plus `GET`/`DELETE /:id`. Ownership is enforced by scoping
the lookup `where: { id, userId }` and throwing `NotFoundException` — a foreign snapshot 404s
exactly like a missing id (spec wants 404, not the posts-style 403, so ids can't be probed).
Deletes are hard deletes returning `DeleteResultDto`; audit logs: `CREATE`/`DELETE` on entity
`'SavedConfiguration'`. Covered by 17 new e2e tests in
`test/configurator/saved-configurations.e2e-spec.ts` (built through the real admin HTTP API;
includes the §2.5 snapshot-immutability proof: option relabel + product soft-delete leave a
saved snapshot's `code`/`summary` byte-identical). No new unit tests — the only logic (the
resolver) was already unit-tested in Step 5.

**Step 7 (request-quote + mail) is done — this was the final step of the 7-step plan.**
`POST /saved-configurations/:id/request-quote` (on the existing `SavedConfigurationsController`)
stamps `quoteRequestedAt` and emails the site owner. It returns **200**
(`@HttpCode(HttpStatus.OK)`), not the `@Post()` default 201 — it mutates one column on an
existing row rather than creating a resource, the same reasoning as `PATCH /contact/:id`'s
`handled` toggle rather than `save`'s (which does insert a new row and keeps 201). The 409
idempotency guard (`quoteRequestedAt` already set) is checked **before** any mutation, save,
audit log, or event emit — this is what a new e2e test proves directly: two calls in a row leave
`sendQuoteRequestMailMock` at exactly one invocation, not two. A successful call sets
`quoteRequestedAt = new Date()`, audit-logs `AuditAction.UPDATE`/`'SavedConfiguration'` (the same
entity string Step 6's `CREATE`/`DELETE` rows use), then emits `AppEvents.QUOTE_REQUESTED` — a
new constant plus a dedicated `QuoteRequestedPayload` interface in
`src/common/events/app-events.ts` (unlike `CONTACT_SUBMITTED`, which reuses a DTO type with no
payload interface). New provider `RequestQuoteSavedConfigurationProvider`
(`src/configurator/providers/`) injects the `SavedConfiguration` repository, a `User` repository,
`FindOneSavedConfigurationProvider` (reused unmodified — the hot `GET`/`DELETE` paths never load
the `user` relation), `AuditLogService`, and `EventEmitter2`. `User` is registered directly in
`ConfiguratorModule`'s `TypeOrmModule.forFeature` purely so the provider can resolve the
requester's `email`/`firstName` for the notification — the same foreign-entity-in-a-cross-cutting-
module pattern `AdminModule` uses, chosen over importing all of `UsersModule` for one lookup. New
`src/configurator/listeners/` directory (anticipated by CONFIGURATOR.md's Phase-2 layout) holds
`QuoteEventsListener`, an exact structural mirror of `ContactEventsListener` — `@OnEvent`, calls
`MailService.sendQuoteRequestMail()`, try/catch + `Logger`, never throws/propagates. `MailModule`
is now imported into `ConfiguratorModule` (not needed before this step). The mail side follows
`src/mail/CLAUDE.md`'s 4-step recipe exactly: `templates/quote-request.ejs` (structurally mirrors
`contact.ejs`, plus one new construct — an EJS `summary.forEach(...)` loop rendering the summary
lines as `<li>`s), `SendQuoteRequestMailProvider` (mirrors `SendContactNotificationProvider`,
reads `mail.quoteNotifyEmail`), registered in `mail.module.ts`, and `sendQuoteRequestMail()` on
`MailService`. `QUOTE_NOTIFY_EMAIL` is optional (`environment.validation.ts`, `.env.example`),
falling back to `MAIL_FROM` — the identical pattern `CONTACT_NOTIFICATION_EMAIL` already
established. No entity or migration change was needed — `quoteRequestedAt` already existed from
Step 6's migration. Covered by 6 new e2e tests appended to
`test/configurator/saved-configurations.e2e-spec.ts` (inserted just before the snapshot-
immutability block, which must stay last): 401, happy-path 200 + field assertions, mail-payload
assertion, 404 missing id, 404 foreign owner, and the 409-does-not-resend-mail case. No new unit
tests — no new pure logic, consistent with Step 6. `test/helpers/create-app.helper.ts`'s
`MailMock` interface and default mock object gained a `sendQuoteRequestMail` key;
`test/CLAUDE.md`'s mail-mocking table gained a matching row. `openapi-types.ts` regeneration
(deferred since Step 6, per CONFIGURATOR.md §7's "steps 5 and 7" checkpoint) is the one remaining
manual step — run `pnpm run generate:types` locally with the dev DB up.

**All 7 steps of the Configurator module's implementation plan are now complete.**

**Quote-request message threads (post-plan feature) — done.** Each quote request (a
`SavedConfiguration` with `quoteRequestedAt` set) now carries one ticket-style, async message
thread. Full plan lived at `.claude\plans\do-the-plan-plz-mutable-honey.md`; implemented in one
session, migration `1784468786797-AddQuoteMessagesAndStatus`. Key facts:

- **New entity `QuoteMessage`** (`configurator_quote_message`, also added to `data-source.ts`):
  `savedConfigurationId` FK CASCADE, `senderId` FK nullable **SET NULL** (deleting an admin must
  not delete their replies out of users' threads — the denormalized `senderRole` `'user'|'admin'`
  enum keeps threads renderable after sender deletion), `body` text, immutable (no `updatedAt`),
  composite index `(savedConfigurationId, createdAt)`. No Thread entity — one snapshot = one thread.
- **Breaking change (accepted): `quoteReviewed` boolean dropped**, replaced by nullable
  `quoteStatus` enum (`PENDING`/`ANSWERED`/`CLOSED`) with the invariant `quoteStatus IS NULL ⇔
  quoteRequestedAt IS NULL` (request-quote sets `PENDING` in the same save that stamps the
  timestamp; the admin PATCH 400s when no quote was requested). Transitions: user message →
  always `PENDING` (reopens `ANSWERED` and `CLOSED`); admin message → `PENDING`→`ANSWERED` only
  (`CLOSED` stays closed); admin `PATCH /saved-configurations/admin/:id`
  (`PatchSavedConfigurationStatusDto`, `UpdateQuoteStatusProvider` — renamed from
  `ReviewSavedConfigurationProvider`) → any value. Automatic bumps write no `SavedConfiguration`
  audit row (the message's `CREATE/'QuoteMessage'` row covers it); only the manual PATCH audits.
  `GET /saved-configurations/admin`'s `?quoteReviewed=` filter became `?quoteStatus=` (plain
  `@IsEnum` — no boolean-coercion `@Type/@Transform` dance needed for enum params).
- **Four new routes** on `SavedConfigurationsController` (admin literals still declared before
  `:id`): owner `GET`/`POST /saved-configurations/:id/messages` (bare `@ApiAuth()`; POST throttled
  `10/60s` + dev `@SkipThrottle` — the one throttled configurator route) and admin
  `GET`/`POST /saved-configurations/admin/:id/messages`. Reads are paginated `createdAt DESC, id
  DESC` (frontend reverses); a snapshot without a quote request reads as an **empty page, not
  400**; posts 400 until a quote is requested. Providers: `FindQuoteMessagesProvider`,
  `CreateQuoteMessageProvider`.
- **Unread model:** `userLastReadAt`/`adminLastReadAt` timestamptz columns on `SavedConfiguration`
  (all admins share one — single-owner site). A thread `GET` stamps the reader's column via one
  `repository.update` after fetching the page (no separate mark-read endpoint; bumps `updatedAt`,
  accepted). Both list endpoints attach transient `unreadCount` (= other side's messages newer
  than the reader's stamp) via `CountUnreadQuoteMessagesProvider.countUnread(ids, side)` — one
  grouped `COUNT(*) ... GROUP BY` query per page, never per-row; covered by e2e, not a mock unit
  spec (QueryBuilder-heavy).
- **`POST .../request-quote` gained an optional `message` body field** (`RequestQuoteDto`) that
  becomes the thread's first `QuoteMessage` and rides inside the existing quote-request email as
  a `message` context key (always passed, even when null — absent EJS keys are `ReferenceError`s;
  the template guards with `<% if (message) { %>`). The posted-by-user event is deliberately not
  emitted there — no second email.
- **Mail/events:** two new events sharing one `QuoteMessagePostedPayload`
  (`QUOTE_MESSAGE_POSTED_BY_USER` → `SendQuoteMessageNotificationProvider`/`quote-message.ejs` to
  the site owner; `QUOTE_MESSAGE_POSTED_BY_ADMIN` → `SendQuoteReplyMailProvider`/`quote-reply.ejs`
  to the thread owner — `userEmail`/`userFirstName` are always the thread owner's), both handled
  by the existing `QuoteEventsListener`. The two-write flows (message + status bump;
  request-quote + first message) are deliberately non-transactional (benign failure modes).
- **Tests:** `update-quote-status.provider.spec.ts` (rewrote the old review spec) and a new
  `create-quote-message.provider.spec.ts` (18 unit tests total for the pair);
  `saved-configurations.e2e-spec.ts` updated for the breaking assertions; new
  `test/configurator/quote-messages.e2e-spec.ts` (17 tests — guards, transitions both
  directions, unread 1→0 flows, request-quote-with-message single-email proof). `MailMock` gained
  `sendQuoteMessageNotification`/`sendQuoteReplyMail`. Full suite green: 254 unit, 586 e2e.
  **e2e fixture gotcha (re-learned):** a SELECT definition needs ≥2 options before
  `POST .../assignments` accepts it — new configurator fixtures must seed two options.
- `openapi-types.ts` **was** regenerated this time (`pnpm run generate:types`), clearing the
  manual step Step 7 had left pending.

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

### Add `GET /products/sku/:sku` lookup endpoint — done

Implemented as an exact structural mirror of `GET /products/slug/:slug`:
`FindOneProductProvider.findOneBySkuOrFail` (published-only, 404 on miss),
`ProductsService.findBySku` (same `includeRelated` composition, reusing
`GetProductBySlugDto` as-is — it was already generic, not slug-specific), and
`ProductsController.findBySku` (`GET /products/sku/:sku`, declared right after
`slug/:slug` and before any `/:id` route for the usual `ParseIntPipe` reason).

**Open question resolved with the user:** keep `sku` backend-agnostic — no DTO
validation changes to `CreateProductDto`/`UpdateProductDto`. Fixed-width/format
enforcement (if ever needed for a "boxes" UI) stays a frontend concern.
`?includeRelated=N` was confirmed in scope, to keep the two identifier-lookup
routes symmetric.

Covered by 6 new e2e tests in `test/products/products.e2e-spec.ts` (200, 404,
no-includeRelated, includeRelated=2, includeRelated=0/-1 → 400), added right
after the existing slug test block; the shared seeded product (`PUBLISHED_SLUG`)
now also carries a `PUBLISHED_SKU`. Full suite green: 46 unit test files (231
tests) and 32 e2e test files (543 tests). No entity/migration/DTO changes.
`openapi-types.ts` regeneration is the usual manual step
(`pnpm run generate:types` against the dev DB) — not run as part of this change.

---

### First production deploy prep: local-disk storage + trust proxy fix — done

Ahead of the first production deploy, uploads no longer require Cloudinary. A
new `LocalDiskStorageProvider` (`src/uploads/providers/local-disk.provider.ts`)
implements the existing `StorageProvider` abstract class alongside
`CloudinaryProvider`; `UploadsModule` picks between them via a `useFactory`
keyed on the new `STORAGE_DRIVER` env var (`local` | `cloudinary`, default
`local` — see `src/config/uploads.config.ts`). Only the selected backend is
ever instantiated, so `CLOUDINARY_NAME`/`CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET`
became conditionally required in `environment.validation.ts` (`Joi.when('STORAGE_DRIVER', ...)`)
instead of unconditionally required. Local uploads write under `UPLOADS_DIR`
(default `./uploads`) and are served back out at `/uploads/*` by
`app.create.ts` via `NestExpressApplication.useStaticAssets()`, with a
`Cross-Origin-Resource-Policy: cross-origin` override scoped to that one route
(helmet's global default would otherwise block the frontend, a different
origin in production, from rendering `<img>` tags against these URLs).
`Dockerfile` now seeds `/app/uploads` with `node`-user ownership before
`USER node`, so a Coolify Persistent Storage volume mounted there gets correct
permissions on first deploy — no reverse-proxy config change needed, Coolify's
existing Caddy proxy already forwards `/uploads/*` to the app like any other
path. See `src/uploads/CLAUDE.md`'s "Local-disk storage" section for the full
mechanism, including the persistence/`APP_URL` caveats.

Same session also fixed a separate pre-existing gap found while auditing for
this deploy: `app.create.ts` now calls `app.set('trust proxy', 1)`. Without it,
behind Coolify/Railway's reverse proxy, `ThrottlerGuard`'s per-IP rate limit
would have collapsed into one shared bucket for every visitor (`req.ip`
resolving to the proxy's own address), and `PaginationProvider`'s
`first`/`last`/`next`/`prev` links would have been built with `http://` instead
of `https://` (`request.protocol` reading the proxy-to-app hop, not the
original client-to-proxy one).

New unit test `src/uploads/providers/local-disk.provider.spec.ts` (6 tests:
write/read round-trip, mimetype-extension fallback, nested folders, idempotent
delete, and two path-traversal-sanitization cases). No DTO/entity/route/OpenAPI
schema changes — `UploadResult`'s shape (`{ url, publicId }`) is unchanged, so
`openapi-types.ts` does not need regenerating for this change. Full suite
green: 260 unit tests, 585/586 e2e (the one failure,
`resolve.e2e-spec.ts`'s SELECT-options-ordering assertion, is pre-existing and
unrelated — reproduced identically on `master` with this change stashed out).
