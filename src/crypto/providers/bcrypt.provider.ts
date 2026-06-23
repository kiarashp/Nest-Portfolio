import { Injectable } from '@nestjs/common'
import { HashingProvider } from './hashing.provider'
import * as bcrypt from 'bcryptjs'

@Injectable()
export class BcryptProvider implements HashingProvider {
  /**
   * Generates a random salt and returns the bcrypt hash of the input.
   * A new salt is produced on every call so identical passwords never
   * produce the same hash.
   */
  public async hashPassword(data: string): Promise<string> {
    const salt = await bcrypt.genSalt()
    return bcrypt.hash(data, salt)
  }

  /**
   * Returns true when the plain-text data matches the stored bcrypt hash.
   * Uses bcrypt.compare so the comparison is timing-safe.
   */
  public comparePassword(data: string, hash: string): Promise<boolean> {
    return bcrypt.compare(data, hash)
  }
}
