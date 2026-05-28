import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common'
import { AuthService } from './providers/auth.service'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
}
