import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ROLES_KEY } from 'src/auth/constants/auth.constants'
import { REQUEST_USER_KEY } from 'src/auth/constants/auth.constants'
import { UserRole } from 'src/auth/enums/user-role.enum'
import { ActiveUserData } from 'src/auth/interfaces/active-user-data.interface'
import { Request } from 'express'

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name)

  constructor(
    /**
     * inject reflector to read @Roles() metadata
     */
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    )

    // no @Roles() on this route — allow everyone through
    if (!requiredRoles || requiredRoles.length === 0) {
      return true
    }

    const request = context.switchToHttp().getRequest<Request>()
    const user = request[REQUEST_USER_KEY] as ActiveUserData | undefined

    // if roles are required but there is no user on the request, deny access.
    // this guards against accidentally combining @Auth(AuthType.None) with @Roles(),
    // which would be a contradiction — a route can't be both public and role-restricted.
    if (!user) {
      this.logger.warn(
        'Authorization denied: role-restricted route has no user on request',
      )
      return false
    }

    const allowed = requiredRoles.includes(user.role)
    if (!allowed) {
      this.logger.warn(
        `Authorization denied — userId=${user.sub}, role=${user.role}, required=[${requiredRoles.join(', ')}]`,
      )
    }
    return allowed
  }
}
