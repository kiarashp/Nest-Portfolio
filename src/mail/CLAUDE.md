# CLAUDE.md — src/mail

Guidance specific to this module. See the root `CLAUDE.md` for the high-level summary and `### Events` for how email is triggered via `EventEmitter2`.

## Module structure

`src/mail` is a NestJS module for transactional email using raw nodemailer (SMTP) + EJS templates. **Not global** — import it explicitly in any feature module that needs to send email.

- `mail.config.ts` — `registerAs('mail', ...)` namespace; reads `MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE`, `MAIL_USER`, `MAIL_PASSWORD`, `MAIL_FROM` from env.
- `providers/nodemailer.provider.ts` — custom DI token `NODEMAILER_TRANSPORTER`; creates the nodemailer transporter once via `useFactory`.
- `providers/send-mail.provider.ts` — core send logic: renders an EJS template then calls `transporter.sendMail()`. Template path resolves to `dist/mail/templates/<name>.ejs` at runtime.
- `providers/send-welcome-mail.provider.ts` — welcome email.
- `providers/send-verification-mail.provider.ts` — email address verification.
- `providers/send-password-reset-mail.provider.ts` — password reset link.
- `providers/send-contact-notification.provider.ts` — contact form notification to the site owner; reads recipient address from `mail.contactNotificationEmail` (`CONTACT_NOTIFICATION_EMAIL` env var, falling back to `MAIL_FROM`/`mail.defaultFrom` if unset). Kept separate from `MAIL_FROM` because `MAIL_FROM` is typically a no-reply sending address, not a real inbox someone reads.
- `providers/send-quote-request-mail.provider.ts` — configurator quote-request notification to the site owner; reads recipient address from `mail.quoteNotifyEmail` (`QUOTE_NOTIFY_EMAIL` env var, same fallback-to-`MAIL_FROM` pattern as the contact notification). Its payload includes `message: string | null` (the optional first thread message) — the provider **always** passes `message` into the EJS context even when null, because an absent key is a `ReferenceError` inside EJS; the template guards with `<% if (message) { %>`.
- `providers/send-quote-message-notification.provider.ts` — notifies the site owner when a user posts a message on their quote-request thread; same `mail.quoteNotifyEmail` recipient pattern as the quote-request provider.
- `providers/send-quote-reply-mail.provider.ts` — notifies the thread owner when an admin replies on their quote-request thread; sends to `payload.userEmail`, so it injects only `SendMailProvider` (no `ConfigService`).
- `mail.service.ts` — thin facade; exposes `sendMail`, `sendWelcomeMail`, `sendVerificationMail`, `sendPasswordResetMail`, `sendContactNotification`, `sendQuoteRequestMail`, `sendQuoteMessageNotification`, `sendQuoteReplyMail`.
- `templates/` — EJS files; one per email type (`welcome.ejs`, `verification.ejs`, `password-reset.ejs`, `contact.ejs`, `quote-request.ejs`, `quote-message.ejs`, `quote-reply.ejs`). Variables injected via the `context` field of `MailOptions`.

## Adding a new email type

1. Add a `<name>.ejs` file in `src/mail/templates/`.
2. Create `src/mail/providers/send-<name>-mail.provider.ts` — inject `SendMailProvider`, call `.send()` with the right template and context.
3. Register the new provider in `mail.module.ts` `providers: [...]`.
4. Add a `send<Name>Mail()` method to `MailService` that delegates to the new provider.

## Templates and build

`nest-cli.json` is configured with `assets: [{ include: "mail/templates/**/*.ejs", watchAssets: true }]` so EJS files are copied to `dist/` on build and watched in dev mode. If you add a new template subdirectory, update the glob in `nest-cli.json`.

## Dev testing

Use [Mailtrap](https://mailtrap.io) sandbox — set `MAIL_HOST=sandbox.smtp.mailtrap.io`, `MAIL_PORT=2525`, `MAIL_SECURE=false` and your Mailtrap credentials in `.env.development`. Sent emails appear in the Mailtrap inbox without reaching real recipients.

## Current wiring

- `UsersModule` imports `MailModule`. `CreateUserProvider` emits `AppEvents.USER_CREATED`; `UserEventsListener` (`src/users/listeners/user-events.listener.ts`) handles it and calls `mailService.sendVerificationMail()`.
- `ContactModule` imports `MailModule`. `ContactProvider` emits `AppEvents.CONTACT_SUBMITTED`; `ContactEventsListener` (`src/contact/listeners/contact-events.listener.ts`) handles it and calls `mailService.sendContactNotification()`.
- `ConfiguratorModule` imports `MailModule`. `RequestQuoteSavedConfigurationProvider` emits `AppEvents.QUOTE_REQUESTED`; `QuoteEventsListener` (`src/configurator/listeners/quote-events.listener.ts`) handles it and calls `mailService.sendQuoteRequestMail()`. The same listener also handles `AppEvents.QUOTE_MESSAGE_POSTED_BY_USER` → `sendQuoteMessageNotification()` (to the site owner) and `AppEvents.QUOTE_MESSAGE_POSTED_BY_ADMIN` → `sendQuoteReplyMail()` (to the thread owner), both emitted by `CreateQuoteMessageProvider`. The two events share one `QuoteMessagePostedPayload` — `userEmail`/`userFirstName` are always the thread owner's (recipient for the admin reply, sender identity for the user message).
- Other providers in `UsersModule` that send mail (`ResendVerificationProvider`, `ForgotPasswordProvider`, `ResetPasswordProvider`) still call `MailService` directly — they are synchronous flows where the email is the primary response signal (e.g. the user is waiting for the reset link).
