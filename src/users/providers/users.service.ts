import {
  Injectable,
  RequestTimeoutException,
  NotFoundException,
} from '@nestjs/common'
import { Repository } from 'typeorm'
import { User } from '../entities/user.entity'
import { InjectRepository } from '@nestjs/typeorm'
import { CreateUserDto } from '../dtos/create-user.dtos'
import { UserCreateManyProvider } from './user-create-many.provider'
import { CreateManyUsersDto } from '../dtos/create-many-users.dto'
import { CreateUserProvider } from './create-user.provider'
import { FindOneUserByEmailProvider } from './find-one-user-by-email.provider'
import { FindOneByGoogleIdProvider } from './find-one-by-google-id.provider'
import { CreateGoogleUserProvider } from './create-google-user.provider'
import { GoogleUser } from '../interfaces/google-user.interface'
import { FindOneByIdProvider } from './find-one-by-id.provider'
import { RemoveOneByIdProvider } from './remove-one-by-id.provider'
import { SelectAvatarProvider } from './select-avatar.provider'
import { AvatarOptionsProvider } from './avatar-options.provider'
import { ChangeUserRoleProvider } from './change-user-role.provider'
import { VerifyEmailProvider } from './verify-email.provider'
import { ResendVerificationProvider } from './resend-verification.provider'
import { UserRole } from 'src/auth/enums/user-role.enum'
import { PatchUserProvider } from './patch-user.provider'
import { PatchUserDto } from '../dtos/patch-user.dto'
import { PatchUserProfileProvider } from './patch-user-profile.provider'
import { PatchUserProfileDto } from '../dtos/patch-user-profile.dto'
import { SyncGoogleUserProvider } from './sync-google-user.provider'
import { ForgotPasswordProvider } from './forgot-password.provider'
import { ResetPasswordProvider } from './reset-password.provider'

@Injectable()
export class UsersService {
  constructor(
    /**
     * Injecting UserRepository
     */
    @InjectRepository(User)
    private userRepository: Repository<User>,
    /**
     * Inject craete user provider
     */
    private readonly createUserProvider: CreateUserProvider,
    /**
     * Injec create many provider
     */
    private readonly userCreateManyProvider: UserCreateManyProvider,
    /**
     * Inject find one user by email provider
     */
    private readonly findOneUserByEmailProvider: FindOneUserByEmailProvider,
    /**
     * Inject find one by google id
     */
    private readonly findOneByGoogleIdProvider: FindOneByGoogleIdProvider,
    /**
     * Inject createGoogleUser provider
     */
    private readonly createGoogleUserProvider: CreateGoogleUserProvider,
    /**
     * Inject find one by database id
     */
    private readonly findOneByIdProvider: FindOneByIdProvider,
    /**
     * remove one user by id
     */
    private readonly removeOneByIdProvider: RemoveOneByIdProvider,
    /**
     * inject select avatar provider
     */
    private readonly selectAvatarProvider: SelectAvatarProvider,
    /**
     * inject change user role provider
     */
    private readonly changeUserRoleProvider: ChangeUserRoleProvider,
    /**
     * inject verify email provider
     */
    private readonly verifyEmailProvider: VerifyEmailProvider,
    /**
     * inject resend verification provider
     */
    private readonly resendVerificationProvider: ResendVerificationProvider,

    /**
     * Inject patch user provider — used by the admin update route
     */
    private readonly patchUserProvider: PatchUserProvider,

    /**
     * Inject patch user profile provider — used when a user updates their own name
     */
    private readonly patchUserProfileProvider: PatchUserProfileProvider,

    /**
     * Inject sync google user provider — keeps the stored profile in sync with Google on each login
     */
    private readonly syncGoogleUserProvider: SyncGoogleUserProvider,

    /**
     * Inject forgot password provider
     */
    private readonly forgotPasswordProvider: ForgotPasswordProvider,

    /**
     * Inject reset password provider
     */
    private readonly resetPasswordProviderInstance: ResetPasswordProvider,

    /**
     * Inject avatar options provider — handles admin CRUD for avatar choices
     */
    private readonly avatarOptionsProvider: AvatarOptionsProvider,
  ) {}
  /**
   * Find all users
   */
  public findAll(limit: number, page: number) {
    return this.userRepository.find()
  }
  /**
   * Find user by id
   * handle execption when user is not found
   */
  public async findOneById(id: number) {
    return await this.findOneByIdProvider.findOneById(id)
  }
  /**
   * Create a new user
   */
  public async craeteUser(createUserDto: CreateUserDto) {
    return await this.createUserProvider.craeteUser(createUserDto)
  }
  /**
   * create multiple new users
   */
  public async createMany(createManyUsersDto: CreateManyUsersDto) {
    return await this.userCreateManyProvider.createMany(createManyUsersDto)
  }

  /**
   * Find user by email
   */
  public async findOneByEmail(email: string) {
    return await this.findOneUserByEmailProvider.findOneByEmail(email)
  }
  /**
   * Find one by google id
   */
  public async findOneByGoogleId(googleId: string) {
    return await this.findOneByGoogleIdProvider.findOneByGoogleId(googleId)
  }
  /**
   * Create google user
   */
  public async createGoogleUser(googleUser: GoogleUser) {
    return await this.createGoogleUserProvider.createGoogleUser(googleUser)
  }

  /**
   * remove a user by id
   */
  public async removeUserById(id: number) {
    return await this.removeOneByIdProvider.removeUserById(id)
  }

  /**
   * Set the user's avatar to one of the Cloudinary-hosted options by its DB id.
   */
  public async selectAvatar(avatarOptionId: number, userId: number) {
    return await this.selectAvatarProvider.selectAvatar(avatarOptionId, userId)
  }

  /**
   * Change the role of a user. Only callable by an admin.
   */
  public async changeUserRole(id: number, role: UserRole) {
    return await this.changeUserRoleProvider.changeUserRole(id, role)
  }

  public async verifyEmail(token: string) {
    return this.verifyEmailProvider.verify(token)
  }

  public async resendVerificationEmail(email: string) {
    return this.resendVerificationProvider.resend(email)
  }

  /**
   * Update any field on a user. Only admins can call this.
   */
  public async patchUser(id: number, dto: PatchUserDto) {
    return this.patchUserProvider.patchUser(id, dto)
  }

  /**
   * Let a user update their own first and last name.
   */
  public async patchUserProfile(userId: number, dto: PatchUserProfileDto) {
    return this.patchUserProfileProvider.patchUserProfile(userId, dto)
  }

  /**
   * Sync a Google user's name and email with what Google is currently returning.
   * Called on every Google login for existing accounts.
   */
  public async syncGoogleUser(
    user: User,
    googleFields: { email: string; firstName: string; lastName: string },
  ) {
    return this.syncGoogleUserProvider.sync(user, googleFields)
  }

  /**
   * Start the password reset flow. Always returns the same message
   * whether the email is registered or not.
   */
  public async forgotPassword(email: string): Promise<{ message: string }> {
    return this.forgotPasswordProvider.forgotPassword(email)
  }

  /**
   * Set a new password using the token from the reset email.
   */
  public async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    return this.resetPasswordProviderInstance.resetPassword(token, newPassword)
  }

  /**
   * Returns all available avatar options from the database.
   */
  public async getAvatarOptions() {
    return this.avatarOptionsProvider.findAll()
  }

  /**
   * Uploads a new avatar image to Cloudinary and saves the option to the DB.
   */
  public async createAvatarOption(file: Express.Multer.File) {
    return this.avatarOptionsProvider.create(file)
  }

  /**
   * Deletes the Cloudinary asset and removes the avatar option row from the DB.
   */
  public async removeAvatarOption(id: number) {
    return this.avatarOptionsProvider.remove(id)
  }

  /**
   * Saves a pre-hashed password to the user row. Called by ChangePasswordProvider
   * after it has already verified the current password and hashed the new one.
   */
  public async updatePassword(
    userId: number,
    hashedPassword: string,
  ): Promise<void> {
    await this.userRepository.save({ id: userId, password: hashedPassword })
  }
}
