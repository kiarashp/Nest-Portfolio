# CLAUDE.md — test/

Guidance for writing e2e tests. See root `CLAUDE.md` for commands (`pnpm run test:e2e`) and the overall architecture.

## Helper infrastructure (`test/helpers/`)

Three shared helpers eliminate boilerplate from every spec.

### `create-app.helper.ts` — `createApp(moduleFixture)`

Wraps `moduleFixture.createNestApplication()`, applies the same `ValidationPipe` options as production, calls `app.init()`, and returns `{ app, dataSource }`. Always use this instead of hand-rolling the pipe.

```ts
;({ app, dataSource } = await createApp(moduleFixture))
```

### `seed.helper.ts` — `seedUser` / `cleanupUsers`

Direct DB inserts — bypasses the HTTP layer and the email side-effect of `POST /users`.

```ts
await seedUser(dataSource, {
  email: 'test@e2e.test',
  password: 'Password1!',   // plain-text — hashed internally with bcryptjs
  firstName: 'Test',        // default: 'Test'
  role: UserRole.ADMIN,     // default: UserRole.USER
  isEmailVerified: true,    // default: true
})

await cleanupUsers(dataSource, ['test@e2e.test', 'other@e2e.test'])
```

### `auth.helper.ts` — `getAuthToken` + `ApiResponse<T>`

`getAuthToken` does a real `POST /auth/sign-in` and returns the access token string.
`ApiResponse<T>` is the envelope produced by `DataResponseInterceptor` — import it instead of defining it locally in each spec.

```ts
import { ApiResponse, getAuthToken } from '../helpers/auth.helper'

token = await getAuthToken(app, email, password)
const user = (res.body as ApiResponse<User>).data
```

Always cast `res.body as ApiResponse<T>` **before** accessing `.data` — not after — to satisfy `@typescript-eslint/no-unsafe-member-access`.

## TypeORM repository calls in tests

TypeORM's `findOneBy()` / `findOne()` return types go through complex internal conditional types that ESLint's `no-unsafe-assignment` cannot resolve, so assigning the result directly triggers **"Unsafe assignment of an error typed value"**. Always add an explicit type annotation:

```ts
// ✗ triggers no-unsafe-assignment
const user = await userRepo.findOneBy({ id: userId })

// ✓ explicit annotation silences the error
const user: User | null = await userRepo.findOneBy({ id: userId })
```

Same applies to anything chained off the result (e.g. accessing a nullable column):

```ts
const token: string = user!.passwordResetToken!
```

When calling `userRepo.update()` or `userRepo.save()` without capturing the return value, no annotation is needed — the error only fires on assignment.

## Cleaning up FK-linked rows

When a spec hard-deletes rows in `afterAll`/pre-cleanup, delete child rows before their parent or the FK constraint fails. The non-obvious case is uploaded images: `upload_file.productId` and `upload_file.postId` are FKs with no cascade, so a product/post cannot be `repo.delete()`d while image rows still reference it. The products spec (`test/products/products.e2e-spec.ts`) deletes `upload_file` rows by `productId` first, then the products. (Soft-deleting a product through the API purges its images automatically — this only bites the raw-repo hard-deletes in test cleanup.)

## First test:e2e run after an entity change

The e2e suites run in parallel and each boots `AppModule` with `DB_SYNC=true`, so the **first** `test:e2e` run after you add/change a column or relation does the schema DDL concurrently across ~20 suites. That contention can spuriously time out a `beforeAll` (`createApp`) in a suite or two and cascade into FK errors. It is not a real failure — just re-run `test:e2e`; once the schema is synced the per-suite sync is a no-op and the run is stable. To verify a single suite in isolation, run it through the script so the required env is set: `pnpm exec cross-env NODE_ENV=test NODE_OPTIONS=--experimental-vm-modules jest --config ./test/jest-e2e.json <path>` (a bare `pnpm jest` skips `NODE_OPTIONS`, which breaks `FileTypeValidator`'s ESM `file-type` load and makes image uploads return 400).

## Spec file pattern

`createApp()` owns the full module build. Do not call `Test.createTestingModule` in specs.
By default it mocks `MailService` (all methods no-op) and `ThrottlerStorage` (never blocks).

```ts
describe('Feature (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource
  let token: string

  const EMAIL = 'feature-user@e2e.test'
  const PASSWORD = 'Password1!'

  beforeAll(async () => {
    ;({ app, dataSource } = await createApp())

    // Pre-cleanup: delete rows left by a previous failed run so re-runs never
    // hit unique-constraint conflicts.
    await cleanupUsers(dataSource, [EMAIL])

    await seedUser(dataSource, { email: EMAIL, password: PASSWORD })
    token = await getAuthToken(app, EMAIL, PASSWORD)
  })

  afterAll(async () => {
    await cleanupUsers(dataSource, [EMAIL])
    await app.close()
  })
})
```

## `createApp` options

### Tracking mail calls

`MailService` is always fully mocked — all methods are silent no-ops unless overridden. Available mock keys in `MailMock`:

| Key | Triggered by |
|---|---|
| `sendMail` | raw `mailService.sendMail()` calls |
| `sendWelcomeMail` | `POST /users` (registration) |
| `sendVerificationMail` | `POST /auth/resend-verification` |
| `sendPasswordResetMail` | `POST /auth/forgot-password` |
| `sendContactNotification` | `POST /contact` |

Pass only the methods you need to assert on. Unspecified methods get a silent no-op automatically:

```ts
const sendPasswordResetMailMock = jest.fn().mockResolvedValue(undefined)

;({ app, dataSource } = await createApp({
  mailMock: { sendPasswordResetMail: sendPasswordResetMailMock },
}))

// In beforeEach — reset call count between tests:
sendPasswordResetMailMock.mockClear()
```

### Testing real throttling

`ThrottlerStorage` is mocked by default so hit counts never accumulate. In
`throttle.e2e-spec.ts` only, opt in to real throttling:

```ts
;({ app } = await createApp({ skipThrottle: false }))
```

**Why `ThrottlerStorage` and not `ThrottlerGuard`:** `ThrottlerGuard` is registered via
`{ provide: APP_GUARD, useClass: ThrottlerGuard }` so NestJS tracks it under the `APP_GUARD`
token, not `ThrottlerGuard`. Overriding `ThrottlerGuard` is silently ignored. Mocking
`ThrottlerStorage` (which the guard injects) cuts throttling at the right point.

Throttle limits that matter in tests:

| Route | Limit |
|---|---|
| `POST /auth/forgot-password` | 3 / 300 s |
| `POST /auth/resend-verification` | 3 / 300 s |
| `POST /contact` | 3 / 300 s |
| `POST /auth/sign-in` | 5 / 60 s |
| `POST /auth/refresh-tokens` | 10 / 60 s |
| `POST /auth/reset-password` | 5 / 60 s |
| `POST /auth/change-password` | 5 / 60 s |
| `POST /users` | 5 / 600 s |

## Minting tokens for Google-only users

`getAuthToken()` calls `POST /auth/sign-in` which requires a local password — it cannot be used for users created via Google OAuth (no `password` field). To get a bearer token for a Google-only user in tests, retrieve `GenerateTokensProvider` directly from the app and call `generateTokens()`:

```ts
import { GenerateTokensProvider } from '../../src/auth/providers/generate-tokens.provider'

// Seed the Google user directly (no password)
const userRepo = dataSource.getRepository(User)
const googleUser: User = await userRepo.save({
  firstName: 'Google',
  email: GOOGLE_EMAIL,
  isEmailVerified: true,
  role: UserRole.USER,
})

// Mint a real JWT without going through sign-in
const generateTokens = app.get(GenerateTokensProvider)
const tokens = await generateTokens.generateTokens(googleUser)
googleToken = tokens.accessToken
```

This produces a real signed JWT (not a forged one) and is the correct pattern for testing authenticated routes against Google-only accounts. See `test/auth/auth-change-password.e2e-spec.ts` for a working example.

## Naming and file layout

- File names: `<resource>-<concern>.e2e-spec.ts` (e.g. `posts-crud.e2e-spec.ts`, `auth/sign-in.e2e-spec.ts`)
- Use namespaced emails to avoid cross-spec collisions: `<suite>-<role>@e2e.test` (e.g. `posts-author@e2e.test`)
- Section headers inside a file: `// ── VERB /route ─────────────────────────────────────` (consistent width)

## When to split a spec file

Keep everything about one resource in one file (one `beforeAll`, shared seed IDs). Split only when:
- Sections need different app configurations (different provider overrides)
- The file exceeds ~600–700 lines
- There is genuinely no shared state between sections

Do not split just because a file is long — each separate file boots the NestJS app independently (~5–10 s), so unnecessary splits slow the suite significantly.

## User response fields

`email`, `role`, and `isEmailVerified` are `@Expose({ groups: ['admin'] })` on the `User` entity, so they only appear when the `admin` serialization group is active. `UsersController` activates this group class-wide, so all routes under `/users` (including `/users/me`) return these fields. `PostsController` does not activate any group, so embedded author objects on post responses only contain `id`, `firstName`, `lastName`, and `avatarUrl`.

When writing assertions against user data returned from post routes, do not assert on `email`, `role`, or `isEmailVerified` — they will not be present.

## Pagination count/data race condition

`PaginationProvider` runs `repository.count()` then `repository.find()` as two separate queries with no transaction between them. Under parallel test execution, another suite can insert or delete a row between those two calls.

**Order matters:** count runs first so that a concurrent delete (the common case — other specs clean up in `afterAll`) makes `totalItems` the larger number, keeping `totalItems >= data.length` true. A concurrent insert between count and find would break this, but inserts all happen in `beforeAll` at the very start of the run, well before pagination tests execute.

**Do not assert strict equality between `data.length` and `meta.totalItems`.** Assert the invariant that actually matters:

```ts
// ✗ fragile under parallel execution
expect(body.data.length).toBe(body.meta.totalItems)

// ✓ safe: totalItems is not capped, and we got at least what we seeded
expect(body.meta.totalItems).toBeGreaterThanOrEqual(body.data.length)
expect(body.data.length).toBeGreaterThanOrEqual(seededCount)
```

## Unscoped inclusion assertions on a sorted, shared list endpoint

An endpoint with a real default sort (e.g. `GET /posts` defaults to `createdAt desc`) returns the page-1 slice as the **newest** rows across the whole table, not just the rows this suite seeded. Since e2e suites run in parallel and keep inserting rows into shared tables (`post`, `user`, etc.) throughout the run, a test that queries the endpoint with no filter and asserts `expect(ids).toContain(seededId)` can flake or fail outright once enough other suites' newer rows push the seeded one off page 1 — this is a real ordering effect, not a race condition to shrug off.

**Scope the query** with a filter unique to the suite (`authorId`, `tagIds`, a distinctive `q` term, etc.) so the result set only ever contains this suite's own rows, then assert on that scoped set:

```ts
// ✗ fragile — page 1 is the newest rows across every suite's posts
const res = await request(app.getHttpServer()).get('/posts').query({ startDate }).expect(200)
expect(ids).toContain(seededPostId)

// ✓ safe — scoped to only this suite's seeded posts
const res = await request(app.getHttpServer())
  .get('/posts')
  .query({ authorId, startDate })
  .expect(200)
expect(ids).toContain(seededPostId)
```

See `test/posts/posts-filter.e2e-spec.ts`'s `startDate`/`endDate` tests, which scope by `authorId` for exactly this reason.

## Whole-table aggregate endpoints (no scoping filter available)

Some endpoints return a single aggregate object computed over an entire table with no per-suite scoping parameter to narrow it — e.g. `GET /admin/stats` (`test/admin-stats.e2e-spec.ts`), which counts every row in `post`, `product`, `user`, etc. Unlike list endpoints, there is no `authorId`/`tagIds`-style filter to add, so the two techniques above (scoped queries, race-free lower bounds) don't apply.

For these, assert only:
- **Shape and type** — every field is present and is a number (or the expected nested shape).
- **Internal consistency** — invariants that hold regardless of what other suites have inserted, e.g. `products.total === products.published + products.draft`.
- **A loose lower bound** for counts this suite itself seeded, e.g. `stats.users >= 2` after seeding two users — never an exact count, since other suites are concurrently inserting rows into the same shared tables.

Do not assert an exact total against a whole-table aggregate — there is no way to make that race-free under the shared parallel e2e database.

## Paginated response shape

Routes that return paginated lists (`GET /posts`, `GET /users`) wrap their payload in a `Paginated<T>` object:

```ts
interface Paginated<T> {
  data: T[]
  meta: { itemsPerPage: number; totalItems: number; currentPage: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean }
  links: Record<string, string>
}
```

Access it as `(res.body as ApiResponse<Paginated<Post>>).data.data`.
