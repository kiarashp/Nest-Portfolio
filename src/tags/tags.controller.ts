import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common'
import { TagsService } from './providers/tags.service'
import { CreateTagDto } from './dto/create-tag.dto'

@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}
  /**
   * get all tags
   */
  @Get()
  public async findAllTags() {
    return await this.tagsService.findAll()
  }
  /**
   * create a new tag
   */
  @Post()
  public async createTag(@Body() createTagDto: CreateTagDto) {
    return await this.tagsService.create(createTagDto)
  }
  /**
   * soft delete a tag
   */
  @Delete('soft/:id')
  public async softDeleteTag(@Param('id', ParseIntPipe) id: number) {
    return await this.tagsService.delete(id)
  }
  /**
   * delete a tag
   */
  @Delete(':id')
  public async deleteTag(@Param('id', ParseIntPipe) id: number) {
    return await this.tagsService.softDelete(id)
  }
}
