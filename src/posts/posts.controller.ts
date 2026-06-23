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
import { PostTagsDto } from './dto/post-tags.dto'
import { ActiveUser } from 'src/auth/decorators/active-user.decorator'
import type { ActiveUserData } from 'src/auth/interfaces/active-user-data.interface'
import { Roles } from 'src/auth/decorators/roles.decorator'
import { UserRole } from 'src/auth/enums/user-role.enum'
import { Auth } from 'src/auth/decorators/auth.decorator'
import { AuthType } from 'src/auth/enums/auth-type.enum'

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
   * get all published posts (public)
   */
  @Auth(AuthType.None)
  @Get()
  findAll(@Query() getPostsDto: GetPostsDto) {
    return this.postsService.findAll(getPostsDto)
  }

  /**
   * get a single published post by slug (public)
   */
  @Auth(AuthType.None)
  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.postsService.findBySlug(slug)
  }

  /**
   * get all posts by the authenticated user (all statuses)
   */
  @Get('my')
  findMyPosts(
    @ActiveUser() activeUser: ActiveUserData,
    @Query() getPostsDto: GetPostsDto,
  ) {
    return this.postsService.findMyPosts(activeUser.sub, getPostsDto)
  }

  /**
   * get a single published post by id (public)
   */
  @Auth(AuthType.None)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.postsService.findOne(id)
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
   * add tags to a post without replacing the existing tag set
   */
  @ApiOperation({ summary: 'Add tags to a post' })
  @ApiResponse({ status: 200, description: 'Tags added successfully' })
  @ApiResponse({ status: 400, description: 'Invalid tag IDs' })
  @ApiResponse({ status: 403, description: 'Not the post author' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  @ApiBearerAuth()
  @Roles(UserRole.EDITOR, UserRole.AUTHOR, UserRole.ADMIN)
  @Post(':id/tags')
  addTags(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PostTagsDto,
    @ActiveUser() activeUser: ActiveUserData,
  ) {
    return this.postsService.addTags(id, dto, activeUser)
  }

  /**
   * remove tags from a post — idempotent if tag is not currently on the post
   */
  @ApiOperation({ summary: 'Remove tags from a post' })
  @ApiResponse({ status: 200, description: 'Tags removed successfully' })
  @ApiResponse({ status: 403, description: 'Not the post author' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  @ApiBearerAuth()
  @Roles(UserRole.EDITOR, UserRole.AUTHOR, UserRole.ADMIN)
  @Delete(':id/tags')
  removeTags(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PostTagsDto,
    @ActiveUser() activeUser: ActiveUserData,
  ) {
    return this.postsService.removeTags(id, dto, activeUser)
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
