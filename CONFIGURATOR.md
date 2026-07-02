# Configurator Module — Design & Task Plan

**Status:** All design decisions finalized through discussion. Nothing in this document is open. If something is genuinely ambiguous during implementation, add it to QUESTIONS.md and stop — do not invent.

**Domain context:** This is an *ordering code configurator* (industrial "type code" / "model code builder"). The customer composes a product code position by position (e.g. `FRH-2d-no-00-000-0450`); each position has a machine value and a human meaning. The admin defines the segments; the customer fills a form; the system renders the code and a human-readable summary.

This module is **fully separate** from the existing `product` / `product_type` tables and their modules. Do not touch, extend, or reference those entities. All new tables use the `configurator_` prefix.

---

## 1. Vocabulary

| Term | Meaning |
|---|---|
| **ConfigurableProduct** | A configurable product family the admin creates (e.g. "Resistive sensor with cap", code prefix `FRH`). Has a public page at `/configurable-products/:slug`. |
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

All entities: standard `id` (uuid or the project's existing PK convention), `createdAt`, `updatedAt`, `@DeleteDateColumn deletedAt` (soft delete, matching the rest of the project).

### 2.1 ConfigurableProduct — table `configurator_product`

| Column | Type | Notes |
|---|---|---|
| name | varchar, unique | Admin + customer facing, e.g. "Resistive sensor with cap" |
| slug | varchar, unique | Public URL slug |
| codePrefix | varchar | e.g. `FRH`. Static string, always the first token of the code. |
| separator | varchar(1), default `'-'` | Not exposed in admin UI for now; column exists for the future. |
| description | text, nullable | Public page copy |
| imageUrl | varchar, nullable | Cloudinary secure URL (same pattern as existing avatar/product images) |
| imagePublicId | varchar, nullable | Cloudinary public id |
| isPublished | boolean, default false | Unpublished products are invisible on public endpoints |

### 2.2 SegmentDefinition — table `configurator_segment_definition`

| Column | Type | Notes |
|---|---|---|
| name | varchar, unique | Admin-facing library name, e.g. "Sensor type (1m/2m/1d/2d)" |
| label | varchar | Customer-facing question, e.g. "Sensor type" |
| dataType | enum `STRING` \| `NUMBER` \| `SELECT` | |
| constraints | jsonb | Shape depends on dataType, see §3.1 |
| meaningTemplate | varchar | Human summary line, e.g. `"Insertion length: {value} mm"` or `"Sensor: {label}"`. Placeholders: `{value}` = raw value; `{label}` = matching SegmentOption label (SELECT only). |

### 2.3 SegmentOption — table `configurator_segment_option`

Only for definitions with `dataType = SELECT`.

| Column | Type | Notes |
|---|---|---|
| definitionId | FK → segment_definition, `onDelete: CASCADE` | |
| value | varchar | What goes into the code, e.g. `2d`. Unique per definition. **Must not equal `'0'`** (reserved). |
| label | varchar | Human meaning, e.g. "double Pt500" |
| sortOrder | int | Display order in the dropdown |

### 2.4 ProductSegmentAssignment — table `configurator_assignment`

| Column | Type | Notes |
|---|---|---|
| productId | FK → configurator_product, `onDelete: CASCADE` | |
| definitionId | FK → segment_definition, **`onDelete: RESTRICT`** | A definition in use cannot be deleted. |
| position | int | 1-based, **gapless per product**, maintained server-side. |
| condition | jsonb, nullable | See §3.2. Max ONE condition per assignment (stored as a single object; do not implement arrays/AND/OR). |

Unique constraints: `(productId, position)` **and** `(productId, definitionId)` — a definition may appear at most once per product.

### 2.5 SavedConfiguration — table `configurator_saved_configuration` (Phase 2 only)

A frozen snapshot. **Never re-resolved against live config.** Admin edits to definitions/products after saving have zero effect on saved rows.

| Column | Type | Notes |
|---|---|---|
| userId | FK → existing user entity, `onDelete: CASCADE` | Registered users only |
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

### 3.2 `ProductSegmentAssignment.condition`

```jsonc
{
  "controllingAssignmentId": "<uuid of another assignment in the SAME product>",
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

Input: `{ selections: { [assignmentId]: string } }` — keyed by assignment id, not position.

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
  "errors": [ { "assignmentId": "...", "message": "..." } ],
  "code": "FRH-2d-no-00-000-0450",        // only when valid
  "summary": [ "Sensor: double Pt500", "Insertion length: 450 mm" ],  // only when valid
  "segments": [                            // always: per-segment resolved state for the UI
    { "assignmentId": "...", "position": 1, "active": true,  "value": "2d" },
    { "assignmentId": "...", "position": 4, "active": false, "value": "000" }
  ]
}
```

### 4.4 Admin-time validation (in services, with clear error messages)

- Definition constraints jsonb must match the dataType shape (validate with a small schema check; reject unknown keys).
- SELECT definitions must have ≥ 2 options before they can be assigned to a product.
- Option `value` unique per definition; never `'0'`.
- Assignment: `(productId, position)` and `(productId, definitionId)` uniqueness (DB constraint + friendly service error).
- Condition: controller exists in same product, lower position, allowed dataType/operator combo (§4.2), `between` has `min < max`, target NUMBER definitions have `min >= 1`.
- Deleting an assignment that is a **controller** for other assignments → `409` with the list of dependent positions. (Same spirit as the RESTRICT on definitions.)
- Deleting/removing an assignment renumbers positions to stay gapless. Because conditions reference **assignment ids, not position numbers**, they survive renumbering; the direction rule is re-checked after any reorder and the operation is rejected if it would flip a dependency direction.
- Editing a definition's `dataType` after it has assignments → rejected (`409`). Changing constraints/options/label/meaning is allowed and is live everywhere immediately (saved configurations are snapshots and unaffected).

---

## 5. API

### 5.1 Admin (existing admin guard; **admin role only**, same guard pattern as existing product-type admin CRUD)

```
# Segment library
GET    /admin/configurator/definitions            # paginated (existing PaginationProvider pattern)
POST   /admin/configurator/definitions
GET    /admin/configurator/definitions/:id
PATCH  /admin/configurator/definitions/:id
DELETE /admin/configurator/definitions/:id        # RESTRICT if assigned anywhere → 409 with product list

POST   /admin/configurator/definitions/:id/options
PATCH  /admin/configurator/options/:optionId
DELETE /admin/configurator/options/:optionId      # 409 if it would leave a SELECT with < 2 options while assigned

# Configurable products
GET    /admin/configurator/products               # paginated
POST   /admin/configurator/products
GET    /admin/configurator/products/:id           # includes ordered assignments w/ definitions
PATCH  /admin/configurator/products/:id           # name, slug, prefix, description, image, isPublished
DELETE /admin/configurator/products/:id

# Assignments
POST   /admin/configurator/products/:id/assignments        # { definitionId, position?, condition? } (default position: append)
PATCH  /admin/configurator/assignments/:assignmentId       # { position?, condition? }  (position change = reorder + revalidate)
DELETE /admin/configurator/assignments/:assignmentId       # 409 if controller of others; renumbers on success
```

DTOs with class-validator throughout; group-based serialization so admin responses may include more than public ones (consistent with the existing project pattern).

### 5.2 Public (no auth)

```
GET  /configurators/:slug        # 404 if not published. Returns the full form schema:
                                 # product {name, description, imageUrl, codePrefix, separator}
                                 # segments[] ordered by position:
                                 #   {assignmentId, position, label, dataType, constraints,
                                 #    options[]{value,label} (SELECT only),
                                 #    condition (controllingAssignmentId, operator, value/min/max)}
                                 # Conditions ARE exposed so SvelteKit can live-disable inputs;
                                 # the backend resolve remains the source of truth.

POST /configurators/:slug/resolve   # body { selections } → §4.3 output. Stateless. Guests use this too.
```

Guests: fill the form, see code + summary on screen. Nothing persists for guests. No guest quoting (explicitly out of scope).

### 5.3 Phase 2 — saved configurations & quote (auth: any registered user)

```
POST   /configurators/:slug/save            # body { selections }. Server re-resolves internally;
                                            # rejects if invalid; stores snapshot (§2.5). NEVER trusts a client-composed code.
GET    /me/configurations                   # paginated list of own snapshots
GET    /me/configurations/:id               # 404 if not owner
DELETE /me/configurations/:id
POST   /me/configurations/:id/request-quote # sets quoteRequestedAt (idempotent: second call → 409 or no-op, pick 409),
                                            # sends email via the EXISTING mail provider to env QUOTE_NOTIFY_EMAIL
                                            # containing: user email/name, product name, code, summary lines.
```

No websockets, no live notifications — email only, using the mail infrastructure that already exists in the project.

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

---

## 7. Phases & tasks

Follow the standard flow: one branch per task, end-of-task terminal report, merge-as-approval. NestJS e2e (Jest/Supertest) is the trust signal for this backend module; Vitest only if a pure function warrants it (the condition evaluator and zero-fill renderer are good candidates). Regenerate `openapi-types.ts` at the end of each phase so the SvelteKit side picks up typed endpoints.

### Phase 1 — configurator core (public = display only)

1. **C1: Entities + migrations.** All §2 entities except SavedConfiguration. Constraints/uniques/FK behaviors per §2/§4.4. `synchronize` stays off; generate and review migrations.
2. **C2: Definition library CRUD** (+ options). Admin guard, DTOs, constraint-shape validation, pagination, `'0'` reservation, RESTRICT delete with friendly 409.
3. **C3: ConfigurableProduct CRUD** incl. Cloudinary image upload via the existing provider pattern, publish flag.
4. **C4: Assignments.** Add/remove/reorder with gapless renumbering, condition validation (direction rule, operator/dataType combos, min≥1 target rule, controller-delete 409).
5. **C5: Resolver service + public endpoints.** §4.3 exactly, including cascade and summary-omission rules. This is the largest task; the worked example (§6) becomes the e2e fixture. e2e list: every bullet in §6, plus: unpublished slug → 404; unknown option value; string `"0"`; missing required active segment; extra selections for zero-filled segments ignored; reorder-breaks-direction rejected; controller delete 409.

### Phase 2 — accounts & quotes

6. **C6: SavedConfiguration** entity + migration + save/list/get/delete endpoints. Snapshot semantics e2e: save, then admin edits the definition's options, then GET the snapshot → unchanged code and summary.
7. **C7: Request-quote** endpoint + email via existing mail provider (`QUOTE_NOTIFY_EMAIL` env; add to config validation schema). Idempotency e2e (second request → 409).

### Explicitly OUT of scope (do not implement, do not scaffold)

- Option filtering (a choice narrowing later options' lists)
- Multiple conditions per segment, AND/OR groups
- Per-product label/meaning overrides of any kind
- Config versioning (snapshots make it unnecessary)
- Guest quoting / guest persistence
- Websocket or in-app notifications
- Per-option preview images (**designed for the future**: nullable `imageUrl`/`imagePublicId` on SegmentOption, frontend swaps the product image as fields are filled; adding it later is a non-breaking additive migration and schema-endpoint field. Do not add the columns now.)
