import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean } from 'class-validator'

export class PatchSavedConfigurationReviewedDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  quoteReviewed!: boolean
}
