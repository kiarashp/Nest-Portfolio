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
  // First name
  @ApiProperty({
    description: 'User first name',
    example: 'Ichigo',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(96)
  firstName!: string
  // Last name
  @ApiPropertyOptional({
    description: 'User last name',
    example: 'Kurosaki',
  })
  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(96)
  lastName?: string
  // Email
  @ApiProperty({
    description: 'User email',
    example: 'ichigo@bleach.com',
  })
  @IsEmail()
  @MaxLength(96)
  @IsNotEmpty()
  email!: string
  // Password
  @ApiProperty({
    description:
      'User password and must contain Minimum eight characters, at least one uppercase letter, one lowercase letter, one number and one special character',
    example: 'qwer!@QWER123',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(96)
  @MinLength(8)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'Password must contain Minimum eight characters, at least one uppercase letter, one lowercase letter, one number and one special character',
  })
  password!: string
}
