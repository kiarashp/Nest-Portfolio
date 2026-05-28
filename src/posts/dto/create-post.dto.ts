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

export class CreatePostDto {
  @IsString()
  @MinLength(3)
  @IsNotEmpty()
  title!: string
  @IsEnum(PostType)
  @IsNotEmpty()
  postType!: PostType
  @IsString()
  @IsNotEmpty()
  slug!: string
  @IsEnum(PostStatus)
  @IsNotEmpty()
  status!: PostStatus
  @IsString()
  @IsOptional()
  content?: string
  @IsJSON()
  @IsOptional()
  schema?: string
  @IsUrl()
  @IsOptional()
  featuredImage?: string
  @IsISO8601()
  @IsOptional()
  publishOn?: Date
  @IsArray()
  @IsString({ each: true })
  @MinLength(3, { each: true })
  @IsOptional()
  tags?: string[]
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreatePostMetaOptionsDto)
  metaOptions?: CreatePostMetaOptionsDto[]
}
