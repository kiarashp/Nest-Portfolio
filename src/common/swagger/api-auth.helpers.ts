import { applyDecorators } from '@nestjs/common'
import { ApiBearerAuth, ApiResponse } from '@nestjs/swagger'
import { UserRole } from 'src/auth/enums/user-role.enum'

interface ApiAuthOptions {
  // Roles allowed to call the endpoint. Omit for "any authenticated user".
  roles?: UserRole[]
  // Optional note describing a per-row ownership restriction, appended to the 403.
  ownership?: string
}

/**
 * Documents the authentication and authorization of a protected endpoint so the
 * generated OpenAPI types carry it. Always marks the route as Bearer-secured and
 * adds a 401 response. When roles or an ownership rule are given, also adds a 403
 * whose description names the required roles — openapi-typescript surfaces that
 * description as JSDoc, making the role matrix part of the typed API contract.
 * Endpoint-specific responses (400/404/409) are declared separately on the handler.
 */
export function ApiAuth(options: ApiAuthOptions = {}) {
  const { roles, ownership } = options
  const decorators = [
    ApiBearerAuth(),
    ApiResponse({
      status: 401,
      description: 'Unauthorized — missing or invalid access token',
    }),
  ]
  if (roles?.length || ownership) {
    let description = 'Forbidden'
    if (roles?.length) description += ` — requires role: ${roles.join(', ')}`
    if (ownership) description += `${roles?.length ? '; ' : ' — '}${ownership}`
    decorators.push(ApiResponse({ status: 403, description }))
  }
  return applyDecorators(...decorators)
}
