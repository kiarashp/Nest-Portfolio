import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { ConfigType } from '@nestjs/config'
import { randomUUID } from 'node:crypto'
import { dirname, extname, resolve, sep } from 'node:path'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import uploadsConfig from 'src/config/uploads.config'
import { StorageProvider, UploadResult } from './storage.provider'
import { resolveUploadsDir } from '../utils/resolve-uploads-dir.util'

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
}

/**
 * Strips traversal (`..`) and empty path segments and any character outside
 * a safe allowlist. Every real caller only ever passes a literal or a
 * numeric-id template string (see src/uploads/CLAUDE.md), so this is defense
 * in depth rather than a fix for a known gap.
 */
function sanitizeFolder(folder: string): string {
  return folder
    .split('/')
    .map((segment) => segment.trim())
    .filter(
      (segment) => segment.length > 0 && segment !== '.' && segment !== '..',
    )
    .map((segment) => segment.replace(/[^a-zA-Z0-9_-]/g, ''))
    .join('/')
}

/**
 * `UploadFileProvider` (and the avatar/configurator-image providers) only
 * validate the file's magic bytes, never its filename, so `originalname`'s
 * extension can be missing or wrong even for a genuine image. Falls back to
 * the mimetype for the four types that ever pass that validation.
 */
function resolveExtension(file: Express.Multer.File): string {
  const fromName = extname(file.originalname).toLowerCase()
  if (/^\.[a-z0-9]{2,5}$/.test(fromName)) return fromName
  return MIME_EXTENSIONS[file.mimetype] ?? ''
}

/**
 * Local-disk implementation of `StorageProvider`. Writes uploaded files under
 * a configured root directory; `/uploads` is served as static assets from
 * that same directory (see app.create.ts + resolveUploadsDir).
 *
 * `publicId` embeds the folder plus the generated filename (e.g.
 * `avatars/<uuid>.jpg`), mirroring how Cloudinary's own `public_id` embeds
 * its folder path, so `delete()` can resolve the on-disk path directly from it.
 *
 * Constructed manually inside UploadsModule's StorageProvider factory (not
 * resolved by Nest's own DI), so its constructor takes plain values rather
 * than using parameter decorators.
 */
@Injectable()
export class LocalDiskStorageProvider extends StorageProvider {
  private readonly logger = new Logger(LocalDiskStorageProvider.name)
  private readonly rootDir: string
  private readonly appUrl: string

  constructor(
    uploadsConfiguration: ConfigType<typeof uploadsConfig>,
    configService: ConfigService,
  ) {
    super()
    this.rootDir = resolveUploadsDir(uploadsConfiguration.dir)
    this.appUrl = (
      configService.get<string>('appConfig.appUrl') ?? 'http://localhost:3000'
    ).replace(/\/+$/, '')
  }

  /**
   * Writes the in-memory buffer to disk under `folder` and resolves with the
   * generic `UploadResult` shape (an absolute, directly renderable URL).
   */
  public async upload(
    file: Express.Multer.File,
    folder: string,
  ): Promise<UploadResult> {
    const safeFolder = sanitizeFolder(folder)
    const filename = `${randomUUID()}${resolveExtension(file)}`
    const publicId = safeFolder ? `${safeFolder}/${filename}` : filename

    const fullPath = this.resolveWithinRoot(publicId)
    await mkdir(dirname(fullPath), { recursive: true })
    await writeFile(fullPath, file.buffer)

    this.logger.log(`File written to disk — publicId=${publicId}`)
    return { url: `${this.appUrl}/uploads/${publicId}`, publicId }
  }

  /**
   * Deletes the file from disk by its public id. A missing file is treated
   * as already deleted, mirroring Cloudinary's idempotent `destroy`.
   */
  public async delete(publicId: string): Promise<void> {
    const fullPath = this.resolveWithinRoot(publicId)
    try {
      await unlink(fullPath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }

  /**
   * Resolves a publicId to an absolute path and verifies it stays within
   * the configured root directory.
   */
  private resolveWithinRoot(publicId: string): string {
    const fullPath = resolve(this.rootDir, publicId)
    if (fullPath !== this.rootDir && !fullPath.startsWith(this.rootDir + sep)) {
      throw new Error(`Resolved path escapes uploads root: ${publicId}`)
    }
    return fullPath
  }
}
