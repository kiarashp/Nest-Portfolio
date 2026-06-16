# CLAUDE.md — src/uploads

Guidance specific to this module. See the root `CLAUDE.md` for the high-level summary.

## Extending `FileType`

`enums/file-type.enum.ts` currently only has `IMAGE = 'image'` — deliberately left as an enum (not a hardcoded check) so future file kinds (e.g. `DOCUMENT`, `VIDEO`) can be added without touching the `UploadFile` entity. If you add a new type:
- `UploadsController.uploadFile`'s `FileTypeValidator` regex (`/^image\/(jpeg|png|webp|gif)$/`) and `CloudinaryProvider.uploadImage`'s `resource_type: 'image'` are both image-specific — a non-image type needs its own controller method/validator and likely a different Cloudinary `resource_type` (`'video'`, `'raw'`), not a generic branch inside the existing method.
- `UploadsService.uploadFile` hardcodes `type: FileType.IMAGE` when creating the row — this needs to become a parameter once a second type exists.

## Swapping the storage backend

`CloudinaryProvider` is the only class that touches the `cloudinary` SDK; `UploadsService` only knows about `uploadImage(file): Promise<UploadApiResponse>`-shaped result (`secure_url`, `public_id`). To swap to S3/another provider, write a new provider with an equivalent method and swap the injection in `UploadsService` — don't let SDK types leak past `CloudinaryProvider`.

## Reusing this module elsewhere

`UploadsModule` exports `UploadsService` precisely so other modules can depend on it without duplicating Cloudinary logic (the original motivation for this module). To use it from e.g. `PostsModule` for a `featuredImage` upload flow: add `imports: [UploadsModule]` to that module and inject `UploadsService` — do not import `CloudinaryProvider` directly from outside this module, it's not exported.

## Known gotchas

- `cloudinary` (v2.10.0) has no `"exports"` field in its `package.json`. Combined with this repo's `noImplicitAny: false`, omitting an explicit type annotation on values derived from its SDK types can silently produce `any` that `nest build` (ts-loader) won't catch — only `pnpm exec tsc --noEmit` will. This is why `uploadResult` in `uploads.service.ts` is explicitly typed `UploadApiResponse` rather than left inferred.
- `FileInterceptor('file', { storage: memoryStorage() })` is required (not multer's default disk storage) because `CloudinaryProvider.uploadImage` reads `file.buffer` directly via `upload_stream` — there's no temp file on disk to point Cloudinary at.
- `FileTypeValidator` only checks the multipart-reported `mimetype` header, not file content/magic bytes. It's not a substitute for content-based validation if that's ever needed.
