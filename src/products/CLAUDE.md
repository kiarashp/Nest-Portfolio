# CLAUDE.md — src/products

Guidance specific to this module. See the root `CLAUDE.md` for the high-level architecture, route tables, and audit log overview.

## Module structure

Two entities, two controllers, two service facades, and a set of single-purpose providers — the same pattern used by `PostsModule`.

```
src/products/
  entities/
    product-type.entity.ts   — ProductType entity; exports FilterableField interface
    product.entity.ts        — Product entity with soft-delete and GIN-indexed specs
  dto/
    create-product-type.dto.ts  — includes FilterableFieldDto nested class
    update-product-type.dto.ts  — PartialType(CreateProductTypeDto)
    create-product.dto.ts
    update-product.dto.ts
    get-products.dto.ts         — extends PaginationQueryDto; adds productTypeId and q
  providers/
    find-all-product-types.provider.ts
    find-one-product-type.provider.ts
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

Two indexes:
- `@Index(['productTypeId'])` at class level — B-tree index on the FK column for fast type-based filtering.
- `@Index({ using: 'gin' })` on `specs` — GIN index for future jsonb containment queries (`@>`) if filter-by-specs is added later.

`productType` relation is eager, so every product query automatically includes the parent type. `deletedAt` is a `@DeleteDateColumn` — TypeORM excludes soft-deleted rows from all standard queries; pass `withDeleted: true` to include them (needed in tests when verifying soft-delete).

## Route ordering (critical)

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

## FindAllProductsProvider — two methods

`findAll(dto, request)` — for the public `GET /products` route. Always adds `isPublished: true` to the where clause. Supports `productTypeId` and `q` filters. Builds a cross-product of conditions when both `q` and `productTypeId` are present: each `q` branch (`name ILIKE` and `shortDescription ILIKE`) is ANDed with `productTypeId`, and the resulting pair of conditions is passed as an array to `PaginationProvider.paginateQuery` (TypeORM OR-branches an array of where objects).

`findAllAdmin(dto, request)` — for `GET /products/admin`. Same logic but without `isPublished: true`. TypeORM's `@DeleteDateColumn` still excludes soft-deleted rows automatically.

## Audit logging

All seven write providers call `auditLogService.log(activeUserId, action, entity, entityId)` after each successful DB operation. `activeUserId` flows from the controller `@ActiveUser('sub')` decorator through the service facade into the provider. See the root `CLAUDE.md` audit log table for the full list.

## Data-source registration

`Product` and `ProductType` are registered in `src/database/data-source.ts` (used by the TypeORM migration CLI). They must be kept in sync with the entities listed in `TypeOrmModule.forFeature` in `products.module.ts`. When adding a column or relation, generate a migration — see the root `CLAUDE.md` Migrations section.
