import { Injectable } from '@nestjs/common'
import { HashingProvider } from './hashing.provider'
import * as bcrypt from 'bcryptjs'

@Injectable()
export class BcryptProvider implements HashingProvider {
  public async hashPassword(data: string): Promise<string> {
    // Generate salt
    const salt = await bcrypt.genSalt()
    return bcrypt.hash(data, salt)
  }
  public comparePassword(data: string, hash: string): Promise<boolean> {
    return bcrypt.compare(data, hash)
  }
}
