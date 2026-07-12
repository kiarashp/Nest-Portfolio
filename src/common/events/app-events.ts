/** Centralised event name constants — import in both emitters and listeners. */
export const AppEvents = {
  USER_CREATED: 'user.created',
  CONTACT_SUBMITTED: 'contact.submitted',
  QUOTE_REQUESTED: 'quote.requested',
} as const

/** Payload emitted when a new user registers. */
export interface UserCreatedPayload {
  email: string
  firstName: string
  verificationUrl: string
}

/** Payload emitted when a user requests a quote for a saved configuration. */
export interface QuoteRequestedPayload {
  savedConfigurationId: number
  userEmail: string
  userFirstName: string
  productName: string
  code: string
  summary: string[]
}
