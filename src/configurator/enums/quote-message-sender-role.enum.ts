// Which side of a quote-request thread wrote a message. Denormalized onto
// each QuoteMessage so the thread stays renderable even after the sending
// account is deleted (senderId is SET NULL on user deletion).
export enum QuoteMessageSenderRole {
  USER = 'user',
  ADMIN = 'admin',
}
