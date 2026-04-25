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

  @Throttle({ default: { limit: 100, ttl: 86400000 } }) // 100 per day
  @Post('upload')
  @UseInterceptors(FileInterceptor('media', multerOptions))
  async uploadStory(
    @Request() req, 
    @UploadedFile() file: Express.Multer.File, 
    @Body('caption') caption?: string,
    @Body('location') locationStr?: string,
    @Body('metadata') metadataStr?: string,
    @Body('isCloseFriendsOnly') isCloseFriendsOnly: string = 'false',
  ) {
    if (!file) throw new BadRequestException('Story media file is required');
    const location = locationStr ? JSON.parse(locationStr) : undefined;
    const metadata = metadataStr ? JSON.parse(metadataStr) : undefined;
    const isCloseFriend = isCloseFriendsOnly === 'true';
    return this.storiesService.createStory(req.user.id, file, caption, location, metadata, isCloseFriend);
  }

  @Post(':id/react')
  async reactToStory(
    @Request() req,
    @Param('id') id: string,
    @Body('emoji') emoji: string,
  ) {
    return this.storiesService.reactToStory(id, req.user.id, emoji);
  }

  @Post(':id/reply')
  async replyToStory(
    @Request() req,
    @Param('id') id: string,
    @Body('content') content: string,
  ) {
    return this.storiesService.replyToStory(id, req.user.id, content);
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
