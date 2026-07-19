// Lifecycle status of a quote request on a SavedConfiguration. Null on the
// entity until a quote is requested (invariant: quoteStatus IS NULL exactly
// when quoteRequestedAt IS NULL). PENDING means the ball is in the admin's
// court, ANSWERED means the admin replied and the user should act, CLOSED is
// a manual admin end state that only a new user message reopens.
export enum QuoteStatus {
  PENDING = 'PENDING',
  ANSWERED = 'ANSWERED',
  CLOSED = 'CLOSED',
}
