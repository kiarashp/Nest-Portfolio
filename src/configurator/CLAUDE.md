# CLAUDE.md — src/configurator

Guidance specific to this module. See the root `CLAUDE.md` for the high-level architecture and **`CONFIGURATOR.md`** for the full domain design (entities, rules, resolve algorithm, API surface, worked example, step plan). This file covers what is not obvious from either.

## What this module is

The ordering-code configurator: the admin defines reusable segment definitions and assembles them into configurable products; customers compose an ordering code position by position (e.g. `FRH-2d-no-00-000-0450`) and the backend resolver validates selections, evaluates zero-fill conditions, and renders the code plus a human-readable summary. Fully separate from `src/products/` — all tables use the `configurator_` prefix.

## Module structure

Five entities, five controllers, five service facades, single-purpose providers, and a set of pure utils.

```
src/configurator/
  entities/
    configurable-product.entity.ts      — soft-delete (@DeleteDateColumn); imageUrl/imagePublicId bare columns
    segment-definition.entity.ts        — exports StringConstraints / NumberConstraints / SegmentConstraints
    segment-option.entity.ts            — SELECT choices, onDelete: CASCADE from definition
    product-segment-assignment.entity.ts — exports AssignmentCondition; (productId, position) unique
    saved-configuration.entity.ts       — Phase 2 frozen snapshot; userId FK CASCADE, productId FK SET NULL, no soft delete
  listeners/
    quote-events.listener.ts            — QuoteEventsListener (Step 7); @OnEvent(AppEvents.QUOTE_REQUESTED) → MailService.sendQuoteRequestMail()
  enums/
    segment-data-type.enum.ts           — STRING | NUMBER | SELECT
  dtos/                                  — create/update/get DTOs per entity, plus:
    configurator-form-schema.dto.ts     — response-only classes for GET /configurators/:slug
    resolve-configuration.dto.ts        — { selections: Record<string, string> } (@IsObject only — deep validation in parse-selections.util); also the save body
    resolve-result.dto.ts               — ResolveResultDto / ResolveErrorDto / ResolveSegmentStateDto
    get-saved-configurations.dto.ts     — pagination only
  providers/
    configurator-definitions.service.ts — facade: SegmentDefinition + SegmentOption CRUD (Step 2)
    configurator-products.service.ts    — facade: ConfigurableProduct CRUD + image + assignment create (Steps 3–4)
    configurator-assignments.service.ts — facade: assignment update/delete (Step 4)
    configurators.service.ts            — facade: the two public endpoints (Step 5); no AuditLogService
    saved-configurations.service.ts     — facade: save/list/get/delete/request-quote snapshots (Steps 6–7)
    request-quote-saved-configuration.provider.ts — Step 7: 404/409/mutate/audit-log/emit for POST .../request-quote
    configurator-resolver.service.ts    — the §4.3 resolve algorithm; @Injectable but dependency-free
    <single-purpose providers>          — create/find/update/delete per entity, image upload/delete
    <pure utils, *.util.ts>             — see below; each has a colocated *.spec.ts
  configurator-definitions.controller.ts — admin; NO base prefix (mixes /configurator-definitions/* and /configurator-options/*)
  configurator-products.controller.ts    — admin; /configurator-products (+ POST :id/assignments)
  configurator-assignments.controller.ts — admin; /configurator-assignments/:assignmentId
  configurators.controller.ts            — PUBLIC; /configurators/:slug and /configurators/:slug/resolve, plus the Bearer-only POST /configurators/:slug/save
  saved-configurations.controller.ts     — authenticated (any role); owner-scoped /saved-configurations[/:id]
  configurator.module.ts
```

**Utils live in `providers/`, not a `utils/` directory.** CONFIGURATOR.md's wording says `utils/`, but the Step 2/4 utils (`validate-segment-constraints`, `validate-assignment-condition`, `renumber-assignments`, …) were already colocated in `providers/` — matching `src/products/` (`validate-specs.util.ts`) — so the Step 5 utils followed them. This is a deliberate, user-confirmed deviation from the spec's literal layout.

## The public surface (Step 5)

`GET /configurators/:slug` (form schema) and `POST /configurators/:slug/resolve` — both `@Auth(AuthType.None)`, both backed by `ConfiguratorsService`. The resolve route is a `POST` that returns **200** (`@HttpCode(HttpStatus.OK)`): it computes a result, it creates nothing. Neither route writes audit logs (reads/stateless computation — the admin facades audit, this one doesn't inject `AuditLogService` at all). The global throttle default suffices; no per-route `@Throttle`.

### Visibility — FindOneConfigurableProductProvider

| Method | Filters | Used by |
|---|---|---|
| `findOneByIdOrFail(id)` | none (drafts visible) | admin reads + all mutating providers |
| `findOneBySlugPublishedOrFail(slug)` | `isPublished: true` | both public routes |

Both load the identical assignment tree (`assignments.definition.options`, ordered by `position`/`sortOrder` — shared private class constants), so everything downstream can assume position order. Unpublished and soft-deleted products 404 publicly, same rule as `Product` drafts.

### Curated form schema (`build-form-schema.util.ts`)

The public schema deliberately does **not** serialize the entities. The product header exposes only `name`, `description`, `imageUrl`, `codePrefix`, `separator` — no `id`, `slug`, `imagePublicId`, `isPublished`, or timestamps. Each segment flattens assignment + definition into one object keyed by `assignmentId` (the same key `selections` uses on resolve); `options` (`{value, label}` only) is present only for SELECT segments; `constraints` and `condition` pass through as stored so the frontend can live-disable inputs, while the backend resolve stays the source of truth. When adding a field to the schema, add it to the response DTO classes explicitly — nothing leaks by default.

### The resolver (`configurator-resolver.service.ts`)

`@Injectable()` but **dependency-free** — it receives a fully-loaded product and never touches the DB, so unit tests construct it with `new ConfiguratorResolverService()` and an in-memory fixture (the CONFIGURATOR.md §6 worked example). Single forward pass in position order; the admin-time direction rule (a condition's controller sits at a strictly lower position) guarantees every controller is already resolved when a dependent is reached.

Behavior contract (§4.3 plus two user-confirmed edge decisions):

- **All errors are collected** — the pass never stops at the first failure. `code`/`summary` keys are present only when `valid: true`.
- **Inactive segments zero-fill** (`'0'.repeat(digits)` for NUMBER, `'0'` otherwise — `render-zero-fill.util.ts`); a value supplied for an inactive segment is silently ignored, no error. Zero-filled segments are omitted from `summary` entirely.
- **Unknown-but-well-formed selection keys are silently ignored** (decision 1) — a stale form after an admin edit must not hard-fail an otherwise-complete resolve. Malformed *shape* (non-integer key, non-string value) is different: `parse-selections.util.ts` throws `BadRequestException` → 400.
- **A dependent whose controller is active but errored (missing/invalid value) zero-fills** (decision 2) — the cascade rule extended to "nothing usable is there". No derived error for the dependent; the result is already invalid via the controller's own error.
- **`segments` is returned on every call** (valid or not) so the frontend can render per-input state; an errored segment echoes the raw input as its `value` (`state.value ?? selections.get(id) ?? ''`).
- NUMBER values are normalized (`'50'` → `'0050'` via `padStart(digits, '0')`) by `validate-segment-value.util.ts`; the normalized form is what enters the code and summary. STRING values of exactly `'0'` are rejected (reserved zero-fill marker, §4.1). SELECT matching is exact and case-sensitive.
- Condition evaluation (`evaluate-condition.util.ts`) order: inactive controller → `false` for **every** operator including `neq` (the cascade rule); errored controller (`value: null`) → `false`; then SELECT string `eq`/`neq` or NUMBER numeric compare (`between` inclusive).
- Summary lines come from `render-meaning.util.ts`: `{value}` is always replaced; `{label}` only for SELECT segments (the matched option's label).

## Saved configurations (Step 6, Phase 2)

`SavedConfiguration` is a **frozen snapshot** (§2.5): `productName`, `code`, `summary` (jsonb `string[]`), and the raw `selections` map are copied at save time and never re-resolved — admin edits to definitions/options/products afterwards have zero effect on saved rows (e2e-proven: option relabel + product soft-delete leave a snapshot byte-identical). `productId` exists for listing/filtering only and is `SET NULL` on a hard product delete; `userId` is `CASCADE`, so deleting a user removes their snapshots at the DB level (nothing in `RemoveOneByIdProvider` needs to know). `quoteRequestedAt` is a Step-6 column written only by Step 7's request-quote endpoint.

Non-obvious wiring:

- **`POST /configurators/:slug/save` lives on `ConfiguratorsController`** (the slug belongs to that path family) but delegates to `SavedConfigurationsService`, not `ConfiguratorsService` — the latter stays the one facade with no `AuditLogService`. `@Auth(AuthType.None)` on the sibling routes is per-route, so `save` is plain Bearer (any role, bare `@ApiAuth()`).
- **Save re-resolves server-side** (`findOneBySlugPublishedOrFail` + `ConfiguratorResolverService`) and never trusts a client-composed code. An invalid resolve → 400 whose `message` is the resolver's per-segment error messages as a string array (the class-validator 400 shape). Unknown/unpublished/soft-deleted slug → 404, same rule as resolve.
- **Ownership → 404, not 403.** `FindOneSavedConfigurationProvider.findOneOwnedOrFail(id, userId)` scopes the query `where: { id, userId }`, so a foreign snapshot is indistinguishable from a missing id — deliberately unlike the posts `FindOnePostForEditProvider` 403 pattern, per §5.3.
- List ordering uses `paginateQueryBuilder` purely for the guaranteed `createdAt DESC, id DESC` (the contact-inbox reasoning); deletes are hard (`DeleteResultDto`); audit entity string is `'SavedConfiguration'`.

## Request-quote (Step 7)

`POST /saved-configurations/:id/request-quote` stamps `quoteRequestedAt` and emails the site owner. It lives on `SavedConfigurationsController` alongside the other owner-scoped routes, delegating to `RequestQuoteSavedConfigurationProvider`.

- **`@HttpCode(HttpStatus.OK)` (200), not the `@Post()` default 201.** This mutates one column on an existing row — it doesn't create a resource — so it's closer to `PATCH /contact/:id`'s `handled` toggle than to `save` (which inserts a new row and keeps 201).
- **The 409 idempotency check runs before any mutation, save, audit log, or event emit.** `if (savedConfiguration.quoteRequestedAt) throw new ConflictException(...)` is the very first thing after the owner-scoped 404 lookup — this is what guarantees a repeat call never re-sends the notification email, since the provider throws before reaching the emit line.
- **`User` is registered directly in `ConfiguratorModule`'s `TypeOrmModule.forFeature`** (alongside the five configurator entities) purely so the provider can look up the requester's `email`/`firstName` for the email — the same pattern `AdminModule` uses for read-only cross-cutting access to a foreign entity, rather than importing all of `UsersModule`. `FindOneSavedConfigurationProvider.findOneOwnedOrFail` — used by the hot `GET`/`DELETE` paths too — is untouched; it does not load the `user` relation.
- **`MailModule` is now imported into `ConfiguratorModule`** (it wasn't needed before Step 7) — not global, per `src/mail/CLAUDE.md`.
- The event payload (`QuoteRequestedPayload` in `src/common/events/app-events.ts`) carries `savedConfigurationId`, `userEmail`, `userFirstName`, `productName`, `code`, `summary` — everything `QuoteEventsListener` needs to call `MailService.sendQuoteRequestMail()` without a second DB round trip.
- Audit action is `AuditAction.UPDATE` on entity `'SavedConfiguration'` — the same entity string the Step 6 `CREATE`/`DELETE` audit rows use, so `GET /audit-logs?entity=SavedConfiguration` groups the whole lifecycle together.

## OpenAPI schema fixes (2026-07-12, found while briefing the frontend)

Three `@nestjs/swagger` annotation gaps were fixed — none changed runtime behavior, only what
`openapi-types.ts` exposes:

- `SavedConfiguration.productId` was missing an explicit `type: Number` on its
  `@ApiPropertyOptional` (a `number | null` union without an explicit `type` emits `Object`
  metadata per the nullable-union gotcha in the root `CLAUDE.md` — this rendered as an unusable
  type on the frontend). Fixed to `@ApiPropertyOptional({ type: Number, ... })`.
- `SegmentDefinition.options` and `ConfigurableProduct.assignments` are both genuinely populated
  at runtime (`FindOneSegmentDefinitionProvider`/`FindOneConfigurableProductProvider` always load
  them), but neither had an `@ApiProperty` decorator, so they were silently absent from the
  generated types even though the JSON response always includes them. Both are now decorated
  (`@ApiPropertyOptional({ type: () => X, isArray: true })`), matching the sibling
  `ProductSegmentAssignment.definition`/`.product` fields which were already decorated correctly.
  Decorating `ConfigurableProduct.assignments` introduces a circular class reference
  (`ConfigurableProduct` → `assignments: ProductSegmentAssignment[]` → `.product:
  ConfigurableProduct` → …) — verified safe: `@nestjs/swagger` resolves this as a normal `$ref`
  cycle in the OpenAPI document (confirmed via `pnpm run generate:schema` + inspecting
  `openapi.json`), and `openapi-typescript` handles the resulting recursive type fine. No crash,
  no infinite expansion.

`SegmentDefinition.assignments` was deliberately left undecorated — nothing populates it for a
definition-scoped read, so typing it would just be permanently `undefined`/empty.

The real shapes behind the two jsonb fields that are intentionally typed as a generic object in
Swagger (`constraints`, `condition`) — not worth breaking into a discriminated union in the
schema, but the frontend needs the real TS shape by hand:

```ts
// SegmentDefinition.constraints, keyed by dataType
interface StringConstraints { minLength: number; maxLength: number; pattern?: string }
interface NumberConstraints { digits: number; min: number; max: number } // digits = zero-fill width
// SELECT: constraints is empty/irrelevant

// ProductSegmentAssignment.condition
interface AssignmentCondition {
  controllingAssignmentId: number
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'between'
  value?: string   // eq/neq
  min?: number     // between
  max?: number     // between
  effect: 'zero_fill' // the only effect that currently exists
}
```

## Non-obvious admin-side rules (Steps 2–4)

Detail lives in the root `CLAUDE.md` architecture paragraph and `STATE.md`; headlines only:

- `SegmentOption.value` of `'0'` is always rejected; options only on SELECT definitions; a definition's `dataType` is immutable (409) once assigned; deleting an assigned definition/option is blocked (409).
- Assignment position renumbering is gapless and runs in a manual `QueryRunner` transaction (`renumber-assignments.util.ts`) using a **negate-then-finalize** two-step shift — a single-statement `position = position ± 1` bulk `UPDATE` genuinely violates the `(productId, position)` unique constraint because PostgreSQL checks it per row, not at statement end. Reuse `shiftRange` for any future bulk shift.
- Condition validation is split: `validate-assignment-condition.util.ts` (pure shape, dispatched on `operator`) vs `validate-assignment-condition-rules.util.ts` (DB-dependent: direction rule, operator×dataType matrix, NUMBER controller needs `constraints.min >= 1`).
- Soft-deleting a `ConfigurableProduct` keeps its Cloudinary image (unlike `Product`'s soft-delete, which purges) — see CONFIGURATOR.md §2.1. The image is a bare-columns single slot (avatar-options pattern, no `UploadFile` row), settable only via the image endpoints, never via create/update DTOs.

## Testing

- Pure utils and the resolver have colocated `*.spec.ts` unit tests (plain Jest, no `TestingModule`); the resolver spec builds the §6 fixture in memory.
- e2e: `test/configurator/definitions.e2e-spec.ts`, `products.e2e-spec.ts`, `assignments.e2e-spec.ts`, `resolve.e2e-spec.ts`, `saved-configurations.e2e-spec.ts`. The resolve suite seeds the §6 worked example through the real admin HTTP API (four products: published, unpublished, soft-deleted, and a STRING-segment one) and exercises every §6 bullet tokenlessly. The saved-configurations suite uses a compact two-segment fixture, three users (admin/owner/other), and ends with the snapshot-immutability proof — it mutates the shared fixture (option relabel, product soft-delete), so its immutability describe must stay last in the file. Its `POST .../request-quote` block (inserted just before the immutability block) proves the 200 status, the mail payload contents, the 404/foreign-owner rule, and — critically — that a 409 second call does not re-send the mail (`sendQuoteRequestMailMock` called exactly once across both requests).
