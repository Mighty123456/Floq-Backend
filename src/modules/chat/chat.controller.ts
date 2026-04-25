import { 
  Controller, Get, Post, Param, UseGuards, 
  Request, Query, UseInterceptors, UploadedFile, Patch, Body 
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../../common/guards/auth.guard';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly cloudinaryService: CloudinaryService
  ) {}

  @Post('media')
  @UseInterceptors(FileInterceptor('file'))
  async uploadMedia(@Request() req, @UploadedFile() file: Express.Multer.File) {
    const result = await this.cloudinaryService.uploadImage(file, `floq_chat/user_${req.user.id}`);
    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      type: file.mimetype.startsWith('video') ? 'video' : 'image',
    };
  }

  @Get('history/:otherUserId')
  async getChatHistory(
    @Request() req,
    @Param('otherUserId') otherUserId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.chatService.getMessages(req.user.id, otherUserId, parseInt(page, 10), parseInt(limit, 10));
  }

  @Get('conversations')
  async getRecentConversations(@Request() req) {
    return this.chatService.getRecentConversations(req.user.id);
  }

  @Post('spam/:userId')
  async markAsSpam(@Request() req, @Param('userId') targetId: string) {
    return this.chatService.markAsSpam(req.user.id, targetId);
  }

  @Post('unspam/:userId')
  async unmarkAsSpam(@Request() req, @Param('userId') targetId: string) {
    return this.chatService.unmarkAsSpam(req.user.id, targetId);
  }

  // --- GROUP ROUTES ---

  @Get('group/:id')
  async getGroupDetails(@Param('id') id: string) {
    return this.chatService.getGroupDetails(id);
  }

  @Patch('group/:id')
  async updateGroup(
    @Request() req,
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return this.chatService.updateGroup(id, req.user.id, data);
  }

  @Get('group/:id/messages')
  async getGroupMessages(
    @Param('id') id: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.chatService.getGroupMessages(id, parseInt(page, 10), parseInt(limit, 10));
  }

  @Get('trending/groups')
  async getTrendingGroups() {
    return this.chatService.getTrendingGroups();
  }

  @Post('share-post')
  async sharePost(
    @Request() req,
    @Body('postId') postId: string,
    @Body('receiverId') receiverId?: string,
    @Body('groupId') groupId?: string,
  ) {
    return this.chatService.sharePost(req.user.id, postId, receiverId, groupId);
  }
}

