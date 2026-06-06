/**
 * what is this type?
 * this is what we extract from the payload of the google token.
 * it is a partial of the google token payload coming back from google.
 *
 * when the frontend sends the google client id and the user signs in,
 * google returns a token. the payload of that token contains information
 * about the authenticated user, and this interface represents the parts
 * of that payload that we care about in our application.
 * we change the label of the names from given name to firstName and family name to lastName in the google auth service
 */
export interface GoogleUser {
  googleId: string
  email: string
  firstName: string
  lastName: string
}
