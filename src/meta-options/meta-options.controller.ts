import { Body, Controller, Inject, Post } from '@nestjs/common'
import { CreatePostMetaOptionsDto } from './dto/create-post-meta-options.dto'
import { MetaOptionsService } from './provieders/meta-options.service'
import { Roles } from 'src/auth/decorators/roles.decorator'
import { UserRole } from 'src/auth/enums/user-role.enum'

@Controller('meta-options')
export class MetaOptionsController {
  constructor(
    /**
     * injecting meta options repository
     */
    @Inject(MetaOptionsService)
    private readonly metaOptionsService: MetaOptionsService,
  ) {}
  /**
   * create a new meta option
   */
  @Roles(UserRole.EDITOR, UserRole.AUTHOR, UserRole.ADMIN)
  @Post()
  public async createMetaOption(
    @Body() createPostMetaOptionsDto: CreatePostMetaOptionsDto,
  ) {
    return this.metaOptionsService.create(createPostMetaOptionsDto)
  }
}
