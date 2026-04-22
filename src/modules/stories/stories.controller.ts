import { 
  Controller, Post, Get, Delete, Param, UseGuards, 
  Request, UploadedFile, UseInterceptors, BadRequestException, Body
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StoriesService } from './stories.service';
import { JwtAuthGuard } from '../../common/guards/auth.guard';
import { multerOptions } from '../../common/utils/multer-options';
import { Throttle } from '@nestjs/throttler';

@Controller('stories')
@UseGuards(JwtAuthGuard)
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @Throttle({ default: { limit: 30, ttl: 86400000 } }) // 30 per day
  @Post('upload')
  @UseInterceptors(FileInterceptor('media', multerOptions))
  async uploadStory(@Request() req, @UploadedFile() file: Express.Multer.File, @Body('caption') caption?: string) {
    if (!file) throw new BadRequestException('Story media file is required');
    return this.storiesService.createStory(req.user.id, file, caption);
  }

  @Get('me')
  async getMyStories(@Request() req) {
    return this.storiesService.getMyStories(req.user.id);
  }

  @Get('feed')
  async getFeed(@Request() req) {
    return this.storiesService.getFeedStories(req.user.id);
  }

  @Post(':id/view')
  async markAsSeen(@Request() req, @Param('id') id: string) {
    return this.storiesService.markAsSeen(id, req.user.id);
  }

  @Delete(':id')
  async deleteStory(@Request() req, @Param('id') id: string) {
    return this.storiesService.deleteStory(id, req.user.id);
  }

  @Get(':id/viewers')
  async getViewers(@Request() req, @Param('id') id: string) {
    return this.storiesService.getViewers(id, req.user.id);
  }
}
