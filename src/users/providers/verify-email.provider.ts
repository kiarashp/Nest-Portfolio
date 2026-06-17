import {
  BadRequestException,
  Injectable,
  RequestTimeoutException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from '../entities/user.entity'

@Injectable()
export class VerifyEmailProvider {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  public async verify(token: string): Promise<{ message: string }> {
    let user: User | null = null
    try {
      user = await this.userRepository.findOneBy({
        emailVerificationToken: token,
      })
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
        { description: 'Error connecting to database' },
      )
    }

    if (
      !user ||
      !user.emailVerificationTokenExpiry ||
      new Date() > user.emailVerificationTokenExpiry
    ) {
      throw new BadRequestException('Invalid or expired verification token')
    }

    user.isEmailVerified = true
    user.emailVerificationToken = null
    user.emailVerificationTokenExpiry = null

    try {
      await this.userRepository.save(user)
    } catch {
      throw new RequestTimeoutException(
        'Unable to process your request, please try again later',
        { description: 'Error connecting to database' },
      )
    }

    return { message: 'Email verified successfully' }
  }
}
