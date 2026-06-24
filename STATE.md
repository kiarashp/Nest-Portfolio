# Backend Finalization State

This file is the single source of truth for what still needs to be built before the Svelte frontend (and later Flutter app) can be developed. Each feature includes the full picture: why it exists, how the existing codebase relates to it, and what exactly needs to be implemented. Check off tasks as they are completed.

## Project overview

NestJS 11 + TypeORM + PostgreSQL backend for a personal blog/portfolio. Auth is fully implemented (JWT, Google OAuth, email verification, password reset, refresh token dual delivery for browser + mobile). Posts, tags, uploads (Cloudinary), and user management are all in place. RBAC has four roles: USER, EDITOR, AUTHOR, ADMIN. All responses are wrapped in `{ apiVersion, data }` by `DataResponseInterceptor`. The global `ValidationPipe` strips and rejects unknown fields. Rate limiting (`ThrottlerGuard`) is the first guard in the pipeline.

All backend features are complete. The items below are either deferred post-launch additions or the final pre-launch verification checklist.

---

## Deferred (post-launch)

These are real features but out of scope until the frontend is running and real usage patterns are clear.

- **Scheduled post auto-publishing** — The `publishOn` field is stored on `Post` but nothing acts on it. A cron job (e.g. `@nestjs/schedule`) would query for posts where `status = SCHEDULED AND publishOn <= now()` and flip them to `PUBLISHED`. Deferred because it adds infrastructure complexity and isn't needed to launch.
- **Comments** — No entity, no routes. Significant scope — needs moderation, notifications, threading.
- **Post likes/reactions** — No engagement tracking at all. Needs its own entity and auth-aware endpoints.
- **Newsletter subscribers** — A subscriber list entity and a subscribe/unsubscribe endpoint. Not needed until there is content to send.
- **Refresh token revocation** — Right now old refresh tokens remain valid until they expire (24h). A revocation list (Redis or DB table) would enable logout-all-devices. The no-Redis approach: a `refresh_token_revocations` DB table `(jti, expiresAt)`, a `jti` claim added to refresh tokens in `GenerateTokensProvider`, and a lookup in `RefreshTokensProvider` before issuing new tokens. A daily cron cleans up expired rows. Deferred for now, but prioritise before real employee accounts exist on a production company site.
- **Audit logging** — No trail of who did what. Nice for admin dashboards but not needed to launch.
- **`GET /tags` response cap** — `TagsService.findAll()` runs `repository.find()` with no limit, returning all tags in one query. Safe for now, worth adding a simple `take: 200` cap before launch.

---

## Post-implementation checklist

Run these after finishing all features above:

- [x] `pnpm run build` — TypeScript compilation must pass with zero errors
- [x] `pnpm run lint` — ESLint + Prettier auto-fix; no unfixable errors (the only known unfixable error is the stale `src/app.controller.spec.ts`)
- [x] `pnpm run test` — all unit tests green
- [x] `pnpm run test:e2e` — all new e2e specs pass (requires `.env.test` pointing at the test DB `nest_portfolio_test`)
- [ ] `pnpm run generate:types` — regenerate `openapi-types.ts`; open it and confirm the new endpoints appear with correct request/response types
- [ ] Manually smoke-test via Swagger at `/api`: tag update, post filters (`startDate`/`endDate` on `GET /posts`)
