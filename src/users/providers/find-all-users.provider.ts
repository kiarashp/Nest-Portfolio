import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from '../entities/user.entity'
import type { Request } from 'express'
import { PaginationProvider } from 'src/common/pagination/providers/pagination.provider'
import { Paginated } from 'src/common/pagination/interfaces/paginated.interface'
import { GetUsersDto } from '../dtos/get-users.dto'

@Injectable()
export class FindAllUsersProvider {
  constructor(
    /**
     * Inject User repository
     */
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    /**
     * Inject pagination provider — handles take/skip and builds link headers
     */
    private readonly paginationProvider: PaginationProvider,
  ) {}

  /**
   * Returns a paginated list of all users, filterable by keyword, role, and
   * email verification status, and sortable by any of USER_SORT_FIELDS. Only
   * admins should call this route.
   */
  public async findAll(
    dto: GetUsersDto,
    request: Request,
  ): Promise<Paginated<User>> {
    const qb = this.userRepository.createQueryBuilder('user')

    // Keyword search — OR across first name, last name, and email, case-insensitive.
    if (dto.q) {
      qb.andWhere(
        '(user.firstName ILIKE :q OR user.lastName ILIKE :q OR user.email ILIKE :q)',
        { q: `%${dto.q}%` },
      )
    }

    if (dto.role) {
      qb.andWhere('user.role = :role', { role: dto.role })
    }

    if (dto.isEmailVerified !== undefined) {
      qb.andWhere('user.isEmailVerified = :isEmailVerified', {
        isEmailVerified: dto.isEmailVerified,
      })
    }

    // A secondary sort on id keeps pagination stable when the primary column ties.
    const sortBy = dto.sortBy ?? 'id'
    const order = (dto.order ?? 'asc').toUpperCase() as 'ASC' | 'DESC'
    qb.orderBy(`user.${sortBy}`, order)
    if (sortBy !== 'id') qb.addOrderBy('user.id', 'ASC')

    return this.paginationProvider.paginateQueryBuilder(dto, qb, request)
  }
}
