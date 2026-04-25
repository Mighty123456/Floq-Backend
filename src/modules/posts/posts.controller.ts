import { 
  Controller, Post, Get, Body, Param, UseGuards, 
  Request, UploadedFiles, UseInterceptors, Query, Patch, Delete
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { PostsService } from './posts.service';
import { JwtAuthGuard } from '../../common/guards/auth.guard';
import { CreatePostDto, CreateCommentDto, UpdatePostDto } from './dto/post.dto';
import { multerOptions } from '../../common/utils/multer-options';
import 'multer';

@Controller('posts')
@UseGuards(JwtAuthGuard)
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post('create')
  @UseInterceptors(FilesInterceptor('media', 10, multerOptions)) // Allow up to 10 files
  async createPost(
    @Request() req,
    @Body() createPostDto: CreatePostDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const audioData = createPostDto.audioData ? JSON.parse(createPostDto.audioData) : undefined;
    const location = createPostDto.location ? JSON.parse(createPostDto.location) : undefined;
    const metadata = createPostDto.metadata ? JSON.parse(createPostDto.metadata) : undefined;
    const taggedUsers = createPostDto.taggedUsers ? JSON.parse(createPostDto.taggedUsers) : undefined;

    return this.postsService.createPost(
      req.user.id, 
      createPostDto.caption || '', 
      files,
      createPostDto.type || 'post',
      audioData,
      location,
      metadata,
      taggedUsers
    );
  }

  @Get('feed')
  async getFeed(
    @Request() req,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
    return this.postsService.getFeed(req.user.id, pageNum, limitNum);
  }

  @Post(':id/like')
  async toggleLike(@Request() req, @Param('id') id: string) {
    return this.postsService.toggleLike(id, req.user.id);
  }

  @Post(':id/comment')
  async addComment(
    @Request() req,
    @Param('id') id: string,
    @Body() createCommentDto: CreateCommentDto,
  ) {
    return this.postsService.addComment(id, req.user.id, createCommentDto.text, createCommentDto.parentId);
  }

  @Get(':id/comments')
  async getComments(
    @Param('id') id: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('parentId') parentId?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
    return this.postsService.getComments(id, pageNum, limitNum, parentId);
  }


  @Get('user/:id')
  async getUserPosts(
    @Param('id') id: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.postsService.getUserPosts(id, parseInt(page, 10), parseInt(limit, 10));
  }

  @Get('reels')
  async getReels(@Request() req, @Query('page') page: string = '1') {
    return this.postsService.getReels(req.user.id, parseInt(page, 10));
  }

  @Delete(':id')
  async deletePost(@Request() req, @Param('id') id: string) {
    return this.postsService.deletePost(id, req.user.id);
  }

  @Patch(':id')
  async updatePost(
    @Request() req,
    @Param('id') id: string,
    @Body() updatePostDto: UpdatePostDto,
  ) {
    return this.postsService.updatePost(id, req.user.id, updatePostDto.caption);
  }

  @Delete('comments/:id')
  async deleteComment(@Request() req, @Param('id') id: string) {
    return this.postsService.deleteComment(id, req.user.id);
  }

  @Get('tagged/:id')
  async getTaggedPosts(@Param('id') id: string) {
    return this.postsService.getTaggedPosts(id);
  }

  @Post(':id/save')
  async toggleSave(@Request() req, @Param('id') id: string) {
    return this.postsService.toggleSave(id, req.user.id);
  }

  @Post('comments/:id/like')
  async toggleCommentLike(@Request() req, @Param('id') id: string) {
    return this.postsService.toggleCommentLike(id, req.user.id);
  }

  @Post(':id/repost')
  async repostPost(@Request() req, @Param('id') id: string, @Body('caption') caption?: string) {
    return this.postsService.repostPost(id, req.user.id, caption);
  }

  @Get('hashtag/:tag')
  async getPostsByHashtag(
    @Param('tag') tag: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.postsService.getPostsByHashtag(tag, parseInt(page, 10), parseInt(limit, 10));
  }

  @Patch(':id/pin')
  async togglePin(@Request() req, @Param('id') id: string) {
    return this.postsService.togglePin(id, req.user.id);
  }

  @Get('explore')
  async getExploreFeed(
    @Request() req,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.postsService.getExploreFeed(req.user.id, parseInt(page, 10), parseInt(limit, 10));
  }

  @Get('search')
  async searchPosts(
    @Request() req,
    @Query('q') query: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.postsService.searchPosts(query || '', req.user.id, parseInt(page, 10), parseInt(limit, 10));
  }

  @Post(':id/view')
  async incrementViews(@Request() req, @Param('id') id: string) {
    return this.postsService.incrementViews(id, req.user.id);
  }

  @Get(':id/analytics')
  async getPostAnalytics(@Request() req, @Param('id') id: string) {
    return this.postsService.getPostAnalytics(id, req.user.id);
  }
}
