# CLAUDE.md — src/audit-log

Guidance specific to this module. See the root `CLAUDE.md` for the high-level summary.

## Module structure

`src/audit-log` writes a permanent record after every write operation. `AuditLogService.log()` wraps `repository.save()` in a try/catch and swallows errors — it never blocks a request.

- `entities/audit-log.entity.ts` — `audit_logs` table. Columns: `id`, `userId` (nullable int — null for self-service operations like registration), `action` (varchar 32), `entity` (varchar 64), `entityId` (int), `createdAt`. No FK to any other table; rows are never deleted.
- `enums/audit-action.enum.ts` — `CREATE | UPDATE | DELETE | SOFT_DELETE`.
- `providers/audit-log.service.ts` — `log(userId, action, entity, entityId)` (write) and `findAll(dto)` (paginated read for the admin endpoint).
- `audit-log.controller.ts` — `GET /audit-logs`, ADMIN only; accepts `?entity` and `?action` filters (exact match). Documents auth/role in the spec via `@ApiAuth({ roles: [UserRole.ADMIN] })` and the response via `@ApiPaginatedResponse(AuditLog)` (the `AuditLog` entity is `@ApiProperty`-decorated) — see the root `CLAUDE.md` OpenAPI section.
- `audit-log.module.ts` — exports `AuditLogService`; imports `PaginationModule`.

## Instrumented providers

Every write provider calls `auditLogService.log(...)` after a successful save — `grep -r "auditLogService.log" src/` for the current set.

Two userId-source patterns:
- `activeUser.sub` — Posts and MetaOptions, read directly from `@ActiveUser()` decorator in the provider.
- Threaded `activeUserId` parameter — Users, Tags, Products, AvatarOptions. The controller reads `@ActiveUser('sub') activeUserId: number`, passes it to the service method, which passes it to the provider.

`CreateUserProvider` logs `null` as userId (self-registration; no authenticated actor).

## Signature threading

Several providers originally received only the target entity's `id`. When audit logging was added, `activeUserId: number` was added as a final parameter and threaded through the service facade and controller. Affected chains: `RemoveOneByIdProvider`, `ChangeUserRoleProvider`, `PatchUserProvider`, `AvatarOptionsProvider.create/remove`, and `TagsService.create/delete/softDelete`.

## Adding audit logging to a new provider

1. Import `AuditLogModule` in the domain module if not already imported.
2. Inject `AuditLogService` into the provider's constructor.
3. Call `await this.auditLogService.log(userId, AuditAction.ACTION, 'EntityName', entityId)` after the successful DB write.
4. If the provider doesn't currently receive `activeUserId`, add it as a parameter and thread it through the service facade and controller (see Signature threading above).
