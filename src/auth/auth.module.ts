import { Module, forwardRef } from '@nestjs/common'
import { AuthService } from './providers/auth.service'
import { AuthController } from './auth.controller'
import { UsersModule } from 'src/users/users.module'

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  imports: [forwardRef(() => UsersModule)],
  exports: [AuthService],
})
export class AuthModule {}
