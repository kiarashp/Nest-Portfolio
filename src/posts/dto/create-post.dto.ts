import {
  IsArray,
  IsEnum,
  IsISO8601,
  IsJSON,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator'
import { PostStatus } from '../enums/postStatus.enum'
import { PostType } from '../enums/postType.enum'
import { CreatePostMetaOptionsDto } from '../../meta-options/dto/create-post-meta-options.dto'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreatePostDto {
  // title
  @ApiProperty({
    description: 'The title of the post',
    example: 'My first post title',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(512)
  @IsNotEmpty()
  title!: string
  // postType
  @ApiProperty({
    enum: PostType,
    description: 'Possible values: post, page, story, series',
    example: 'post',
  })
  @IsEnum(PostType)
  @IsNotEmpty()
  postType!: PostType
  // slug
  @ApiProperty({
    description: 'The slug of the post',
    example: 'my-first-post',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(256)
  @IsNotEmpty()
  slug!: string
  // status
  @ApiProperty({
    enum: PostStatus,
    description: 'Possible values: draft, scheduled, review, published',
    example: 'published',
  })
  @IsEnum(PostStatus)
  @IsNotEmpty()
  status!: PostStatus
  // content
  @ApiPropertyOptional({
    description: 'The content of the post',
    example: 'This is the content of my first post',
  })
  @IsString()
  @IsOptional()
  content?: string
  // schema
  @ApiPropertyOptional({
    description: 'Serialized JSON object',
    example: '\r\n{\r\n  "village": "Konoha",\r\n  "clan": "Uzumaki"\r\n}',
  })
  @IsJSON()
  @IsOptional()
  schema?: string
  // featuredImage
  @ApiPropertyOptional({
    description: 'The URL of the featured image for the post',
    example: 'https://example.com/featured-image.jpg',
  })
  @IsUrl()
  @MaxLength(1024)
  @IsOptional()
  featuredImage?: string
  // publishOn
  @ApiPropertyOptional({
    description: 'The date and time when the post will be published',
    example: '2023-05-29T12:00:00.000Z',
  })
  @IsISO8601()
  @IsOptional()
  publishOn?: Date
  // tags
  @ApiPropertyOptional({
    description: 'The tags associated with the post',
    example: ['ninja', 'hokage', 'konoha'],
  })
  @IsArray()
  @IsString({ each: true })
  @MinLength(3, { each: true })
  @IsOptional()
  tags?: string[]
  // metaOptions
  @ApiPropertyOptional({
    type: CreatePostMetaOptionsDto,
    description: 'The meta options for the post',
  })
  @IsOptional()
  @Type(() => CreatePostMetaOptionsDto)
  metaOptions?: CreatePostMetaOptionsDto | null
}
