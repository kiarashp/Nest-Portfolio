import { User } from 'src/users/entities/user.entity'
import { SavedConfigurationRequester } from '../dtos/saved-configuration-requester.dto'

// Maps a loaded User entity to the leaner requester shape embedded on admin
// SavedConfiguration reads. Shared by the admin list and single-read
// providers so the mapping isn't duplicated.
export function buildSavedConfigurationRequester(
  user: User,
): SavedConfigurationRequester {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
  }
}
