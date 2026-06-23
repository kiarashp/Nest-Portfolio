import { Injectable } from '@nestjs/common'

/**
 * Abstract DI token for password hashing. Inject this class to hash or compare
 * passwords without depending on a specific algorithm. The concrete implementation
 * (BcryptProvider) is registered in CryptoModule and can be swapped without
 * changing any caller.
 */
@Injectable()
export abstract class HashingProvider {
  /** Hash a plain-text string and return the stored hash. */
  abstract hashPassword(data: string): Promise<string>

  /** Return true if the plain-text data matches the stored hash. */
  abstract comparePassword(data: string, hash: string): Promise<boolean>
}
