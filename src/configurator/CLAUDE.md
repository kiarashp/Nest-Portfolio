# CLAUDE.md — src/configurator

Guidance specific to this module. See the root `CLAUDE.md` for the high-level architecture and **`CONFIGURATOR.md`** for the full domain design (entities, rules, resolve algorithm, API surface, worked example, step plan). This file covers what is not obvious from either.

## What this module is

The ordering-code configurator: the admin defines reusable segment definitions and assembles them into configurable products; customers compose an ordering code position by position (e.g. `FRH-2d-no-00-000-0450`) and the backend resolver validates selections, evaluates zero-fill conditions, and renders the code plus a human-readable summary. Fully separate from `src/products/` — all tables use the `configurator_` prefix.

## Module structure

Four entities, four controllers, four service facades, single-purpose providers, and a set of pure utils.

```
src/configurator/
  entities/
    configurable-product.entity.ts      — soft-delete (@DeleteDateColumn); imageUrl/imagePublicId bare columns
    segment-definition.entity.ts        — exports StringConstraints / NumberConstraints / SegmentConstraints
    segment-option.entity.ts            — SELECT choices, onDelete: CASCADE from definition
    product-segment-assignment.entity.ts — exports AssignmentCondition; (productId, position) unique
  enums/
    segment-data-type.enum.ts           — STRING | NUMBER | SELECT
  dtos/                                  — create/update/get DTOs per entity, plus:
    configurator-form-schema.dto.ts     — response-only classes for GET /configurators/:slug
    resolve-configuration.dto.ts        — { selections: Record<string, string> } (@IsObject only — deep validation in parse-selections.util)
    resolve-result.dto.ts               — ResolveResultDto / ResolveErrorDto / ResolveSegmentStateDto
  providers/
    configurator-definitions.service.ts — facade: SegmentDefinition + SegmentOption CRUD (Step 2)
    configurator-products.service.ts    — facade: ConfigurableProduct CRUD + image + assignment create (Steps 3–4)
    configurator-assignments.service.ts — facade: assignment update/delete (Step 4)
    configurators.service.ts            — facade: the two public endpoints (Step 5); no AuditLogService
    configurator-resolver.service.ts    — the §4.3 resolve algorithm; @Injectable but dependency-free
    <single-purpose providers>          — create/find/update/delete per entity, image upload/delete
    <pure utils, *.util.ts>             — see below; each has a colocated *.spec.ts
  configurator-definitions.controller.ts — admin; NO base prefix (mixes /configurator-definitions/* and /configurator-options/*)
  configurator-products.controller.ts    — admin; /configurator-products (+ POST :id/assignments)
  configurator-assignments.controller.ts — admin; /configurator-assignments/:assignmentId
  configurators.controller.ts            — PUBLIC; /configurators/:slug and /configurators/:slug/resolve
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

## Non-obvious admin-side rules (Steps 2–4)

Detail lives in the root `CLAUDE.md` architecture paragraph and `STATE.md`; headlines only:

- `SegmentOption.value` of `'0'` is always rejected; options only on SELECT definitions; a definition's `dataType` is immutable (409) once assigned; deleting an assigned definition/option is blocked (409).
- Assignment position renumbering is gapless and runs in a manual `QueryRunner` transaction (`renumber-assignments.util.ts`) using a **negate-then-finalize** two-step shift — a single-statement `position = position ± 1` bulk `UPDATE` genuinely violates the `(productId, position)` unique constraint because PostgreSQL checks it per row, not at statement end. Reuse `shiftRange` for any future bulk shift.
- Condition validation is split: `validate-assignment-condition.util.ts` (pure shape, dispatched on `operator`) vs `validate-assignment-condition-rules.util.ts` (DB-dependent: direction rule, operator×dataType matrix, NUMBER controller needs `constraints.min >= 1`).
- Soft-deleting a `ConfigurableProduct` keeps its Cloudinary image (unlike `Product`'s soft-delete, which purges) — see CONFIGURATOR.md §2.1. The image is a bare-columns single slot (avatar-options pattern, no `UploadFile` row), settable only via the image endpoints, never via create/update DTOs.

## Testing

- Pure utils and the resolver have colocated `*.spec.ts` unit tests (plain Jest, no `TestingModule`); the resolver spec builds the §6 fixture in memory.
- e2e: `test/configurator/definitions.e2e-spec.ts`, `products.e2e-spec.ts`, `assignments.e2e-spec.ts`, `resolve.e2e-spec.ts`. The resolve suite seeds the §6 worked example through the real admin HTTP API (four products: published, unpublished, soft-deleted, and a STRING-segment one) and exercises every §6 bullet tokenlessly.
