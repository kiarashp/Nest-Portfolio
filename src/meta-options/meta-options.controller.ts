import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
} from '@nestjs/common'
import { MetaOptionsService } from './provieders/meta-options.service'
import { UpdateMetaOptionDto } from './dto/update-meta-option.dto'
import { Roles } from 'src/auth/decorators/roles.decorator'
import { UserRole } from 'src/auth/enums/user-role.enum'
import { ActiveUser } from 'src/auth/decorators/active-user.decorator'
import type { ActiveUserData } from 'src/auth/interfaces/active-user-data.interface'
import { ApiTags } from '@nestjs/swagger'
import { ApiDataResponse } from 'src/common/swagger/api-response.helpers'
import { DeleteResultDto } from 'src/common/dto/delete-result.dto'
import { MetaOption } from './entities/meta-option.entity'

@Controller('meta-options')
@ApiTags('Meta Options')
export class MetaOptionsController {
  constructor(
    /** inject meta options service */
    @Inject(MetaOptionsService)
    private readonly metaOptionsService: MetaOptionsService,
  ) {}

  /** Returns a MetaOption by ID. */
  @Roles(UserRole.EDITOR, UserRole.AUTHOR, UserRole.ADMIN)
  @Get(':id')
  @ApiDataResponse(MetaOption)
  public findOne(@Param('id', ParseIntPipe) id: number) {
    return this.metaOptionsService.findOne(id)
  }

  /** Updates the metaValue of a MetaOption. Only the post author or ADMIN may do this. */
  @Roles(UserRole.EDITOR, UserRole.AUTHOR, UserRole.ADMIN)
  @Patch(':id')
  @ApiDataResponse(MetaOption, { description: 'MetaOption updated' })
  public update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateMetaOptionDto: UpdateMetaOptionDto,
    @ActiveUser() activeUser: ActiveUserData,
  ) {
    return this.metaOptionsService.update(id, updateMetaOptionDto, activeUser)
  }

  /** Deletes a MetaOption without deleting its post. Only the post author or ADMIN may do this. */
  @Roles(UserRole.EDITOR, UserRole.AUTHOR, UserRole.ADMIN)
  @Delete(':id')
  @ApiDataResponse(DeleteResultDto, { description: 'MetaOption deleted' })
  public delete(
    @Param('id', ParseIntPipe) id: number,
    @ActiveUser() activeUser: ActiveUserData,
  ) {
    return this.metaOptionsService.delete(id, activeUser)
  }
}
