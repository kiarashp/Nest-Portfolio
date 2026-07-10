# CLAUDE.md — src/audit-log

Guidance specific to this module. See the root `CLAUDE.md` for the high-level summary.

## Module structure

`src/audit-log` writes a permanent record after every write operation. `AuditLogService.log()` wraps `repository.save()` in a try/catch and swallows errors — it never blocks a request.

- `entities/audit-log.entity.ts` — `audit_logs` table. Columns: `id`, `userId` (nullable int — null for self-service operations like registration), `action` (varchar 32), `entity` (varchar 64), `entityId` (int), `createdAt`. No FK to any other table; rows are never deleted. Also carries a **transient** (non-column) `user?: AuditLogUserSnapshot | null` field, mirroring `ProductType.productCount` — populated by `FindAllAuditLogsProvider`, not by TypeORM.
- `dto/audit-log-user-snapshot.dto.ts` — `AuditLogUserSnapshot` (`id`, `firstName`, `lastName`, `email`, `deleted: boolean`), the shape attached to each row's `user` field. Semantics: `user === null` means `userId` was `null` (no actor); `user.deleted === true` (with null names/email) means `userId` was set but the `User` row has since been hard-deleted; otherwise it's a live snapshot.
- `enums/audit-action.enum.ts` — `CREATE | UPDATE | DELETE | SOFT_DELETE`.
- `providers/audit-log.service.ts` — thin facade: `log(userId, action, entity, entityId)` (write) delegates directly to the repository; `findAll(dto, request)` (paginated read) delegates to `FindAllAuditLogsProvider`.
- `providers/find-all-audit-logs.provider.ts` — builds a `SelectQueryBuilder<AuditLog>` (needed for caller-controlled `ORDER BY`, which the simple `paginateQuery`/`FindOptionsWhere` path can't express), applies the `entity`/`action` filters and `sortBy`/`order` sort (default `createdAt desc`, with an `id` tiebreaker), hands it to `paginationProvider.paginateQueryBuilder`, then attaches the `user` snapshot to each row via a single batch `User` lookup (`userRepository.find({ where: { id: In(ids) }, select: {...} })`) keyed by the page's distinct `userId`s — not a join, since `AuditLog` has no FK to `User` and `paginateQueryBuilder`'s `.getMany()` would not hydrate joined columns anyway.
- `audit-log.controller.ts` — `GET /audit-logs`, ADMIN only; accepts `?entity` and `?action` filters (exact match) plus `?sortBy` (`id | action | entity | entityId | userId | createdAt`) and `?order` (`asc | desc`), both validated by `@IsIn` (invalid values 400 via the global `ValidationPipe`). Documents auth/role in the spec via `@ApiAuth({ roles: [UserRole.ADMIN] })` and the response via `@ApiPaginatedResponse(AuditLog)` (the `AuditLog` entity is `@ApiProperty`-decorated, including the `user` snapshot field) — see the root `CLAUDE.md` OpenAPI section.
- `audit-log.module.ts` — exports `AuditLogService`; imports `PaginationModule` and registers the `User` entity directly in its own `TypeOrmModule.forFeature` (not `UsersModule` — that would be circular, since `UsersModule` already imports `AuditLogModule` for `.log()` calls; same pattern `ProductsModule` uses for the foreign `UploadFile` entity).

**TypeORM v1.0.0 gotcha:** the string-array `select` syntax (`select: ['id', 'firstName']`) was removed alongside `loadRelationCountAndMap` — use object syntax (`select: { id: true, firstName: true }`) everywhere, including in `find()` calls, not just relation options.

## Instrumented providers

Every write provider calls `auditLogService.log(...)` after a successful save — `grep -r "auditLogService.log" src/` for the current set.

Two userId-source patterns:
- `activeUser.sub` — Posts, read directly from `@ActiveUser()` decorator in the provider.
- Threaded `activeUserId` parameter — Users, Tags, Products, AvatarOptions, Configurator (`SegmentDefinition`/`SegmentOption` since Step 2, `ConfigurableProduct` since Step 3, `ProductSegmentAssignment` since Step 4, `SavedConfiguration` since Step 6 — here the actor is the owning end user, not an admin). The controller reads `@ActiveUser('sub') activeUserId: number`, passes it to the service method, which passes it to the provider.

`CreateUserProvider` logs `null` as userId (self-registration; no authenticated actor).

## Signature threading

Several providers originally received only the target entity's `id`. When audit logging was added, `activeUserId: number` was added as a final parameter and threaded through the service facade and controller. Affected chains: `RemoveOneByIdProvider`, `ChangeUserRoleProvider`, `PatchUserProvider`, `AvatarOptionsProvider.create/remove`, `TagsService.create/delete/softDelete`, and `ContactService.update` → `UpdateContactSubmissionProvider` (the `PATCH /contact/:id` handled-flag toggle).

## Adding audit logging to a new provider

1. Import `AuditLogModule` in the domain module if not already imported.
2. Inject `AuditLogService` into the provider's constructor.
3. Call `await this.auditLogService.log(userId, AuditAction.ACTION, 'EntityName', entityId)` after the successful DB write.
4. If the provider doesn't currently receive `activeUserId`, add it as a parameter and thread it through the service facade and controller (see Signature threading above).
