import { ApiProperty } from '@nestjs/swagger'
import { IsJSON, IsNotEmpty } from 'class-validator'

export class CreatePostMetaOptionsDto {
  @ApiProperty({
    description: 'The meta value is a JSON string',
    example: '{ "village": "Konoha", "clan": "Uzumaki" }',
  })
  @IsJSON()
  @IsNotEmpty()
  metaValue!: string
}
