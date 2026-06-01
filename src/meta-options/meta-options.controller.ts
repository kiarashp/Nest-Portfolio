import { Body, Controller, Inject, Post } from '@nestjs/common'
import { CreatePostMetaOptionsDto } from './dto/create-post-meta-options.dto'
import { MetaOptionsService } from './provieders/meta-options.service'

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
  @Post()
  public async createMetaOption(
    @Body() createPostMetaOptionsDto: CreatePostMetaOptionsDto,
  ) {
    return this.metaOptionsService.create(createPostMetaOptionsDto)
  }
}
