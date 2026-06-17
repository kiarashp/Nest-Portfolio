import {
  Controller,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  ParseFilePipe,
  ParseIntPipe,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { PostsService } from './providers/posts.service'
import { CreatePostDto } from './dto/create-post.dto'
import { PatchPostDto } from './dto/update-post.dto'
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger'
import { GetPostsDto } from './dto/get-posts.dto'
import { ActiveUser } from 'src/auth/decorators/active-user.decorator'
import type { ActiveUserData } from 'src/auth/interfaces/active-user-data.interface'
import { Roles } from 'src/auth/decorators/roles.decorator'
import { UserRole } from 'src/auth/enums/user-role.enum'

@Controller('posts')
@ApiTags('Posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  /**
   * create a new post
   */
  @ApiOperation({ summary: 'Create a new post' })
  @ApiResponse({
    status: 201,
    description: 'The post has been successfully created',
  })
  @Roles(UserRole.EDITOR, UserRole.AUTHOR, UserRole.ADMIN)
  @Post()
  public createPost(
    @Body() createPostDto: CreatePostDto,
    @ActiveUser() activeUser: ActiveUserData,
  ) {
    return this.postsService.create(createPostDto, activeUser)
  }

  /**
   * get all the posts
   */
  @Get()
  findAll(@Query() getPostsDto: GetPostsDto) {
    return this.postsService.findAll(getPostsDto)
  }

  /**
   * get a single post
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.postsService.findOne(+id)
  }

  /**
   * update a post
   */
  @ApiOperation({ summary: 'Update a post' })
  @ApiResponse({
    status: 200,
    description: 'The post has been successfully updated',
  })
  @Roles(UserRole.EDITOR, UserRole.AUTHOR, UserRole.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() patchPostDto: PatchPostDto,
    @ActiveUser() activeUser: ActiveUserData,
  ) {
    return this.postsService.update(id, patchPostDto, activeUser)
  }

  /**
   * upload an image for a post
   */
  @ApiOperation({ summary: 'Upload an image for a post' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Image uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file' })
  @ApiResponse({ status: 403, description: 'Not the post author' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  @ApiBearerAuth()
  @Roles(UserRole.EDITOR, UserRole.AUTHOR, UserRole.ADMIN)
  @Post(':id/images')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  public uploadPostImage(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|webp|gif)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Param('id', ParseIntPipe) postId: number,
    @ActiveUser() activeUser: ActiveUserData,
  ) {
    return this.postsService.uploadPostImage(file, postId, activeUser)
  }

  /**
   * delete a post
   */
  @Roles(UserRole.EDITOR, UserRole.AUTHOR, UserRole.ADMIN)
  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @ActiveUser() activeUser: ActiveUserData,
  ) {
    return this.postsService.remove(id, activeUser)
  }
}
