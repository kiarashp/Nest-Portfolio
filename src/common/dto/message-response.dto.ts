import { ApiProperty } from '@nestjs/swagger'

/**
 * Shape returned by endpoints that report an outcome as a human-readable string
 * (e.g. user deletion, avatar-option removal). Documented so the generated
 * OpenAPI types expose the response instead of leaving it untyped.
 */
export class MessageResponseDto {
  @ApiProperty({
    description: 'Human-readable result message',
    example: 'User with id 1 has been deleted',
  })
  message!: string
}
