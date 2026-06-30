import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common'
import { TagsService } from './providers/tags.service'
import { CreateTagDto } from './dto/create-tag.dto'
import { UpdateTagDto } from './dto/update-tag.dto'
import { Auth } from 'src/auth/decorators/auth.decorator'
import { AuthType } from 'src/auth/enums/auth-type.enum'
import { Roles } from 'src/auth/decorators/roles.decorator'
import { UserRole } from 'src/auth/enums/user-role.enum'
import { ActiveUser } from 'src/auth/decorators/active-user.decorator'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import {
  ApiArrayDataResponse,
  ApiDataResponse,
} from 'src/common/swagger/api-response.helpers'
import { ApiAuth } from 'src/common/swagger/api-auth.helpers'
import { DeleteResultDto } from 'src/common/dto/delete-result.dto'
import { Tag } from './entities/tag.entity'

// Roles allowed to write tags — tags are global reference data, no per-row ownership.
const TAG_WRITE_ROLES = [UserRole.AUTHOR, UserRole.ADMIN]

@Controller('tags')
@ApiTags('Tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  /**
   * get all tags — public, tags are read-only reference data
   */
  @Auth(AuthType.None)
  @Get()
  @ApiArrayDataResponse(Tag)
  public async findAllTags() {
    return await this.tagsService.findAll()
  }

  /**
   * create a new tag
   */
  @Roles(UserRole.AUTHOR, UserRole.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Create a new tag' })
  @ApiAuth({ roles: TAG_WRITE_ROLES })
  @ApiDataResponse(Tag, { status: 201, description: 'Tag created' })
  public async createTag(
    @Body() createTagDto: CreateTagDto,
    @ActiveUser('sub') activeUserId: number,
  ) {
    return await this.tagsService.create(createTagDto, activeUserId)
  }

  /**
   * update a tag's fields
   */
  @Roles(UserRole.AUTHOR, UserRole.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: "Update a tag's fields" })
  @ApiAuth({ roles: TAG_WRITE_ROLES })
  @ApiDataResponse(Tag, { description: 'Tag updated' })
  public async updateTag(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTagDto: UpdateTagDto,
  ) {
    return await this.tagsService.update(id, updateTagDto)
  }

  /**
   * soft delete a tag
   */
  @Roles(UserRole.AUTHOR, UserRole.ADMIN)
  @Delete('soft/:id')
  @ApiOperation({ summary: 'Soft-delete a tag' })
  @ApiAuth({ roles: TAG_WRITE_ROLES })
  @ApiDataResponse(DeleteResultDto, { description: 'Tag soft-deleted' })
  public async softDeleteTag(
    @Param('id', ParseIntPipe) id: number,
    @ActiveUser('sub') activeUserId: number,
  ) {
    return await this.tagsService.softDelete(id, activeUserId)
  }

  /**
   * hard delete a tag
   */
  @Roles(UserRole.AUTHOR, UserRole.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Hard-delete a tag' })
  @ApiAuth({ roles: TAG_WRITE_ROLES })
  @ApiDataResponse(DeleteResultDto, { description: 'Tag deleted' })
  public async deleteTag(
    @Param('id', ParseIntPipe) id: number,
    @ActiveUser('sub') activeUserId: number,
  ) {
    return await this.tagsService.delete(id, activeUserId)
  }
}
