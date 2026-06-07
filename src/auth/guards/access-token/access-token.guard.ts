import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import type { ConfigType } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import jwtConfig from 'src/auth/config/jwt.config'
import { Request } from 'express'
import { REQUEST_USER_KEY } from 'src/auth/constants/auth.constants'
import { AccessTokenPayload } from 'src/auth/interfaces/access-token-payload'

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    /**
     * inject jwt service
     */
    private readonly jwtService: JwtService,
    /**
     * inject jwtconfiguration
     */
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // extract the request from the execution context
    const request = context.switchToHttp().getRequest<Request>()

    // extract the access token from the request header
    const token = this.extractRequestFromHeader(request)
    // validate the access token
    if (!token) {
      throw new UnauthorizedException(
        'Access token not found in the request header',
      )
    }
    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(
        token,
        this.jwtConfiguration,
      )
      request[REQUEST_USER_KEY] = payload
    } catch {
      throw new UnauthorizedException('Invalid access token')
    }
    return true
  }
  private extractRequestFromHeader(request: Request): string | undefined {
    const [_, accessToken] = request.headers.authorization?.split(' ') ?? []
    return accessToken
  }
}
