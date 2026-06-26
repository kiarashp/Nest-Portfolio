import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString } from 'class-validator'

export class GoogleTokenDto {
  @ApiProperty({
    description:
      'Google ID token obtained from the client-side Google Sign-In flow',
  })
  @IsNotEmpty()
  @IsString()
  token!: string
}
