import { 
  Controller, Post, Get, Body, Param, UseGuards, 
  Request, UploadedFiles, UseInterceptors, Query 
} from '@nestjs/common';
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
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.postsService.getFeed(req.user.id, parseInt(page, 10), parseInt(limit, 10));
  }

  @Post(':id/like')
  async toggleLike(@Request() req, @Param('id') id: string) {
    return this.postsService.toggleLike(id, req.user.id);
  }

  @Post(':id/comment')
  async addComment(
    @Request() req,
    @Param('id') id: string,
    @Body('text') text: string,
  ) {
    return this.postsService.addComment(id, req.user.id, text);
  }

  @Get(':id/comments')
  async getComments(
    @Param('id') id: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.postsService.getComments(id, parseInt(page, 10), parseInt(limit, 10));
  }

  @Get('user/:id')
  async getUserPosts(@Param('id') id: string) {
    return this.postsService.getUserPosts(id);
  }

  @Post(':id/save')
  async toggleSave(@Request() req, @Param('id') id: string) {
    return this.postsService.toggleSave(id, req.user.id);
  }
}
