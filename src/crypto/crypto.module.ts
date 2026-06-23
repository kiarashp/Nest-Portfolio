import { Module } from '@nestjs/common'
import { HashingProvider } from './providers/hashing.provider'
import { BcryptProvider } from './providers/bcrypt.provider'

@Module({
  providers: [
    {
      provide: HashingProvider,
      useClass: BcryptProvider,
    },
    BcryptProvider,
  ],
  exports: [HashingProvider],
})
export class CryptoModule {}
