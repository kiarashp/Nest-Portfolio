# CLAUDE.md — src/uploads

Guidance specific to this module. See the root `CLAUDE.md` for the high-level summary.

## Module structure

`UploadsService` is a thin facade over two single-purpose providers (same pattern as `UsersService`):

- `UploadFileProvider` — validates buffer magic bytes (not just the MIME header), uploads to the storage backend, persists the `UploadFile` row. Accepts an optional `postId` to link the upload to a post.
- `DeleteFileProvider` — looks up the `UploadFile` record by URL (`path` column), deletes the asset from Cloudinary, then removes the DB row.

`UploadsService.uploadFile(file, userId, folder, postId?)` and `deleteFile(url)` are the only public surface — consumers never reach into the providers directly.

## The `postId` field

`UploadFile` has a nullable `postId` foreign key linking to `Post`. Every `UploadFile` row is created through `POST /posts/:id/images` (via `UploadPostImageProvider`), which always passes `postId`, so there are no orphaned rows. `RemovePostProvider` loads the post with its `uploadFiles` relation and calls `uploadsService.deleteFile()` for each before deleting the post row.

Avatars bypass `UploadFile` entirely — `AvatarOptionsProvider` injects `StorageProvider` directly and writes to `AvatarOption`, a separate table with no `postId`.

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
- `PostsModule` — post image upload via `UploadPostImageProvider` (folder: `posts/<postId>/`, with `postId` stored on the `UploadFile` row)

To add a consumer that needs full upload tracking (creates `UploadFile` rows): inject `UploadsService`.
To add a consumer that only needs raw Cloudinary access without DB tracking: inject `StorageProvider` directly.

## Known gotchas

- `cloudinary` (v2.10.0) has no `"exports"` field in its `package.json`. Values derived from its SDK types can silently become `any` that `nest build` won't catch — only `pnpm exec tsc --noEmit` will. Keep explicit return types on anything that touches the Cloudinary SDK.
- `FileInterceptor('file', { storage: memoryStorage() })` is required because `CloudinaryProvider.upload` reads `file.buffer` directly via `upload_stream` — there is no temp file on disk.
- `FileTypeValidator` (from `@nestjs/common`) uses the `file-type` ESM package for magic-byte detection — it does NOT rely only on the multipart MIME header. In Jest e2e tests this requires `NODE_OPTIONS=--experimental-vm-modules` (already set in the `test:e2e` script) and a real magic-byte buffer (e.g. `JPEG_MAGIC`) in file attachments — a buffer of arbitrary bytes will fail validation.
