import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common'
import { PostsService } from './providers/posts.service'
import { CreatePostDto } from './dto/create-post.dto'
import { PatchPostDto } from './dto/update-post.dto'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'

@Controller('posts')
@ApiTags('Posts')
export class PostsController {
  // Injecting PostsService
  constructor(private readonly postsService: PostsService) {}

  // Creating a post
  @ApiOperation({ summary: 'Create a new post' })
  @ApiResponse({
    status: 201,
    description:
      'The post has been successfully created,and you got 201 status code',
  })
  @Post()
  createPost(@Body() createPostDto: CreatePostDto) {
    return this.postsService.create(createPostDto)
  }

  @Get()
  findAll() {
    return this.postsService.findAll()
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.postsService.findOne(+id)
  }

  @ApiOperation({ summary: 'Update a post' })
  @ApiResponse({
    status: 200,
    description:
      'The post has been successfully updated and you got 200 status code',
  })
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() patchPostDto: PatchPostDto,
  ) {
    return this.postsService.update(id, patchPostDto)
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.postsService.remove(id)
  }
}
