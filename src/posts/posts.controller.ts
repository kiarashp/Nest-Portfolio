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
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import type { Request } from 'express'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { PostsService } from './providers/posts.service'
import { CreatePostDto } from './dto/create-post.dto'
import { PatchPostDto } from './dto/update-post.dto'
import {
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
// entity aliased to PostEntity because the HTTP `Post` decorator owns the `Post` name here
import { Post as PostEntity } from './entities/post.entity'
import { UploadFile } from 'src/uploads/entities/upload-file.entity'
import { DeleteResultDto } from 'src/common/dto/delete-result.dto'
import {
  ApiArrayDataResponse,
  ApiDataResponse,
  ApiPaginatedResponse,
} from 'src/common/swagger/api-response.helpers'
import { ApiAuth } from 'src/common/swagger/api-auth.helpers'

// Roles allowed to write posts; EDITOR is additionally restricted to their own posts.
const POST_WRITE_ROLES = [UserRole.EDITOR, UserRole.AUTHOR, UserRole.ADMIN]
const POST_OWNERSHIP = 'EDITOR limited to their own posts'

@Controller('posts')
@ApiTags('Posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  /**
   * create a new post
   */
  @ApiOperation({ summary: 'Create a new post' })
  @ApiAuth({ roles: POST_WRITE_ROLES })
  @ApiDataResponse(PostEntity, {
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
  @ApiPaginatedResponse(PostEntity)
  @Auth(AuthType.None)
  @Get()
  findAll(@Query() getPostsDto: GetPostsDto, @Req() request: Request) {
    return this.postsService.findAll(getPostsDto, request)
  }

  /**
   * get a single published post by slug (public)
   */
  @ApiDataResponse(PostEntity)
  @Auth(AuthType.None)
  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.postsService.findBySlug(slug)
  }

  /**
   * get all posts by the authenticated user (all statuses)
   */
  @ApiOperation({ summary: 'Get all posts by the authenticated user' })
  @ApiAuth()
  @ApiPaginatedResponse(PostEntity)
  @Get('my')
  findMyPosts(
    @ActiveUser() activeUser: ActiveUserData,
    @Query() getPostsDto: GetPostsDto,
    @Req() request: Request,
  ) {
    return this.postsService.findMyPosts(activeUser.sub, getPostsDto, request)
  }

  /**
   * list all posts including drafts — author and admin dashboard view
   */
  @ApiOperation({
    summary: 'List all posts including drafts (author and admin)',
  })
  @ApiAuth({ roles: [UserRole.AUTHOR, UserRole.ADMIN] })
  @ApiPaginatedResponse(PostEntity)
  @Roles(UserRole.AUTHOR, UserRole.ADMIN)
  @Get('admin')
  findAllAdmin(@Query() getPostsDto: GetPostsDto, @Req() request: Request) {
    return this.postsService.findAllAdmin(getPostsDto, request)
  }

  /**
   * get a single published post by id (public)
   */
  @ApiDataResponse(PostEntity)
  @Auth(AuthType.None)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.postsService.findOne(id)
  }

  /**
   * update a post
   */
  @ApiOperation({ summary: 'Update a post' })
  @ApiAuth({ roles: POST_WRITE_ROLES, ownership: POST_OWNERSHIP })
  @ApiDataResponse(PostEntity, {
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
  @ApiAuth({ roles: POST_WRITE_ROLES, ownership: POST_OWNERSHIP })
  @ApiDataResponse(PostEntity, { description: 'Tags added successfully' })
  @ApiResponse({ status: 400, description: 'Invalid tag IDs' })
  @ApiResponse({ status: 404, description: 'Post not found' })
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
  @ApiAuth({ roles: POST_WRITE_ROLES, ownership: POST_OWNERSHIP })
  @ApiDataResponse(PostEntity, { description: 'Tags removed successfully' })
  @ApiResponse({ status: 404, description: 'Post not found' })
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
   * list all images uploaded for a post — used by the frontend image picker
   */
  @ApiOperation({ summary: 'List all images uploaded for a post' })
  @ApiAuth({ roles: POST_WRITE_ROLES, ownership: POST_OWNERSHIP })
  @ApiArrayDataResponse(UploadFile, {
    description: 'Array of UploadFile records',
  })
  @ApiResponse({ status: 404, description: 'Post not found' })
  @Roles(UserRole.EDITOR, UserRole.AUTHOR, UserRole.ADMIN)
  @Get(':id/images')
  findPostImages(
    @Param('id', ParseIntPipe) id: number,
    @ActiveUser() activeUser: ActiveUserData,
  ) {
    return this.postsService.findPostImages(id, activeUser)
  }

  /**
   * upload an image for a post
   */
  @ApiOperation({ summary: 'Upload an image for a post' })
  @ApiConsumes('multipart/form-data')
  @ApiAuth({ roles: POST_WRITE_ROLES, ownership: POST_OWNERSHIP })
  @ApiDataResponse(UploadFile, {
    status: 201,
    description: 'Image uploaded successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid file' })
  @ApiResponse({ status: 404, description: 'Post not found' })
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
   * delete a single image from a post
   */
  @ApiOperation({ summary: 'Delete a single image from a post' })
  @ApiAuth({ roles: POST_WRITE_ROLES, ownership: POST_OWNERSHIP })
  @ApiDataResponse(DeleteResultDto)
  @ApiResponse({ status: 404, description: 'Post or image not found' })
  @Roles(UserRole.EDITOR, UserRole.AUTHOR, UserRole.ADMIN)
  @Delete(':id/images/:fileId')
  removePostImage(
    @Param('id', ParseIntPipe) id: number,
    @Param('fileId', ParseIntPipe) fileId: number,
    @ActiveUser() activeUser: ActiveUserData,
  ) {
    return this.postsService.deletePostImage(id, fileId, activeUser)
  }

  /**
   * delete a post
   */
  @ApiOperation({ summary: 'Delete a post' })
  @ApiAuth({ roles: POST_WRITE_ROLES, ownership: POST_OWNERSHIP })
  @ApiDataResponse(DeleteResultDto)
  @Roles(UserRole.EDITOR, UserRole.AUTHOR, UserRole.ADMIN)
  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @ActiveUser() activeUser: ActiveUserData,
  ) {
    return this.postsService.remove(id, activeUser)
  }
}
