import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Observable } from 'rxjs'
import { AccessTokenGuard } from '../access-token/access-token.guard'
import { AuthType } from 'src/auth/enums/auth-type.enum'
import { AUTH_TYPE_KEY } from 'src/auth/constants/auth.constants'

@Injectable()
export class AuthenticationGuard implements CanActivate {
  private readonly defaultAuthType = AuthType.Bearer
  private readonly authTypeGuardmap: Record<
    AuthType,
    CanActivate | CanActivate[]
  >
  constructor(
    /**
     * inject reflector
     */
    private readonly reflector: Reflector,
    /**
     * inject access token guard
     */
    private readonly accessTokenGuard: AccessTokenGuard,
  ) {
    this.authTypeGuardmap = {
      [AuthType.Bearer]: this.accessTokenGuard,
      [AuthType.None]: { canActivate: () => true },
    }
  }
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // get all auth types from reflector
    const authTypes = this.reflector.getAllAndOverride<AuthType[]>(
      AUTH_TYPE_KEY,
      [context.getHandler(), context.getClass()],
    ) ?? [this.defaultAuthType]

    // array of guards
    const guards = authTypes
      .map((authType) => this.authTypeGuardmap[authType])
      .flat()
    // default error
    let error: HttpException = new UnauthorizedException(
      'Authentication required',
    )

    //loop guards and fire canActivate and if return true let proceed
    for (const instance of guards) {
      try {
        const result = await Promise.resolve(instance.canActivate(context))

        if (result) {
          return true
        }
      } catch (err) {
        if (err instanceof HttpException) {
          error = err
        }
      }
    }
    throw error
  }
}
