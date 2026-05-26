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
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(96)
  firstName!: string
  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(96)
  lastName?: string
  @IsEmail()
  @IsNotEmpty()
  email!: string
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'Password must contain Minimum eight characters, at least one uppercase letter, one lowercase letter, one number and one special character',
  })
  password!: string
}
