/** Centralised event name constants — import in both emitters and listeners. */
export const AppEvents = {
  USER_CREATED: 'user.created',
  CONTACT_SUBMITTED: 'contact.submitted',
} as const

/** Payload emitted when a new user registers. */
export interface UserCreatedPayload {
  email: string
  firstName: string
  verificationUrl: string
}
