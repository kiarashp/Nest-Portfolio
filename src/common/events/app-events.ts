/** Centralised event name constants — import in both emitters and listeners. */
export const AppEvents = {
  USER_CREATED: 'user.created',
  CONTACT_SUBMITTED: 'contact.submitted',
  QUOTE_REQUESTED: 'quote.requested',
  QUOTE_MESSAGE_POSTED_BY_USER: 'quote.message.posted-by-user',
  QUOTE_MESSAGE_POSTED_BY_ADMIN: 'quote.message.posted-by-admin',
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
  /** Optional first thread message — rides inside the quote-request email. */
  message: string | null
}

/**
 * Shared payload for both quote-message events. userEmail/userFirstName are
 * always the thread owner's — the recipient for an admin reply, the sender
 * identity for a user message.
 */
export interface QuoteMessagePostedPayload {
  savedConfigurationId: number
  userEmail: string
  userFirstName: string
  productName: string
  code: string
  messageBody: string
}
