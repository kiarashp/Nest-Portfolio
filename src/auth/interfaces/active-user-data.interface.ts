import { UserRole } from '../enums/user-role.enum'

export interface ActiveUserData {
  // user id inside the database
  sub: number
  // email of the user
  email: string
  // role of the user
  role: UserRole
}
