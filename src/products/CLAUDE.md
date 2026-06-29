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
    create-product.provider.ts
    update-product.provider.ts
    delete-product.provider.ts
    upload-product-image.provider.ts
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
3. `POST /:id/image` — `ParseIntPipe` is on the `:id` segment, not the `image` segment, so this one is fine in any order relative to `/:id`. But the `POST /` (create) must come before `GET /:id` is not an issue since they use different HTTP methods.

## FindOneProductProvider — four methods

`FindOneProductProvider` exposes four methods so providers can choose the right visibility check:

| Method | Filters | Throws |
|---|---|---|
| `findOneById(id)` | none | returns `null` if not found |
| `findOneByIdOrFail(id)` | none (includes drafts) | 404 if not found |
| `findOnePublishedByIdOrFail(id)` | `isPublished: true` | 404 if not found **or** draft |
| `findOneBySlugOrFail(slug)` | `isPublished: true` | 404 if not found **or** draft |

Write routes (`UpdateProductProvider`, `DeleteProductProvider`, `UploadProductImageProvider`) call `findOneByIdOrFail` — admins need to edit drafts. Public routes (`ProductsController.findOne`, `findBySlug`) call the published-only variants so drafts are invisible.

## Nullable field updates

`UpdateProductProvider` uses `!== undefined` (not `??`) when applying DTO fields to the entity:

```ts
if (dto.imageUrl !== undefined) product.imageUrl = dto.imageUrl
```

This allows a client to send `null` to explicitly clear a nullable field (e.g. remove the image URL). Using `??` would silently skip a `null` value and leave the old value in place.

## Image upload pattern

`UploadProductImageProvider` injects `StorageProvider` directly — it does **not** go through `UploadsService` and does **not** create an `UploadFile` row. The Cloudinary URL is stored on `product.imageUrl`. This is the same pattern used by `AvatarOptionsProvider` in `UsersModule`.

`ProductsModule` imports `UploadsModule` to get access to the exported `StorageProvider` DI token. Without this import, the `StorageProvider` token is unknown and NestJS throws a dependency resolution error at startup.

## Error mapping in write providers

| PostgreSQL error | Mapped to | Where |
|---|---|---|
| `23505` (unique violation) | `ConflictException` | `CreateProductTypeProvider`, `UpdateProductTypeProvider`, `CreateProductProvider`, `UpdateProductProvider` |
| `23503` (FK violation) | `BadRequestException` | `CreateProductProvider` only — fires when `productTypeId` references a non-existent type |

The FK check in `CreateProductProvider` avoids a pre-flight `SELECT` on the happy path: the product is inserted and only if PostgreSQL raises 23503 is a `BadRequestException` thrown. This is intentional — do not add a pre-flight `findOneProductTypeOrFail` call.

## Product type deletion safety

`DeleteProductTypeProvider` calls `productsRepository.count({ where: { productTypeId: id } })` before deleting. If any products reference the type, it throws `ConflictException` (409). The caller must delete or reassign those products first. This is a hard delete — there is no soft-delete for product types.

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

All seven write providers call `auditLogService.log(activeUserId, action, entity, entityId)` after each successful DB operation. `activeUserId` flows from the controller `@ActiveUser('sub')` decorator through the service facade into the provider. See the root `CLAUDE.md` audit log table for the full list.

## Data-source registration

`Product` and `ProductType` are registered in `src/database/data-source.ts` (used by the TypeORM migration CLI). They must be kept in sync with the entities listed in `TypeOrmModule.forFeature` in `products.module.ts`. When adding a column or relation, generate a migration — see the root `CLAUDE.md` Migrations section.
