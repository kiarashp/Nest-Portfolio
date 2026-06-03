import { Module, forwardRef } from '@nestjs/common'
import { UsersController } from './users.controller'
import { UsersService } from './providers/users.service'
import { AuthModule } from 'src/auth/auth.module'
import { TypeOrmModule } from '@nestjs/typeorm'
import { User } from './entities/user.entity'
import { UserCreateManyProvider } from './providers/user-create-many.provider'

@Module({
  controllers: [UsersController],
  providers: [UsersService, UserCreateManyProvider],
  exports: [UsersService],
  imports: [forwardRef(() => AuthModule), TypeOrmModule.forFeature([User])],
})
export class UsersModule {}
