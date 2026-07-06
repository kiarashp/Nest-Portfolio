import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean } from 'class-validator'

export class PatchContactSubmissionDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  handled!: boolean
}
