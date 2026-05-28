import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator'

export class CreateUserDto {
  @ApiProperty({
    description: 'User first name',
    example: 'Ichigo',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(96)
  firstName!: string
  @ApiPropertyOptional({
    description: 'User last name',
    example: 'Kurosaki',
  })
  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(96)
  lastName?: string
  @ApiProperty({
    description: 'User email',
    example: 'ichigo@bleach.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string
  @ApiProperty({
    description:
      'User password and must contain Minimum eight characters, at least one uppercase letter, one lowercase letter, one number and one special character',
    example: 'qwer!@QWER123',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'Password must contain Minimum eight characters, at least one uppercase letter, one lowercase letter, one number and one special character',
  })
  password!: string
}
