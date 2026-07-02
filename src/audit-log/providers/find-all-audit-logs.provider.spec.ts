import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { In } from 'typeorm'
import { FindAllAuditLogsProvider } from './find-all-audit-logs.provider'
import { AuditLog } from '../entities/audit-log.entity'
import { User } from 'src/users/entities/user.entity'
import { PaginationProvider } from 'src/common/pagination/providers/pagination.provider'

// attachUserSnapshots is private — this suite exercises it directly rather
// than through findAll(), since this codebase has no precedent for mocking
// TypeORM's createQueryBuilder() chain (see FindAllProductsProvider, which
// has no unit spec for the same reason).
describe('FindAllAuditLogsProvider — attachUserSnapshots', () => {
  let provider: FindAllAuditLogsProvider
  let userFindMock: jest.Mock

  beforeEach(async () => {
    userFindMock = jest.fn().mockResolvedValue([])

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FindAllAuditLogsProvider,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: {},
        },
        {
          provide: getRepositoryToken(User),
          useValue: { find: userFindMock },
        },
        {
          provide: PaginationProvider,
          useValue: { paginateQueryBuilder: jest.fn() },
        },
      ],
    }).compile()

    provider = module.get(FindAllAuditLogsProvider)
  })

  const attach = (rows: AuditLog[]): Promise<void> =>
    (
      provider as unknown as {
        attachUserSnapshots: (rows: AuditLog[]) => Promise<void>
      }
    ).attachUserSnapshots(rows)

  const makeRow = (userId: number | null): AuditLog =>
    ({
      id: 1,
      userId,
      action: 'CREATE',
      entity: 'Post',
      entityId: 1,
    }) as AuditLog

  it('attaches a live snapshot with deleted: false when the user exists', async () => {
    userFindMock.mockResolvedValue([
      {
        id: 42,
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
      },
    ])
    const rows = [makeRow(42)]

    await attach(rows)

    expect(rows[0].user).toEqual({
      id: 42,
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      deleted: false,
    })
  })

  it('attaches a deleted:true snapshot with null fields when the user id has no match', async () => {
    userFindMock.mockResolvedValue([])
    const rows = [makeRow(999999)]

    await attach(rows)

    expect(rows[0].user).toEqual({
      id: 999999,
      firstName: null,
      lastName: null,
      email: null,
      deleted: true,
    })
  })

  it('sets user to null and skips the lookup when userId is null', async () => {
    const rows = [makeRow(null)]

    await attach(rows)

    expect(rows[0].user).toBeNull()
    expect(userFindMock).not.toHaveBeenCalled()
  })

  it('deduplicates userIds shared across rows into a single batch lookup', async () => {
    userFindMock.mockResolvedValue([
      {
        id: 7,
        firstName: 'Grace',
        lastName: 'Hopper',
        email: 'grace@example.com',
      },
    ])
    const rows = [makeRow(7), makeRow(7), makeRow(null)]

    await attach(rows)

    expect(userFindMock).toHaveBeenCalledTimes(1)
    expect(userFindMock).toHaveBeenCalledWith({
      where: { id: In([7]) },
      select: { id: true, firstName: true, lastName: true, email: true },
    })
    expect(rows[0].user?.deleted).toBe(false)
    expect(rows[1].user?.deleted).toBe(false)
    expect(rows[2].user).toBeNull()
  })
})
