import { Controller, Post, Get, Body, Param, Query, UseGuards, UseInterceptors, UploadedFiles, Request } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { PostsService } from './posts.service';
import { JwtAuthGuard } from '../../common/guards/auth.guard';
import 'multer';

@Controller('posts')
@UseGuards(JwtAuthGuard)
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post('create')
  @UseInterceptors(FilesInterceptor('media', 10)) // Allow up to 10 files
  async createPost(
    @Request() req,
    @Body('caption') caption: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.postsService.createPost(req.user.id, caption, files);
  }

  @Get('feed')
  async getFeed(
    @Request() req,
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    return this.postsService.getFeed(req.user.id, page ? parseInt(page, 10) : 1, limit ? parseInt(limit, 10) : 10);
  }

  @Get('user/:id')
  async getUserPosts(@Param('id') id: string) {
    return this.postsService.getUserPosts(id);
  }
}
