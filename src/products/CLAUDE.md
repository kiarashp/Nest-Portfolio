# CLAUDE.md — src/products

Guidance specific to this module. See the root `CLAUDE.md` for the high-level architecture, route tables, and audit log overview.

## Module structure

Two entities, two controllers, two service facades, and a set of single-purpose providers — the same pattern used by `PostsModule`.

```
src/products/
  entities/
    product-type.entity.ts   — ProductType entity; exports FilterableField interface
    product.entity.ts        — Product entity with soft-delete and jsonb specs
  dto/
    create-product-type.dto.ts  — includes FilterableFieldDto nested class
    update-product-type.dto.ts  — PartialType(CreateProductTypeDto)
    create-product.dto.ts
    update-product.dto.ts
    get-products.dto.ts         — extends PaginationQueryDto; adds productTypeId, typeSlug, q, sort, specs
  providers/
    find-all-product-types.provider.ts
    find-one-product-type.provider.ts   — by id or by slug
    create-product-type.provider.ts
    update-product-type.provider.ts
    delete-product-type.provider.ts
    product-types.service.ts    — thin facade over product type providers
    find-all-products.provider.ts
    find-one-product.provider.ts
    find-related-products.provider.ts   — GET /:id/related: same-type published siblings, excluding self
    create-product.provider.ts
    update-product.provider.ts
    delete-product.provider.ts
    upload-product-image.provider.ts   — uploads via UploadsService, returns UploadFile
    find-product-images.provider.ts    — lists a product's UploadFile rows (admin picker)
    delete-product-image.provider.ts   — deletes one image + clears imageUrl/images
    validate-specs.util.ts      — shared spec validation helpers (no DI)
    products.service.ts         — thin facade over product providers
  product-types.controller.ts
  products.controller.ts
  products.module.ts
```

## Entities

### ProductType (`src/products/entities/product-type.entity.ts`)

Columns: `id`, `name` (unique varchar 256), `slug` (unique varchar 256), `filterableFields` (jsonb, nullable), `createdAt`, `updatedAt`.

`filterableFields` stores a `FilterableField[]` array that drives the filter UI. Each entry has `key`, `label`, `type` (`'number' | 'enum' | 'string'`), optional `unit`, optional `options` (enum choices). The `FilterableField` interface is exported from this file — import it when you need to type-annotate the array.

`productCount` is a **transient** field (not a DB column) — number of published products in the type. It is populated only by `GET /product-types` (`FindAllProductTypesProvider`) for the landing-page cards; other reads leave it undefined.

The `products` inverse relation (`@OneToMany`) is non-eager and is never auto-loaded. Always query products through their own repository rather than accessing `productType.products`.

### Product (`src/products/entities/product.entity.ts`)

Columns: `id`, `name`, `slug` (unique), `sku` (unique, nullable), `shortDescription`, `description` (nullable text), `imageUrl` (nullable), `images` (jsonb, nullable), `specs` (jsonb, nullable), `isPublished` (boolean, default false), `productTypeId` (FK), `createdAt`, `updatedAt`, `deletedAt` (soft-delete).

One index:
- `@Index(['productTypeId'])` at class level — B-tree index on the FK column for fast type-based filtering.

There is intentionally **no** index on `specs`. TypeORM's `@Index()` decorator cannot express a Postgres `USING gin` index (the `using` option does not exist — an earlier `@Index({ using: 'gin' })` was invalid and would not compile). At this catalog's scale a sequential scan over `specs` is fine. If spec filtering needs an index in production, add a GIN index via a raw-SQL migration:

```sql
CREATE INDEX idx_product_specs_gin ON product USING gin (specs);
```

`productType` relation is eager, so every product query automatically includes the parent type. Note: eager relations are auto-loaded by repository `find*` methods but **not** by a QueryBuilder — `FindAllProductsProvider` therefore `leftJoinAndSelect`s `productType` explicitly. `deletedAt` is a `@DeleteDateColumn` — TypeORM excludes soft-deleted rows from all standard queries; pass `withDeleted: true` to include them (needed in tests when verifying soft-delete).

## Route ordering (critical)

In `ProductTypesController`, `GET /product-types/slug/:slug` must be declared **before** `GET /:id` so `"slug"` is not parsed as an integer by `ParseIntPipe`. It maps to `FindOneProductTypeProvider.findOneBySlugOrFail` and returns the type (incl. `filterableFields`), letting a per-type page render its heading and filter UI by slug without first resolving the numeric id.

In `ProductsController`, three routes must be declared **before** `GET /:id`:

1. `GET /slug/:slug` — if declared after `/:id`, NestJS tries to pass the literal `"slug"` through `ParseIntPipe` and throws 400.
2. `GET /admin` — same reason: `"admin"` fails `ParseIntPipe`.
3. `POST /:id/images`, `GET /:id/images`, `DELETE /:id/images/:fileId`, `GET /:id/related` — `ParseIntPipe` is on the `:id`/`:fileId` segments, so these are fine in any order relative to `/:id` (longer path and/or different HTTP method).

## FindOneProductProvider — four methods

`FindOneProductProvider` exposes four methods so providers can choose the right visibility check:

| Method | Filters | Throws |
|---|---|---|
| `findOneById(id)` | none | returns `null` if not found |
| `findOneByIdOrFail(id)` | none (includes drafts) | 404 if not found |
| `findOnePublishedByIdOrFail(id)` | `isPublished: true` | 404 if not found **or** draft |
| `findOneBySlugOrFail(slug)` | `isPublished: true` | 404 if not found **or** draft |

Write routes (`UpdateProductProvider`, `DeleteProductProvider`, `UploadProductImageProvider`) call `findOneByIdOrFail` — admins need to edit drafts. Public routes (`ProductsController.findOne`, `findBySlug`) call the published-only variants so drafts are invisible.

`FindRelatedProductsProvider` (`GET /products/:id/related`) reuses `findOnePublishedByIdOrFail` to resolve and validate the anchor product — a missing or unpublished/draft id 404s exactly like `GET /products/:id`. It then runs a plain `productsRepository.find()` (not a `SelectQueryBuilder` — no jsonb/spec filtering is needed) on `productTypeId = anchor.productTypeId AND id != anchor.id AND isPublished = true`, ordered `createdAt DESC` with an `id` tiebreaker, capped by an optional `?limit=` query param (default 4, max 20). There is no fallback to other product types, so the result can be shorter than `limit` or empty. Read-only — no audit log entry is written.

## Nullable field updates

`UpdateProductProvider` uses `!== undefined` (not `??`) when applying DTO fields to the entity:

```ts
if (dto.imageUrl !== undefined) product.imageUrl = dto.imageUrl
```

This allows a client to send `null` to explicitly clear a nullable field (e.g. remove the image URL). Using `??` would silently skip a `null` value and leave the old value in place.

## Image upload pattern

Product images are tracked as `UploadFile` rows (the same model posts use), **not** bare URLs. This is
what lets Cloudinary assets be cleaned up when a product is deleted.

- `UploadProductImageProvider` goes through `UploadsService.uploadFile(file, adminId, ` products/${id} `, { productId })`, which creates an `UploadFile` row carrying `productId` + `publicId`. It returns the `UploadFile` — it does **not** set `imageUrl`/`images`.
- The flow is **decoupled** (like post images): the frontend uploads via `POST /products/:id/images`, gets back the URL, then sets `imageUrl` (featured) and/or `images` (gallery) via `PATCH /products/:id`. `UploadFile` = tracking/cleanup; the product's `imageUrl`/`images` columns = presentation pointers.
- `FindProductImagesProvider` (`GET /products/:id/images`) lists a product's uploaded files for the admin picker. Product image management is ADMIN-only, so there is no per-user ownership check.
- `DeleteProductImageProvider` (`DELETE /products/:id/images/:fileId`) deletes one file from Cloudinary + DB and clears it from `imageUrl`/`images` if referenced. The `:fileId` must belong to the route's product, else 404.
- `DeleteProductProvider.softDelete` loads every `UploadFile` for the product and `uploadsService.deleteFile()`s each **before** soft-deleting the row. There is no restore endpoint, so purging the assets on soft-delete is safe.

`Product` images are linked via `UploadFile.productId` (a nullable FK mirroring `postId`). `ProductsModule` registers `UploadFile` in its own `TypeOrmModule.forFeature` so the providers can inject that repository, and imports `UploadsModule` for the exported `UploadsService`. A `Product` cannot be hard-deleted while `upload_file` rows still reference it (FK with no cascade) — soft-delete purges them first; tests must delete the rows before hard-deleting products.

`imageUrl`/`images` remain plain URL fields on the create/update DTOs. Cleanup iterates `UploadFile` rows by `productId`, so it is correct regardless of what those fields point at; an arbitrary external URL with no `UploadFile` row simply won't be cleaned (only uploaded assets are tracked).

## Error mapping in write providers

| PostgreSQL error | Mapped to | Where |
|---|---|---|
| `23505` (unique violation) | `ConflictException` | `CreateProductTypeProvider`, `UpdateProductTypeProvider`, `CreateProductProvider`, `UpdateProductProvider` |
| `23503` (FK violation) | `BadRequestException` | `CreateProductProvider` only — fires when `productTypeId` references a non-existent type |

The FK check in `CreateProductProvider` avoids a pre-flight `SELECT` on the happy path: the product is inserted and only if PostgreSQL raises 23503 is a `BadRequestException` thrown. This is intentional — do not add a pre-flight `findOneProductTypeOrFail` call.

## FindAllProductTypesProvider — published product count

`GET /product-types` returns every type (ordered by name) with a `productCount` of its **published**
products, for the landing cards. The provider does this in **two queries, not one-per-type**: it
fetches the types, then runs a single grouped count
(`SELECT productTypeId, COUNT(*) ... WHERE isPublished = true GROUP BY productTypeId`) and maps the
results on (defaulting to `0`). Soft-deleted products are excluded by TypeORM's default soft-delete
handling. It injects the `Product` repository alongside the `ProductType` repository for this.

Note: `loadRelationCountAndMap` would be the one-liner alternative, but the installed `typeorm@1.0.0`
removed it — use the explicit grouped query instead.

## Product type deletion safety

`DeleteProductTypeProvider` calls `productsRepository.count({ where: { productTypeId: id } })` before deleting. If any products reference the type, it throws `ConflictException` (409). The caller must delete or reassign those products first. This is a hard delete — there is no soft-delete for product types.

## Product type field evolution (updating `filterableFields`)

`PATCH /product-types/:id` can replace `filterableFields`, but the change is guarded so it can never strand a product's stored `specs`. Fields are matched **by `key`** (so reordering is free) and the rules are:

| Operation | Verdict |
|---|---|
| Add a field | allowed |
| Remove a field | allowed only if **no product** has a value for that `key` → else 409 |
| Change a field's `key` | reads as remove-old + add-new; the removal check on the old key applies |
| Change a field's `type` | **400** — immutable (a type change is the data-breaker) |
| Change a field's `label`/`unit` | allowed (display-only) |
| Add enum `options` | allowed |
| Remove enum `options` | allowed only if **no product** holds one of the removed values → else 409 |

Because `type` is immutable, a `number` field can never come to hold non-numeric data, so the `(specs ->> key)::numeric` cast in `FindAllProductsProvider` can never hit bad data — no read-side hardening is needed.

Two pieces implement this:
- `classify-type-change.util.ts` — a pure helper (no DI, like `validate-specs.util.ts`). `classifyTypeChange(old, new)` throws `BadRequestException` on an illegal type change and returns the removals (`fieldRemoved` / `optionsRemoved`) that still need a usage-check.
- `ValidateTypeChangeProvider` (`validate-type-change.provider.ts`) — injects the `Product` repository, runs `classifyTypeChange`, then for each removal runs a jsonb count (`specs ->> key IS NOT NULL`, or `specs ->> key IN (:...opts)`) and throws `ConflictException` naming every conflict. `UpdateProductTypeProvider.update` calls `assertChangesSafe` before mutating the entity.

The whole `filterableFields` array is replaced wholesale, so a client must always send the **complete** field list — a dropped field reads as a removal attempt. This is the same accepted no-transaction race as the delete-type count check (a product could be created between the count and the save).

## FindAllProductsProvider — QueryBuilder-based filtering

Both list methods build a TypeORM `SelectQueryBuilder` via the shared private `buildQuery(dto, publishedOnly)` and hand it to `PaginationProvider.paginateQueryBuilder`. A QueryBuilder is required (not the simple `where` path) because spec filters need jsonb access (`specs ->> :key`) and numeric casts that `FindOptionsWhere` cannot express.

`findAll(dto, request)` — public `GET /products`, `publishedOnly = true`.
`findAllAdmin(dto, request)` — `GET /products/admin`, `publishedOnly = false` (drafts included; soft-deleted rows still excluded by `@DeleteDateColumn`).

Filters supported by both:
- **Type** — `productTypeId` (FK column match) **or** `typeSlug` (matches the joined `productType.slug`). `productTypeId` wins if both are sent.
- **Keyword** `q` — `name ILIKE OR shortDescription ILIKE`.
- **Sort** — `newest` (default, `createdAt DESC`), `oldest` (`createdAt ASC`), `name` (`name ASC`); each adds an `id` tiebreaker so pagination is stable.
- **Specs** — see below.

### Spec filtering

`GET /products` accepts spec filters as **bracket-nested query params**, e.g.
`?specs[sheathMaterial]=Inconel 600&specs[tempRange][min]=1000&specs[tempRange][max]=1600`. They parse into `dto.specs` (a `Record<string, unknown>`) — one declared DTO field, so the global `ValidationPipe` (`whitelist + forbidNonWhitelisted`) keeps its arbitrary nested keys without rejecting them. A flat top-level `?material=K` shape is impossible (would be stripped as an unknown property and could collide with `sort`/`q`/etc.).

**Requires the `extended` query parser.** Express 5 defaults to the `simple` parser, which does not nest brackets; `src/app.create.ts` sets `app.set('query parser', 'extended')` (qs) so the brackets parse. `qs` also parses the posts `tagIds` array params, so the switch is backward-compatible.

Spec filtering **requires a type context** (`productTypeId` or `typeSlug`) so the keys can be validated against that type's `filterableFields` — otherwise 400. Query values arrive as **strings**; number facets are coerced with `Number()` and rejected (400) if not numeric. Per facet:
- **enum / string** → exact text match: `(product.specs ->> :key) = :value`. For enum, the value must be one of `options`.
- **number** → exact (`= value`) when a scalar is sent, or a range when `[min]`/`[max]` is sent: `(product.specs ->> :key)::numeric >= min` / `<= max`.

Unknown keys, non-object `specs`, non-numeric number values, or out-of-range enum values all throw `BadRequestException`.

### validate-specs.util.ts (shared, no DI)

- `findFilterableField(fields, key)` — returns the field def or throws if the key is not declared. Used by the filter builder.
- `validateSpecsAgainstType(specs, fields)` — validates a product's stored specs (every key declared, every value matching its field type). Called by `CreateProductProvider` and `UpdateProductProvider` so the data that powers the filters stays well-formed.

**Write-side validation cost:** `CreateProductProvider` only loads the `ProductType` (a pre-flight SELECT) **when specs are present** — without specs it still relies on the FK `23503` error to report a bad `productTypeId`, preserving the no-preflight rule below. `UpdateProductProvider` re-validates whenever `specs` **or** `productTypeId` changes and the product has specs.

## Audit logging

Every write provider calls `auditLogService.log(activeUserId, action, entity, entityId)` after each successful DB operation — the five product-type/product CRUD providers, plus the three image providers (`UploadProductImageProvider` and `DeleteProductImageProvider` both log `UPDATE Product`; `DeleteProductProvider` logs `SOFT_DELETE Product`). `activeUserId` flows from the controller `@ActiveUser('sub')` decorator through the service facade into the provider.

## OpenAPI response typing

Both controllers document their response bodies with the shared helpers in
`src/common/swagger/api-response.helpers.ts` (`ApiDataResponse`, `ApiArrayDataResponse`,
`ApiPaginatedResponse`), and the `Product`/`ProductType` entities carry `@ApiProperty` on every
response field. This makes the generated `openapi-types.ts` expose real response shapes (the
`{ apiVersion, data }` envelope, paginated for the list routes) instead of `content?: never`.
`FilterableFieldDto` is also decorated so the frontend gets a typed filter-metadata shape.
Nullable fields pass an explicit `type` (e.g. `@ApiPropertyOptional({ type: String, nullable: true })`)
because a `string | null` union otherwise emits `Object` metadata and renders as an empty object.
The **posts** module is also fully response-typed using these same helpers — see the root
`CLAUDE.md` Serialization section for the rationale, the `PublicAuthor` embedded-author pattern,
and how to extend this to other modules.

Both controllers' write/admin routes (everything except the public reads) are ADMIN-only and
carry `@ApiAuth({ roles: [UserRole.ADMIN] })` from `src/common/swagger/api-auth.helpers.ts`,
which documents the Bearer requirement plus `401`/`403` (the `403` description names the required
role) — see the root `CLAUDE.md` OpenAPI section. Products have no per-row ownership, so no
`ownership` note is passed. The `409` conflict responses stay as separate `@ApiResponse` decorators.

## Data-source registration

`Product` and `ProductType` are registered in `src/database/data-source.ts` (used by the TypeORM migration CLI). They must be kept in sync with the entities listed in `TypeOrmModule.forFeature` in `products.module.ts`. When adding a column or relation, generate a migration — see the root `CLAUDE.md` Migrations section.

The two tables are created by `src/database/migrations/*-AddProductTables.ts` (they were added after the initial schema). `productCount` and the `productType`/`filterableFields` typing are not schema changes, so they need no migration.
