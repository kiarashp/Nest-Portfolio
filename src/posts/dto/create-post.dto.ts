import {
  IsArray,
  IsEnum,
  IsISO8601,
  IsJSON,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
  ValidateNested,
} from 'class-validator'
import { PostStatus } from '../enums/postStatus.enum'
import { PostType } from '../enums/postType.enum'
import { CreatePostMetaOptionsDto } from './create-post-meta-options.dto'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreatePostDto {
  @ApiProperty({
    description: 'The title of the post',
    example: 'My first post title',
  })
  @IsString()
  @MinLength(3)
  @IsNotEmpty()
  title!: string
  @ApiProperty({
    enum: PostType,
    description: 'Possible values: post, page, story, series',
    example: 'post',
  })
  @IsEnum(PostType)
  @IsNotEmpty()
  postType!: PostType
  @ApiProperty({
    description: 'The slug of the post',
    example: 'my-first-post',
  })
  @IsString()
  @IsNotEmpty()
  slug!: string
  @ApiProperty({
    enum: PostStatus,
    description: 'Possible values: draft, scheduled, review, published',
    example: 'published',
  })
  @IsEnum(PostStatus)
  @IsNotEmpty()
  status!: PostStatus
  @ApiPropertyOptional({
    description: 'The content of the post',
    example: 'This is the content of my first post',
  })
  @IsString()
  @IsOptional()
  content?: string
  @ApiPropertyOptional({
    description: 'Serialized JSON object',
    example: '\r\n{\r\n  "village": "Konoha",\r\n  "clan": "Uzumaki"\r\n}',
  })
  @IsJSON()
  @IsOptional()
  schema?: string
  @ApiPropertyOptional({
    description: 'The URL of the featured image for the post',
    example: 'https://example.com/featured-image.jpg',
  })
  @IsUrl()
  @IsOptional()
  featuredImage?: string
  @ApiPropertyOptional({
    description: 'The date and time when the post will be published',
    example: '2023-05-29T12:00:00.000Z',
  })
  @IsISO8601()
  @IsOptional()
  publishOn?: Date
  @ApiPropertyOptional({
    description: 'The tags associated with the post',
    example: ['ninja', 'hokage', 'konoha'],
  })
  @IsArray()
  @IsString({ each: true })
  @MinLength(3, { each: true })
  @IsOptional()
  tags?: string[]
  @ApiPropertyOptional({
    type: 'array',
    required: false,
    items: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description:
            'The key can be any string identifier for the meta option',
          example: 'sidebarEnabled',
        },
        value: {
          type: 'any',
          description: 'Any value can be assigned to the Key.',
          example: true,
        },
      },
    },
    description: 'The meta options for the post',
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreatePostMetaOptionsDto)
  metaOptions?: CreatePostMetaOptionsDto[]
}
