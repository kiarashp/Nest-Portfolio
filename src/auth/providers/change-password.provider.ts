import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { UsersService } from 'src/users/providers/users.service'
import { HashingProvider } from 'src/crypto/providers/hashing.provider'
import { ChangePasswordDto } from '../dtos/change-password.dto'

@Injectable()
export class ChangePasswordProvider {
  constructor(
    /**
     * Inject users service to load the user and persist the new password
     */
    private readonly usersService: UsersService,

    /**
     * Inject hashing provider to compare and hash passwords
     */
    @Inject(HashingProvider)
    private readonly hashingProvider: HashingProvider,
  ) {}

  /**
   * Verifies the current password and replaces it with the hashed new password.
   * Rejects Google-only accounts that have no local password set.
   */
  public async changePassword(
    userId: number,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findOneById(userId)

    // Google-only accounts have no local password — direct them to account settings
    if (!user.password) {
      throw new BadRequestException(
        'This account uses Google Sign-In. Use account settings to manage your password.',
      )
    }

    const isMatch = await this.hashingProvider.comparePassword(
      dto.currentPassword,
      user.password,
    )

    if (!isMatch) {
      throw new UnauthorizedException('Current password is incorrect.')
    }

    const hashed = await this.hashingProvider.hashPassword(dto.newPassword)
    await this.usersService.updatePassword(userId, hashed)

    return { message: 'Password changed successfully' }
  }
}
