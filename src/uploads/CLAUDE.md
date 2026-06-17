# CLAUDE.md — src/uploads

Guidance specific to this module. See the root `CLAUDE.md` for the high-level summary.

## Module structure

`UploadsService` is a thin facade over two single-purpose providers (same pattern as `UsersService`):

- `UploadFileProvider` — validates buffer magic bytes (not just the MIME header), uploads to the storage backend, persists the `UploadFile` row. Accepts an optional `postId` to link the upload to a post.
- `DeleteFileProvider` — looks up the `UploadFile` record by URL (`path` column), deletes the asset from Cloudinary, then removes the DB row.

`UploadsService.uploadFile(file, userId, folder, postId?)` and `deleteFile(url)` are the only public surface — consumers never reach into the providers directly.

## The `postId` field

`UploadFile` has a nullable `postId` foreign key linking to `Post`. Set it when uploading images for a post so they can be cleaned up when the post is deleted. `RemovePostProvider` loads the post with its `uploadFiles` relation and calls `uploadsService.deleteFile()` for each before deleting the post row.

Avatars and other non-post uploads leave `postId` as `null`.

## Extending `FileType`

`enums/file-type.enum.ts` currently only has `IMAGE = 'image'`. If you add a new type:
- `UploadsController.uploadFile`'s `FileTypeValidator` regex and `CloudinaryProvider.upload`'s `resource_type: 'image'` are both image-specific — a non-image type needs its own controller method/validator and a different Cloudinary `resource_type` (`'video'`, `'raw'`).
- `UploadFileProvider.uploadFile` hardcodes `type: FileType.IMAGE` when creating the row — this needs to become a parameter once a second type exists.

## Swapping the storage backend

`StorageProvider` (`providers/storage.provider.ts`) is an **abstract class**, not an interface — it must survive compilation to serve as a NestJS DI token at runtime. `CloudinaryProvider` extends it and is the only class that touches the Cloudinary SDK.

To swap to S3 or another backend: write a new class that `extends StorageProvider` and implements `upload(file, folder)` and `delete(publicId)`, then change `useClass` in `UploadsModule`:
```ts
{ provide: StorageProvider, useClass: S3Provider }
```
Nothing else needs to change. Never import `CloudinaryProvider` from outside this module — it is not exported.

## Reusing this module

`UploadsModule` exports only `UploadsService`. Current consumers:
- `UsersModule` — avatar upload via `UploadAvatarProvider` (folder: `users/<userId>/`)
- `PostsModule` — post image upload via `UploadPostImageProvider` (folder: `posts/<postId>/`, with `postId` stored on the `UploadFile` row)

To add a new consumer: add `imports: [UploadsModule]` to the feature module and inject `UploadsService`.

## Known gotchas

- `cloudinary` (v2.10.0) has no `"exports"` field in its `package.json`. Values derived from its SDK types can silently become `any` that `nest build` won't catch — only `pnpm exec tsc --noEmit` will. Keep explicit return types on anything that touches the Cloudinary SDK.
- `FileInterceptor('file', { storage: memoryStorage() })` is required because `CloudinaryProvider.upload` reads `file.buffer` directly via `upload_stream` — there is no temp file on disk.
- `FileTypeValidator` only checks the multipart-reported `mimetype` header. `UploadFileProvider` also checks the file's magic bytes (first few bytes of the buffer) as a second layer of validation — both checks must pass.
