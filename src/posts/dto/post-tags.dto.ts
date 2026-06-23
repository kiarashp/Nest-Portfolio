import { ArrayNotEmpty, IsArray, IsInt, IsPositive } from 'class-validator'

export class PostTagsDto {
  // IDs of the tags to add or remove from the post
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  tagIds!: number[]
}
