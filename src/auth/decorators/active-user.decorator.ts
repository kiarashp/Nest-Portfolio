import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { ActiveUserData } from '../interfaces/active-user-data.interface'
import { REQUEST_USER_KEY } from '../constants/auth.constants'
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface'
export const ActiveUser = createParamDecorator(
  (field: keyof ActiveUserData | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>()
    const user = request[REQUEST_USER_KEY]
    return field ? user?.[field] : user
  },
)
