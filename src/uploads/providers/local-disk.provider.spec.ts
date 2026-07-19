import { mkdtemp, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ConfigService } from '@nestjs/config'
import { LocalDiskStorageProvider } from './local-disk.provider'

function makeFile(
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File {
  return {
    buffer: Buffer.from('fake-image-bytes'),
    originalname: 'photo.jpg',
    mimetype: 'image/jpeg',
    fieldname: 'file',
    encoding: '7bit',
    size: 16,
    stream: undefined as never,
    destination: '',
    filename: '',
    path: '',
    ...overrides,
  }
}

describe('LocalDiskStorageProvider', () => {
  let rootDir: string
  let provider: LocalDiskStorageProvider

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), 'uploads-test-'))
    const configService = {
      get: () => 'http://localhost:3000',
    } as unknown as ConfigService
    provider = new LocalDiskStorageProvider(
      { driver: 'local', dir: rootDir },
      configService,
    )
  })

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true })
  })

  it('writes the file to disk and returns a matching url/publicId', async () => {
    const result = await provider.upload(makeFile(), 'avatars')

    expect(result.publicId).toMatch(/^avatars\/[0-9a-f-]+\.jpg$/)
    expect(result.url).toBe(`http://localhost:3000/uploads/${result.publicId}`)

    const written = await stat(join(rootDir, result.publicId))
    expect(written.isFile()).toBe(true)
  })

  it('falls back to the mimetype for a missing/invalid extension', async () => {
    const result = await provider.upload(
      makeFile({ originalname: 'blob', mimetype: 'image/webp' }),
      'avatars',
    )

    expect(result.publicId).toMatch(/\.webp$/)
  })

  it('creates nested folders as needed', async () => {
    const result = await provider.upload(makeFile(), 'posts/42')

    expect(result.publicId).toMatch(/^posts\/42\/[0-9a-f-]+\.jpg$/)
    const entries = await readdir(join(rootDir, 'posts', '42'))
    expect(entries).toHaveLength(1)
  })

  it('deletes the file, and is idempotent on a repeat call', async () => {
    const result = await provider.upload(makeFile(), 'avatars')
    const fullPath = join(rootDir, result.publicId)

    await provider.delete(result.publicId)
    await expect(stat(fullPath)).rejects.toThrow()

    // Second delete on an already-missing file must not throw (mirrors
    // Cloudinary's idempotent destroy).
    await expect(provider.delete(result.publicId)).resolves.toBeUndefined()
  })

  it('never writes outside the root when folder attempts traversal', async () => {
    // sanitizeFolder strips '..' segments entirely, so this resolves to a
    // plain 'etc' subfolder inside rootDir — not two levels above it.
    const result = await provider.upload(makeFile(), '../../etc')

    const escaped = join(rootDir, '..', '..', 'etc')
    await expect(stat(escaped)).rejects.toThrow()

    const written = await stat(join(rootDir, result.publicId))
    expect(written.isFile()).toBe(true)
  })

  it('rejects a delete() publicId that resolves outside the root', async () => {
    await expect(provider.delete('../../etc/passwd')).rejects.toThrow(
      /escapes uploads root/,
    )
  })
})
