# CLAUDE.md — src/uploads

Guidance specific to this module. See the root `CLAUDE.md` for the high-level summary.

## Module structure

`UploadsService` is a thin facade over two single-purpose providers (same pattern as `UsersService`):

- `UploadFileProvider` — validates buffer magic bytes (not just the MIME header), uploads to the storage backend, persists the `UploadFile` row. Accepts an optional `links` object to tie the row to a post or a product.
- `DeleteFileProvider` — looks up the `UploadFile` record by URL (`path` column), deletes the asset from Cloudinary, then removes the DB row.

`UploadsService.uploadFile(file, userId, folder, links?)` and `deleteFile(url)` are the only public surface — consumers never reach into the providers directly. `links` is `{ postId?: number; productId?: number; productTypeId?: number }` (defaults to `{}`); a row links to a post, a product, or a product type (or none, e.g. avatars) — never more than one. Using one options object instead of trailing optional `number`s avoids mis-positioning the ids.

## The `postId` / `productId` / `productTypeId` fields

`UploadFile` has nullable `postId`, `productId`, and `productTypeId` foreign keys. Every row created for a parent is tied to it so the asset can be cleaned up later:

- **Posts** — created through `POST /posts/:id/images` (`UploadPostImageProvider` passes `{ postId }`). `RemovePostProvider` loads the post with its `uploadFiles` relation and `deleteFile()`s each before deleting the post row; `DeletePostImageProvider` (`DELETE /posts/:id/images/:fileId`) removes a single one and clears `featuredImage` and/or the `images` gallery array if it was referenced there; `FindPostImagesProvider.findPostImage` (`GET /posts/:id/images/:fileId`) is the single-item read counterpart. Editors may only delete or read images on posts they authored (same ownership check on both routes).
- **Products** — created through `POST /products/:id/images` (`UploadProductImageProvider` passes `{ productId }`). `DeleteProductProvider.softDelete` queries `UploadFile` by `productId` and `deleteFile()`s each before soft-deleting; `DeleteProductImageProvider` (`DELETE /products/:id/images/:fileId`) removes a single one; `FindProductImagesProvider.findProductImage` (`GET /products/:id/images/:fileId`) is the single-item read counterpart (ADMIN-only, no ownership concept — mirrors `DELETE`). See `src/products/CLAUDE.md`.
- **Product types** — created through `POST /product-types/:id/image` (`UploadProductTypeImageProvider` passes `{ productTypeId }`). Unlike posts/products, a type has only one image slot, so this single endpoint uploads **and** sets `ProductType.imageUrl` in the same call, purging any previously tracked image first. `DeleteProductTypeProvider` (a hard delete) queries `UploadFile` by `productTypeId` and `deleteFile()`s each before the delete; `DeleteProductTypeImageProvider` (`DELETE /product-types/:id/image`) clears the single tracked image; `FindProductTypeImageProvider` (`GET /product-types/:id/image`) is the read counterpart (ADMIN-only). See `src/products/CLAUDE.md`.

Avatars bypass `UploadFile` entirely — `AvatarOptionsProvider` injects `StorageProvider` directly and writes to `AvatarOption`, a separate table with no `postId`/`productId`. `AvatarOptionsProvider.findOne` (`GET /users/avatar-options/:id`, public) is the single-item read counterpart to the list/create/delete routes.

## OpenAPI typing of `UploadFile`

`UploadFile` carries `@ApiProperty` on its scalar fields so the `GET /posts/:id/images` (array) and `POST /posts/:id/images` (single) responses are fully typed in `openapi-types.ts`. The `user` and `post` relations are intentionally **left undecorated** — without the swagger introspection plugin, only `@ApiProperty`-decorated properties enter the schema, so those relations stay out of the response shape (they are not serialized into the images endpoints anyway). See the root `CLAUDE.md` "OpenAPI response typing" section for the overall pattern.

## Extending `FileType`

`enums/file-type.enum.ts` currently only has `IMAGE = 'image'`. If you add a new type:
- `PostsController`'s `POST /posts/:id/images` handler uses `FileTypeValidator` (image-only regex) and `CloudinaryProvider.upload` uses `resource_type: 'image'` — a non-image type needs its own controller handler/validator and a different Cloudinary `resource_type` (`'video'`, `'raw'`).
- `UploadFileProvider.uploadFile` hardcodes `type: FileType.IMAGE` when creating the row — this needs to become a parameter once a second type exists.

## Swapping the storage backend

`StorageProvider` (`providers/storage.provider.ts`) is an **abstract class**, not an interface — it must survive compilation to serve as a NestJS DI token at runtime. `CloudinaryProvider` extends it and is the only class that touches the Cloudinary SDK.

To swap to S3 or another backend: write a new class that `extends StorageProvider` and implements `upload(file, folder)` and `delete(publicId)`, then change `useClass` in `UploadsModule`:
```ts
{ provide: StorageProvider, useClass: S3Provider }
```
Nothing else needs to change. Never import `CloudinaryProvider` from outside this module — it is not exported.

## Reusing this module

`UploadsModule` exports `UploadsService` and `StorageProvider`. Current consumers:
- `UsersModule` — avatar pool management via `AvatarOptionsProvider`, which injects `StorageProvider` directly (no `UploadFile` rows created). `UploadsModule` is also imported so `StorageProvider` is available in the DI context.
- `PostsModule` — post image upload via `UploadPostImageProvider` (folder: `posts/<postId>/`, with `postId` stored on the `UploadFile` row). Also queries `UploadFile` directly via `FindPostImagesProvider` (`GET /posts/:id/images`) and `DeletePostImageProvider` (`DELETE /posts/:id/images/:fileId`) — `UploadFile` is registered in `PostsModule`'s own `TypeOrmModule.forFeature` for this purpose.
- `ProductsModule` — product image upload via `UploadProductImageProvider`, which injects `UploadsService` (folder: `products/<productId>`, with `productId` stored on the `UploadFile` row). It also queries `UploadFile` directly (`FindProductImagesProvider`, `DeleteProductImageProvider`, and image cleanup in `DeleteProductProvider`) — `UploadFile` is registered in `ProductsModule`'s own `TypeOrmModule.forFeature` for this. `ProductsModule` imports `UploadsModule` for the exported `UploadsService` (it no longer uses `StorageProvider` directly). The same module also handles product type image upload via `UploadProductTypeImageProvider` (folder: `product-types/<productTypeId>`, with `productTypeId` stored on the `UploadFile` row), `FindProductTypeImageProvider`, `DeleteProductTypeImageProvider`, and image cleanup in `DeleteProductTypeProvider`.

To add a consumer that needs full upload tracking (creates `UploadFile` rows): inject `UploadsService`.
To add a consumer that only needs raw Cloudinary access without DB tracking: inject `StorageProvider` directly.

## Known gotchas

- `cloudinary` (v2.10.0) has no `"exports"` field in its `package.json`. Values derived from its SDK types can silently become `any` that `nest build` won't catch — only `pnpm exec tsc --noEmit` will. Keep explicit return types on anything that touches the Cloudinary SDK.
- `FileInterceptor('file', { storage: memoryStorage() })` is required because `CloudinaryProvider.upload` reads `file.buffer` directly via `upload_stream` — there is no temp file on disk.
- `FileTypeValidator` (from `@nestjs/common`) uses the `file-type` ESM package for magic-byte detection — it does NOT rely only on the multipart MIME header. In Jest e2e tests this requires `NODE_OPTIONS=--experimental-vm-modules` (already set in the `test:e2e` script) and a real magic-byte buffer (e.g. `JPEG_MAGIC`) in file attachments — a buffer of arbitrary bytes will fail validation.
