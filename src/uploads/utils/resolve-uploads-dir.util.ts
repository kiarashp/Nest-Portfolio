import { resolve } from 'node:path'

/**
 * Resolves the configured uploads directory to an absolute path, relative to
 * process.cwd() (/app in the production Docker image, the project root in
 * local dev). Shared by LocalDiskStorageProvider and app.create.ts's static
 * route so they can never disagree about which directory is in use.
 */
export function resolveUploadsDir(dir: string): string {
  return resolve(process.cwd(), dir)
}
