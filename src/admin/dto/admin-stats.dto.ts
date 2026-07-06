import { ApiProperty } from '@nestjs/swagger'

export class PostsByStatusDto {
  @ApiProperty({ example: 3 })
  draft!: number
  @ApiProperty({ example: 1 })
  review!: number
  @ApiProperty({ example: 2 })
  scheduled!: number
  @ApiProperty({ example: 10 })
  published!: number
}

export class ProductStatsDto {
  @ApiProperty({ example: 20 })
  published!: number
  @ApiProperty({ example: 5 })
  draft!: number
  @ApiProperty({ example: 25 })
  total!: number
}

export class AdminStatsDto {
  @ApiProperty({ type: () => PostsByStatusDto })
  posts!: PostsByStatusDto
  @ApiProperty({ type: () => ProductStatsDto })
  products!: ProductStatsDto
  @ApiProperty({ example: 4 })
  productTypes!: number
  @ApiProperty({ example: 12 })
  users!: number
  @ApiProperty({ example: 37 })
  contactSubmissions!: number
}
