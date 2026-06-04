import { IsEmail, IsNotEmpty, IsString } from 'class-validator'

export class SignInDto {
  //email
  @IsEmail()
  @IsNotEmpty()
  email!: string
  //password
  @IsString()
  @IsNotEmpty()
  password!: string
}
