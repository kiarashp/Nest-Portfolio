import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  RequestTimeoutException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from '../entities/user.entity'
import { HashingProvider } from 'src/auth/providers/hashing.provider'

@Injectable()
export class ResetPasswordProvider {
  constructor(
    // access the users table
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    // hash the new password before saving
    @Inject(forwardRef(() => HashingProvider))
    private readonly hashingProvider: HashingProvider,
  ) {}

  /**
   * Set a new password using the reset token sent to the user's email.
   * Rejects the request if the token is missing, wrong, or expired.
   */
  public async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    let user: User | null = null
    try {
      user = await this.userRepository.findOneBy({ passwordResetToken: token })
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
        { description: 'Error connecting to database' },
      )
    }

    if (
      !user ||
      !user.passwordResetTokenExpiry ||
      new Date() > user.passwordResetTokenExpiry
    ) {
      throw new BadRequestException('Invalid or expired password reset token')
    }

    user.password = await this.hashingProvider.hashPassword(newPassword)
    // Clear the token so it can only be used once
    user.passwordResetToken = null
    user.passwordResetTokenExpiry = null

    try {
      await this.userRepository.save(user)
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
        { description: 'Error connecting to database' },
      )
    }

    return { message: 'Password reset successfully' }
  }
}
