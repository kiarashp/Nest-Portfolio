import { IsOptional, IsUrl, MaxLength } from 'class-validator'
import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger'
import { CreatePostDto } from './create-post.dto'

// featuredImage is omitted from the base before PartialType is applied, then
// redeclared below with a wider (nullable) type. TypeScript's override check
// forbids a subclass narrowing/widening an inherited property's type, so
// redeclaring `string | null` directly against `PartialType(CreatePostDto)`
// (where featuredImage is `string | undefined`) fails to compile — omitting
// it first means there is nothing to override.
class PatchPostDtoBase extends PartialType(
  OmitType(CreatePostDto, ['featuredImage'] as const),
) {}

export class PatchPostDto extends PatchPostDtoBase {
  // featuredImage — accepts null, which clears an existing featured image
  // (omitting the field leaves it unchanged; see UpdatePostProvider).
  @ApiPropertyOptional({
    description:
      'The URL of the featured image for the post. Send null to clear it.',
    example: 'https://example.com/featured-image.jpg',
    type: String,
    nullable: true,
  })
  @IsUrl()
  @MaxLength(1024)
  @IsOptional()
  featuredImage?: string | null
}
