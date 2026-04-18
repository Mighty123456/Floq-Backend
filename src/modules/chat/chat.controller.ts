import { Controller, Get, Param, UseGuards, Request, Query } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../../common/guards/auth.guard';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

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
}
