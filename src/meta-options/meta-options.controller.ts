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

@Controller('meta-options')
export class MetaOptionsController {
  constructor(
    /** inject meta options service */
    @Inject(MetaOptionsService)
    private readonly metaOptionsService: MetaOptionsService,
  ) {}

  /** Returns a MetaOption by ID. */
  @Roles(UserRole.EDITOR, UserRole.AUTHOR, UserRole.ADMIN)
  @Get(':id')
  public findOne(@Param('id', ParseIntPipe) id: number) {
    return this.metaOptionsService.findOne(id)
  }

  /** Updates the metaValue of a MetaOption. Only the post author or ADMIN may do this. */
  @Roles(UserRole.EDITOR, UserRole.AUTHOR, UserRole.ADMIN)
  @Patch(':id')
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
  public delete(
    @Param('id', ParseIntPipe) id: number,
    @ActiveUser() activeUser: ActiveUserData,
  ) {
    return this.metaOptionsService.delete(id, activeUser)
  }
}
