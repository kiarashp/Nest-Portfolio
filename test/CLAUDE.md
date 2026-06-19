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
  password: 'Password1!',   // plain-text — hashed internally with bcrypt
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

## Spec file pattern

```ts
describe('Feature (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource
  let token: string

  const EMAIL = 'feature-user@e2e.test'
  const PASSWORD = 'Password1!'

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      // Only override providers that have real side-effects (mail, payment…).
      .overrideProvider(MailService)
      .useValue({ sendWelcomeMail: jest.fn() })
      .compile()

    ;({ app, dataSource } = await createApp(moduleFixture))

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

## When to override `MailService`

Any test that calls `POST /users` (registration) must override `MailService`, otherwise the test tries to open an SMTP connection:

```ts
.overrideProvider(MailService)
.useValue({
  sendVerificationMail: jest.fn().mockResolvedValue(undefined),
  sendWelcomeMail: jest.fn().mockResolvedValue(undefined),
  sendMail: jest.fn().mockResolvedValue(undefined),
})
```

Tests that seed users via `seedUser()` (direct DB insert) do **not** need this override — the mail call only fires when the HTTP endpoint is hit.

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
