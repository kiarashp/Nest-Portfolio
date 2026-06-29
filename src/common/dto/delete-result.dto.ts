import { ApiProperty } from '@nestjs/swagger'

/**
 * Shape returned by soft-delete / delete endpoints. Documented so the generated
 * OpenAPI types expose the response instead of leaving it untyped.
 */
export class DeleteResultDto {
  @ApiProperty({
    description: 'Whether the record was deleted',
    example: true,
  })
  deleted!: boolean

  @ApiProperty({ description: 'ID of the deleted record', example: 1 })
  id!: number
}
