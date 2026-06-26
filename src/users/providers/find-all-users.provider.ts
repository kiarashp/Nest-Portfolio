import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from '../entities/user.entity'
import type { Request } from 'express'
import { PaginationProvider } from 'src/common/pagination/providers/pagination.provider'
import { PaginationQueryDto } from 'src/common/pagination/dtos/pagination-query.dto'
import { Paginated } from 'src/common/pagination/interfaces/paginated.interface'

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
   * Returns a paginated list of all users. Only admins should call this route.
   */
  public async findAll(
    paginationQuery: PaginationQueryDto,
    request: Request,
  ): Promise<Paginated<User>> {
    return this.paginationProvider.paginateQuery(
      paginationQuery,
      this.userRepository,
      undefined,
      request,
    )
  }
}
