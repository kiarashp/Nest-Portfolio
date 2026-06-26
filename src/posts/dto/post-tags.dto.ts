import { ApiProperty } from '@nestjs/swagger'
import { ArrayNotEmpty, IsArray, IsInt, IsPositive } from 'class-validator'

export class PostTagsDto {
  @ApiProperty({ type: [Number] })
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  tagIds!: number[]
}
