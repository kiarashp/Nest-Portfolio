import type { Request } from 'express'
import { ActiveUserData } from './active-user-data.interface'
import { REQUEST_USER_KEY } from '../constants/auth.constants'

export interface AuthenticatedRequest extends Request {
  [REQUEST_USER_KEY]: ActiveUserData
}
