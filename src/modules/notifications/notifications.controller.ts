import { Controller, Get, Post, Patch, Param, UseGuards, Request, Query, Delete } from '@nestjs/common';
import { NotificationService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async getNotifications(
    @Request() req,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.notificationService.getNotifications(req.user.id, parseInt(page, 10), parseInt(limit, 10));
  }

  @Patch('read-all')
  async markAsRead(@Request() req) {
    await this.notificationService.markAsRead(req.user.id);
    return { success: true };
  }

  @Patch(':id/read')
  async markOneAsRead(@Request() req, @Param('id') id: string) {
    return this.notificationService.markOneAsRead(req.user.id, id);
  }

  @Get('unread-count')
  async getUnreadCount(@Request() req) {
    return this.notificationService.getUnreadCount(req.user.id);
  }

  @Delete('clear-all')
  async clearAll(@Request() req) {
    await this.notificationService.clearAll(req.user.id);
    return { success: true };
  }

  @Delete(':id')
  async deleteNotification(@Request() req, @Param('id') id: string) {
    await this.notificationService.deleteNotification(req.user.id, id);
    return { success: true };
  }
}
