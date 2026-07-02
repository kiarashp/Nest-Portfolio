# Configurator Module — Design & Implementation Plan

**Status:** Design finalized; adapted to this codebase on 2026-07-03 (routes, PKs, deletion model, image handling, testing/migration workflow all confirmed with the owner). Nothing here is open — if something genuinely ambiguous surfaces during implementation, stop and ask instead of inventing.

**Domain context:** This is an *ordering code configurator* (industrial "type code" / "model code builder"). The customer composes a product code position by position (e.g. `FRH-2d-no-00-000-0450`); each position has a machine value and a human meaning. The admin defines the segments; the customer fills a form; the system renders the code and a human-readable summary.

**Hard rule:** this module is **fully separate** from the existing `products` module (`Product` / `ProductType` entities). Do not touch, extend, or reference those entities. All new tables use the `configurator_` prefix. New code lives in `src/configurator/`.

**Implementation is step-by-step:** see §7. Each step is self-contained, ends fully green (`pnpm run lint`, `pnpm run test`, `pnpm run test:e2e`), and is committed before the next step starts.

---

## 1. Vocabulary

| Term | Meaning |
|---|---|
| **ConfigurableProduct** | A configurable product family the admin creates (e.g. "Resistive sensor with cap", code prefix `FRH`). Has a public form endpoint at `GET /configurators/:slug`. |
| **SegmentDefinition** | A reusable field definition in a shared library: data type, constraints, options, meaning. Defined once, assignable to many products. |
| **SegmentOption** | For SELECT definitions: one allowed value + its human meaning (`1m` → "single Pt100"). |
| **ProductSegmentAssignment** | Join entity: places a SegmentDefinition at a **position** inside one ConfigurableProduct, optionally with a **condition**. |
| **Condition** | A rule on an assignment: if the controlling segment's value meets/fails a comparison, this segment is **zero-filled**. |
| **Zero-fill** | The segment still appears in the code, but as `0` (STRING/SELECT) or `0` repeated to full width (NUMBER, e.g. `000`). It is omitted from the human summary. |
| **Resolver** | The backend service that validates selections, evaluates conditions, composes the code, and renders the summary. Single source of truth. |
| **SavedConfiguration** | (Phase 2) A frozen snapshot of a resolved configuration owned by a registered user. |

Key reuse rule: a SegmentDefinition's label, values, and meanings are **identical everywhere it is used**. There are no per-product overrides of any kind. Editing a definition changes it live in every product that uses it (saved configurations are unaffected — they are snapshots). If the admin needs two similar-but-differently-labeled fields, they create two definitions.

---

## 2. Entities

All entities: `@PrimaryGeneratedColumn() id: number` (int auto-increment — the project convention; there are no uuids anywhere), `@CreateDateColumn createdAt`, `@UpdateDateColumn updatedAt`. **Soft delete (`@DeleteDateColumn deletedAt`) only on `ConfigurableProduct`** (mirrors `Product`); definitions, options, and assignments hard-delete, protected by the RESTRICT/409 rules in §4.4. Entities live in `src/configurator/entities/`, the `SegmentDataType` enum in `src/configurator/enums/segment-data-type.enum.ts` as a Postgres native enum column (same pattern as `User.role` / `Post.status`).

### 2.1 ConfigurableProduct — table `configurator_product`

| Column | Type | Notes |
|---|---|---|
| name | varchar, unique | Admin + customer facing, e.g. "Resistive sensor with cap" |
| slug | varchar, unique | Public URL slug, client-supplied in the DTO (project convention — no auto-slugify) |
| codePrefix | varchar | e.g. `FRH`. Static string, always the first token of the code. |
| separator | varchar(1), default `'-'` | Not exposed in admin DTOs for now; column exists for the future. |
| description | text, nullable | Public page copy |
| imageUrl | varchar, nullable | Cloudinary secure URL |
| imagePublicId | varchar, nullable | Cloudinary public id — stored so the asset can be destroyed on replace/delete |
| isPublished | boolean, default false | Unpublished products are invisible on public endpoints (404, same as product drafts) |
| deletedAt | `@DeleteDateColumn` | Soft delete — excluded from all queries unless `withDeleted: true` |

Image handling follows the **avatar-options pattern** (`src/users/` avatar-option providers): upload via `StorageProvider` directly, store bare `imageUrl` + `imagePublicId` on the entity — **no `UploadFile` rows, no changes to the uploads module**. Replacing the image destroys the old Cloudinary asset; soft-deleting the product keeps the asset (same spirit as products keeping their UploadFiles on soft-delete).

### 2.2 SegmentDefinition — table `configurator_segment_definition`

| Column | Type | Notes |
|---|---|---|
| name | varchar, unique | Admin-facing library name, e.g. "Sensor type (1m/2m/1d/2d)" |
| label | varchar | Customer-facing question, e.g. "Sensor type" |
| dataType | enum `STRING` \| `NUMBER` \| `SELECT` | Postgres enum column, `SegmentDataType` |
| constraints | jsonb | Shape depends on dataType, see §3.1 |
| meaningTemplate | varchar | Human summary line, e.g. `"Insertion length: {value} mm"` or `"Sensor: {label}"`. Placeholders: `{value}` = raw value; `{label}` = matching SegmentOption label (SELECT only). |

### 2.3 SegmentOption — table `configurator_segment_option`

Only for definitions with `dataType = SELECT`.

| Column | Type | Notes |
|---|---|---|
| definitionId | FK → segment_definition, `onDelete: CASCADE` | |
| value | varchar | What goes into the code, e.g. `2d`. Unique per definition (composite unique `(definitionId, value)`). **Must not equal `'0'`** (reserved). |
| label | varchar | Human meaning, e.g. "double Pt500" |
| sortOrder | int | Display order in the dropdown |

### 2.4 ProductSegmentAssignment — table `configurator_assignment`

| Column | Type | Notes |
|---|---|---|
| productId | FK → configurator_product, `onDelete: CASCADE` | |
| definitionId | FK → segment_definition, **`onDelete: RESTRICT`** | A definition in use cannot be deleted. |
| position | int | 1-based, **gapless per product**, maintained server-side. |
| condition | jsonb, nullable | See §3.2. Max ONE condition per assignment (stored as a single object; do not implement arrays/AND/OR). |

Unique constraints: `(productId, position)` **and** `(productId, definitionId)` — a definition may appear at most once per product. DB constraints plus friendly service errors (Postgres `23505` → `ConflictException`, the tags/products pattern).

### 2.5 SavedConfiguration — table `configurator_saved_configuration` (Phase 2 only)

A frozen snapshot. **Never re-resolved against live config.** Admin edits to definitions/products after saving have zero effect on saved rows.

| Column | Type | Notes |
|---|---|---|
| userId | FK → `User`, `onDelete: CASCADE` | Registered users only |
| productId | FK → configurator_product, nullable, `onDelete: SET NULL` | For listing/filtering only; row survives product deletion |
| productName | varchar | Snapshot |
| code | varchar | Snapshot of the full composed code, e.g. `FRH-2d-no-00-000-0450` |
| summary | jsonb | Snapshot: array of rendered summary strings |
| selections | jsonb | Snapshot of the raw selections map (for reference only) |
| quoteRequestedAt | timestamp, nullable | Set when the user requests a quote |

---

## 3. JSONB shapes

### 3.1 `SegmentDefinition.constraints`

```jsonc
// dataType = STRING
{ "minLength": 1, "maxLength": 5, "pattern": "^[a-z]+$" }   // pattern optional

// dataType = NUMBER
{ "digits": 4, "min": 50, "max": 2000 }
// Value is a zero-padded string of exactly `digits` characters.
// Customer may type "50"; backend normalizes/accepts both "50" and "0050";
// stored/rendered form is always padded: String(n).padStart(digits, '0').
// min/max validated numerically after parsing.

// dataType = SELECT
{}   // options live in configurator_segment_option
```

**Validation pattern:** mirror `FilterableFieldDto` (`src/products/dto/create-product-type.dto.ts`) — dedicated class-validator classes `StringConstraintsDto` / `NumberConstraintsDto` with `@ValidateNested()` + `@Type()`. Because the valid shape depends on the sibling `dataType` field, the **provider** does the per-type dispatch (reject unknown keys, require the right shape for the declared type); the entity keeps a plain TS interface for internal typing, separate from the DTOs.

### 3.2 `ProductSegmentAssignment.condition`

```jsonc
{
  "controllingAssignmentId": 123,   // int id of another assignment in the SAME product
  "operator": "eq" | "neq" | "gt" | "lt" | "between",
  "value": "no",            // for eq / neq / gt / lt
  "min": 300, "max": 1000,  // for between (inclusive bounds), instead of "value"
  "effect": "zero_fill"     // only allowed value for now; field exists for future effects
}
```

Semantics: **the condition describes when the segment is ACTIVE.** If the condition is met → segment is active, customer must fill it. If not met → segment is zero-filled. A segment with `condition = null` is always active.

---

## 4. Rules (the resolver's law)

These rules are the heart of the module. Every one of them must have e2e coverage.

### 4.1 The reserved `0`

- `0` is the universal "nothing here" marker.
- Zero-fill rendering: STRING and SELECT segments render as a single `0`; NUMBER segments render as `0` repeated to `digits` width (`00`, `000`, `0000`).
- A SegmentOption with `value = '0'` is rejected at admin time.
- A customer-provided STRING value of exactly `"0"` is rejected at resolve time.
- Any NUMBER definition used as the **target** of a condition must have `min >= 1` (enforced at assignment-creation time), so a forced fill can never collide with a legitimate value.

### 4.2 Condition evaluation

- Operators: `eq`, `neq`, `gt`, `lt`, `between` (inclusive).
- Allowed controller dataTypes: `SELECT` (operators `eq`, `neq`) and `NUMBER` (all five operators, compared numerically). `STRING` definitions can never be controllers.
- **Direction rule:** `controllingAssignmentId` must reference an assignment at a **strictly lower position in the same product**. Enforced at admin time and re-validated on every reorder. This guarantees no cycles and lets the resolver run as a single forward pass in position order.
- **Cascade rule (critical):** if the controlling segment is itself zero-filled, every condition watching it evaluates as **NOT MET**, regardless of operator. This applies to `neq` too: even though `0 ≠ x` is technically true, a zero-filled controller means "nothing is there", so dependents zero-fill as well. Cascades propagate naturally down the chain (pos 2 = `no` → pos 3 zero-filled → pos 5, which watches pos 3, zero-fills too).
- One condition per assignment. No AND/OR. (Chains already express compound dependency.)

### 4.3 Resolve algorithm (ConfiguratorResolverService)

Input: `{ selections: { [assignmentId]: string } }` — keyed by assignment id (int), not position.

1. Load the product with assignments (ordered by position), definitions, and options.
2. Iterate assignments in position order. For each:
   a. If it has a condition, evaluate it against the *resolved state* of the controller (which is earlier in the pass). Controller zero-filled → not met.
   b. If not active → resolved value = zero-fill string (§4.1); mark `zeroFilled: true`. Any customer-supplied value for this assignment is **ignored** (not an error).
   c. If active → a value is **required**. Validate against the definition: STRING length/pattern and `!== "0"`; NUMBER parse, digits width after padding, min/max; SELECT value must be an existing option of the definition.
3. Collect all validation failures; do not stop at the first.
4. Compose code: `codePrefix + separator + resolvedValues.join(separator)`.
5. Render summary: for each **active** segment, apply `meaningTemplate` (`{value}`, and `{label}` for SELECT). **Zero-filled segments are omitted from the summary entirely.** This is the backend's job, not the frontend's — the snapshot in Phase 2 stores this rendered summary.

Output:

```jsonc
{
  "valid": true | false,
  "errors": [ { "assignmentId": 12, "message": "..." } ],
  "code": "FRH-2d-no-00-000-0450",        // only when valid
  "summary": [ "Sensor: double Pt500", "Insertion length: 450 mm" ],  // only when valid
  "segments": [                            // always: per-segment resolved state for the UI
    { "assignmentId": 11, "position": 1, "active": true,  "value": "2d" },
    { "assignmentId": 14, "position": 4, "active": false, "value": "000" }
  ]
}
```

(Wrapped in the global `{ apiVersion, data }` envelope like every other response — the resolver returns the plain object.)

### 4.4 Admin-time validation (in providers, with clear error messages)

- Definition constraints jsonb must match the dataType shape (per-type DTO dispatch, §3.1; reject unknown keys).
- SELECT definitions must have ≥ 2 options before they can be assigned to a product.
- Option `value` unique per definition; never `'0'`.
- Assignment: `(productId, position)` and `(productId, definitionId)` uniqueness (DB constraint + friendly service error).
- Condition: controller exists in same product, lower position, allowed dataType/operator combo (§4.2), `between` has `min < max`, target NUMBER definitions have `min >= 1`.
- Deleting an assignment that is a **controller** for other assignments → `409` with the list of dependent positions. (Same spirit as the RESTRICT on definitions.)
- Deleting/removing an assignment renumbers positions to stay gapless. Because conditions reference **assignment ids, not position numbers**, they survive renumbering; the direction rule is re-checked after any reorder and the operation is rejected if it would flip a dependency direction.
- Editing a definition's `dataType` after it has assignments → rejected (`409`). Changing constraints/options/label/meaning is allowed and is live everywhere immediately (saved configurations are snapshots and unaffected).

---

## 5. API

Project conventions apply everywhere: **no `/admin/` URL prefix** — admin access is `@Roles(UserRole.ADMIN)` + `@ApiAuth({ roles: [UserRole.ADMIN] })` on normal resource paths (exactly like `product-types`/`products`); public routes use `@Auth(AuthType.None)`. Every write threads `@ActiveUser('sub')` down to the provider and logs via `AuditLogService.log(...)` after success. Responses documented with `ApiDataResponse` / `ApiArrayDataResponse` / `ApiPaginatedResponse` (`src/common/swagger/api-response.helpers.ts`); deletes return `DeleteResultDto`. Lists paginate via the shared `PaginationProvider.paginateQuery` (thread `@Req()` down, products pattern).

### 5.1 Admin (ADMIN role only)

```
# Segment library
GET    /configurator-definitions                  # paginated
POST   /configurator-definitions
GET    /configurator-definitions/:id              # includes options
PATCH  /configurator-definitions/:id              # dataType change while assigned → 409
DELETE /configurator-definitions/:id              # RESTRICT if assigned anywhere → 409 with product list

POST   /configurator-definitions/:id/options
PATCH  /configurator-options/:optionId
DELETE /configurator-options/:optionId            # 409 if it would leave a SELECT with < 2 options while assigned

# Configurable products
GET    /configurator-products                     # paginated, includes unpublished (admin view)
POST   /configurator-products
GET    /configurator-products/:id                 # includes ordered assignments w/ definitions + options
PATCH  /configurator-products/:id                 # name, slug, codePrefix, description, isPublished
DELETE /configurator-products/:id                 # soft delete
POST   /configurator-products/:id/image           # multipart upload via StorageProvider; replaces + destroys old asset
DELETE /configurator-products/:id/image           # clears imageUrl/imagePublicId, destroys asset

# Assignments
POST   /configurator-products/:id/assignments     # { definitionId, position?, condition? } (default position: append)
PATCH  /configurator-assignments/:assignmentId    # { position?, condition? }  (position change = reorder + revalidate)
DELETE /configurator-assignments/:assignmentId    # 409 if controller of others; renumbers on success
```

No route-ordering gotchas: all literal segments (`image`, `assignments`, `options`) sit after an `:id` segment, and the public controller uses string slugs, so `ParseIntPipe` conflicts don't arise. Double-check anyway when adding routes (CLAUDE.md "Route-ordering gotchas").

### 5.2 Public (no auth — `@Auth(AuthType.None)`)

```
GET  /configurators/:slug        # 404 if not published or soft-deleted. Returns the full form schema:
                                 # product {name, description, imageUrl, codePrefix, separator}
                                 # segments[] ordered by position:
                                 #   {assignmentId, position, label, dataType, constraints,
                                 #    options[]{value,label} (SELECT only),
                                 #    condition (controllingAssignmentId, operator, value/min/max)}
                                 # Conditions ARE exposed so SvelteKit can live-disable inputs;
                                 # the backend resolve remains the source of truth.

POST /configurators/:slug/resolve   # body { selections } → §4.3 output. Stateless. Guests use this too.
```

Guests: fill the form, see code + summary on screen. Nothing persists for guests. No guest quoting (explicitly out of scope). Throttling: the global default (60 req / 60s per IP) is sufficient for `resolve` — no per-route `@Throttle()` override (and it's bypassed in development like everything else).

### 5.3 Phase 2 — saved configurations & quote (auth: any registered user, bare `@ApiAuth()`)

```
POST   /configurators/:slug/save                    # body { selections }. Server re-resolves internally;
                                                    # rejects if invalid; stores snapshot (§2.5). NEVER trusts a client-composed code.
GET    /saved-configurations                        # paginated list of the caller's own snapshots (self-scoped, like GET /posts/my)
GET    /saved-configurations/:id                    # 404 if not owner
DELETE /saved-configurations/:id                    # 404 if not owner
POST   /saved-configurations/:id/request-quote      # sets quoteRequestedAt (idempotent guard: second call → 409),
                                                    # emits AppEvents.QUOTE_REQUESTED → listener → MailService.sendQuoteRequestMail()
                                                    # recipient: QUOTE_NOTIFY_EMAIL env (optional; falls back to MAIL_FROM, the
                                                    # same recipient pattern as the contact notification)
                                                    # email contains: user email/name, product name, code, summary lines.
```

No websockets, no live notifications — email only, via the existing `MailModule` (not global — import it in `ConfiguratorModule`).

---

## 6. Worked example (use as the seed for e2e fixtures)

Product: "Resistive sensor with cap", prefix `FRH`, separator `-`.

| Pos | Definition | Type | Constraints / options | Condition |
|---|---|---|---|---|
| 1 | Sensor type | SELECT | `1m`=single Pt100, `2m`=double Pt100, `1d`=Pt500, `2d`=double Pt500 | — |
| 2 | Has extension? | SELECT | `yes`, `no` | — |
| 3 | Extension length (cm) | NUMBER | digits 2, min 10, max 99 | active if pos2 `eq` `yes` |
| 4 | Extension diameter (mm) | NUMBER | digits 3, min 100, max 800 | active if pos3 `between` 30..99 |
| 5 | Insertion length (mm) | NUMBER | digits 4, min 50, max 2000 | — |

- Selections `{1: "2d", 2: "yes", 3: "45", 4: "300", 5: "450"}` → code `FRH-2d-yes-45-300-0450`; summary has 5 lines.
- Selections `{1: "2d", 2: "no", 5: "450"}` → pos 3 zero-fills (`00`), pos 4 **cascades** to `000` (its controller is zero-filled) → code `FRH-2d-no-00-000-0450`; summary has 3 lines (zero-filled omitted).
- Selections `{1: "2d", 2: "yes", 3: "15", 4: "300", 5: "450"}` → pos 3 = 15, `between 30..99` not met → pos 4 zero-fills; a supplied value for pos 4 is ignored → `FRH-2d-yes-15-000-0450`.
- `{2: "no", ...}` plus a value sent for pos 3 → value ignored, no error.
- `{5: "2001"}` → validation error (max 2000). `{5: "50"}` → normalized to `0050`.

(Position numbers above are shorthand — real selections are keyed by assignment id.)

---

## 7. Implementation steps

Module layout follows the standard domain-module convention: `src/configurator/configurator.module.ts` → controllers → thin service facades → single-purpose `providers/*.provider.ts`, with `dtos/`, `entities/`, `enums/`, `listeners/` (Phase 2). Comment style per CLAUDE.md (`//` on injections, JSDoc on public methods).

**Every step ends with:** comments written, unit/e2e tests written, existing tests checked, `pnpm run lint` + `pnpm run test` + `pnpm run test:e2e` fully green, then commit. Migration files are generated (`pnpm run typeorm migration:generate src/database/migrations/<Name> -d src/database/data-source.ts`) and committed **in the same commit as the entity change** — dev runs on `DB_SYNC=true` so the migration is for production deploys only. Regenerate `openapi-types.ts` (`pnpm run generate:types`) at the end of each phase (steps 5 and 7).

e2e conventions (test/CLAUDE.md): suites share one DB and run in parallel — namespace all seeded emails/slugs (`configurator-…@e2e.test`, `configurator-…` slugs), pre-clean in `beforeAll`, use `createApp()`/`seedUser()`/`getAuthToken()` helpers, never assert cross-suite `totalItems` invariants.

### Phase 1 — configurator core (public = display only)

**Step 1 — Module skeleton + entities + migration.**
- `ConfiguratorModule` registered in `AppModule`; imports `TypeOrmModule.forFeature([...])`, `AuditLogModule`, `PaginationModule`, `UploadsModule` (for `StorageProvider`).
- Entities per §2 (all except `SavedConfiguration`), `SegmentDataType` enum, unique/FK constraints per §2/§4.4.
- Check whether `SeedModule`/`DevSeedModule` explicit `entities: [...]` lists need the new entities (they do if any imported module pulls them in transitively — likely not, since nothing else references configurator entities; verify the seeds still boot).
- Generate + review + commit the migration.
- Tests: none beyond app-boots (existing e2e suites passing proves wiring).

**Step 2 — Segment definition library CRUD + options.**
- `ConfiguratorDefinitionsController` (+ options routes per §5.1), `ConfiguratorDefinitionsService` facade, providers: create/find-all(paginated)/find-one/update/delete definition; create/update/delete option.
- Constraint-shape validation per §3.1 (nested DTOs + provider dispatch, exemplar `src/products/dto/create-product-type.dto.ts`).
- Rules: option `value` ≠ `'0'`, unique per definition (23505 → 409); definition `dataType` immutable once assigned (409 — trivially true in this step, enforced for step 4 onward); delete definition → 409 with product list if assigned; delete option → 409 if it would leave an *assigned* SELECT with < 2 options.
- Audit logs on every write. `@ApiAuth({ roles: [ADMIN] })` + response helpers throughout.
- e2e: `test/configurator/definitions.e2e-spec.ts` — CRUD happy paths, each 400/409 rule above, non-admin 403, anonymous 401.

**Step 3 — ConfigurableProduct CRUD + image.**
- `ConfiguratorProductsController`, service facade, providers: create/find-all(paginated, admin view incl. unpublished)/find-one/update/soft-delete.
- Slug/name 23505 → 409. `isPublished` flag in create/patch DTOs.
- Image: `POST /configurator-products/:id/image` (multipart, `FileInterceptor` + `ParseFilePipe` size/type validators, same limits as products) uploading via `StorageProvider` directly (avatar-options exemplar in `src/users/`), storing `imageUrl`/`imagePublicId`; replacing or `DELETE …/image` destroys the old Cloudinary asset. Soft-deleting the product keeps the asset.
- Audit logs, OpenAPI decorators.
- e2e: `test/configurator/products.e2e-spec.ts` — CRUD, soft-delete excluded from admin list by default, slug conflict, role guards. (Image endpoints: e2e with a mocked `StorageProvider`, matching however the existing upload e2e handles Cloudinary.)

**Step 4 — Assignments.**
- Routes per §5.1 on `ConfiguratorProductsController` (`POST :id/assignments`) + `ConfiguratorAssignmentsController` (PATCH/DELETE).
- Add (default position: append), remove, reorder — gapless renumbering maintained server-side inside a transaction.
- Condition validation per §4.2/§4.4: direction rule (re-checked on every reorder), operator×dataType matrix, `between min < max`, NUMBER-target `min >= 1`, SELECT definitions need ≥ 2 options to be assignable, `(productId, definitionId)` uniqueness, controller-delete → 409 listing dependent positions.
- Audit logs, OpenAPI decorators.
- e2e: `test/configurator/assignments.e2e-spec.ts` — every validation rule above, renumbering after delete, reorder-flips-direction rejected.

**Step 5 — Resolver + public endpoints.** *(largest step)*
- Pure utils in `src/configurator/utils/`: condition evaluator (incl. cascade rule) and zero-fill/padding renderer — colocated Jest `*.spec.ts` unit tests (this project uses Jest, not Vitest).
- `ConfiguratorResolverService` implementing §4.3 exactly (collect-all-errors, forward pass, summary omission).
- `ConfiguratorsController` (public): `GET /configurators/:slug` (404 if unpublished/deleted; full form schema per §5.2) and `POST /configurators/:slug/resolve`, both `@Auth(AuthType.None)`.
- e2e: `test/configurator/resolve.e2e-spec.ts` seeding the §6 fixture — every §6 bullet, plus: unpublished slug → 404; unknown SELECT value; STRING `"0"` rejected; missing required active segment; extra selections for zero-filled segments ignored; multi-error collection.
- Regenerate `openapi-types.ts`. Update CLAUDE.md (root: module in architecture list + any route-ordering/serialization notes; consider `src/configurator/CLAUDE.md` if warranted).

### Phase 2 — accounts & quotes

**Step 6 — SavedConfiguration.**
- Entity §2.5 + migration. `POST /configurators/:slug/save` (any authenticated user; server re-resolves, rejects invalid, snapshots product name/code/summary/selections — never trusts a client-composed code).
- `SavedConfigurationsController`: `GET /saved-configurations` (own, paginated), `GET`/`DELETE /saved-configurations/:id` (owner check → 404), bare `@ApiAuth()`.
- e2e: save/list/get/delete + ownership 404s + **snapshot immutability**: save, then admin edits the definition's options, then GET the snapshot → code and summary unchanged.

**Step 7 — Request-quote.**
- `POST /saved-configurations/:id/request-quote`: sets `quoteRequestedAt`, second call → 409; emits `AppEvents.QUOTE_REQUESTED` (constant + payload interface in `src/common/events/app-events.ts`) → `QuoteEventsListener` in `src/configurator/listeners/` → new `MailService.sendQuoteRequestMail()` + provider + EJS template per the mail/CLAUDE.md recipe.
- `QUOTE_NOTIFY_EMAIL`: **optional** in `environment.validation.ts` (Joi) + `.env.example` + a config namespace (`appConfig` or `mail`); code falls back to `mail.defaultFrom` when unset (contact-notification pattern).
- e2e: quote sets timestamp, idempotency 409, mail mock called with code/summary (MailService is already mocked in e2e).
- Regenerate `openapi-types.ts`. Final CLAUDE.md/STATE.md sync.

### Explicitly OUT of scope (do not implement, do not scaffold)

- Option filtering (a choice narrowing later options' lists)
- Multiple conditions per segment, AND/OR groups
- Per-product label/meaning overrides of any kind
- Config versioning (snapshots make it unnecessary)
- Guest quoting / guest persistence
- Websocket or in-app notifications
- Per-option preview images (**designed for the future**: nullable `imageUrl`/`imagePublicId` on SegmentOption, frontend swaps the product image as fields are filled; adding it later is a non-breaking additive migration and schema-endpoint field. Do not add the columns now.)
