import { Test, TestingModule } from '@nestjs/testing'
import { BcryptProvider } from 'src/crypto/providers/bcrypt.provider'

// BcryptProvider wraps the bcrypt library to hash and compare passwords.
// These tests use real bcrypt (no mocks) because the whole point is to verify
// the library is being called correctly — faking it would prove nothing.
describe('BcryptProvider', () => {
  let provider: BcryptProvider

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BcryptProvider],
    }).compile()

    provider = module.get(BcryptProvider)
  })

  describe('hashPassword', () => {
    it('returns a bcrypt hash string', async () => {
      // A valid bcrypt hash always starts with $2a$ or $2b$ followed by the cost factor.
      const hash = await provider.hashPassword('secret')
      expect(typeof hash).toBe('string')
      expect(hash).toMatch(/^\$2[ab]\$/)
    })

    it('produces a different hash on each call (unique salts)', async () => {
      // bcrypt generates a random salt each time, so the same password must
      // never produce the same hash — otherwise a rainbow table could crack it.
      const h1 = await provider.hashPassword('secret')
      const h2 = await provider.hashPassword('secret')
      expect(h1).not.toBe(h2)
    })
  })

  describe('comparePassword', () => {
    it('returns true when data matches the hash', async () => {
      // The round-trip: hash a password, then verify the same plain-text passes.
      const hash = await provider.hashPassword('correct')
      expect(await provider.comparePassword('correct', hash)).toBe(true)
    })

    it('returns false when data does not match the hash', async () => {
      // A wrong password must be rejected — this is the main security guarantee.
      const hash = await provider.hashPassword('correct')
      expect(await provider.comparePassword('wrong', hash)).toBe(false)
    })
  })
})
