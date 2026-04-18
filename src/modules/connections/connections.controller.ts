import { Controller, Post, Get, Delete, Param, UseGuards, Request } from '@nestjs/common';
import { ConnectionsService } from './connections.service';
import { JwtAuthGuard } from '../../common/guards/auth.guard';

@Controller('connections')
@UseGuards(JwtAuthGuard)
export class ConnectionsController {
  constructor(private readonly connectionsService: ConnectionsService) {}

  @Post('follow/:id')
  async follow(@Request() req, @Param('id') id: string) {
    return this.connectionsService.followUser(req.user.id, id);
  }

  @Post('accept/:id')
  async accept(@Request() req, @Param('id') id: string) {
    return this.connectionsService.acceptUser(req.user.id, id);
  }

  @Post('decline/:id')
  async decline(@Request() req, @Param('id') id: string) {
    return this.connectionsService.declineUser(req.user.id, id);
  }

  @Get('requests')
  async getRequests(@Request() req) {
    return this.connectionsService.getPendingRequests(req.user.id);
  }

  @Delete('unfollow/:id')
  async unfollow(@Request() req, @Param('id') id: string) {
    return this.connectionsService.unfollowUser(req.user.id, id);
  }

  @Get('followers/:id')
  async getFollowers(@Request() req, @Param('id') id: string) {
    const userId = id === 'me' ? req.user.id : id;
    return this.connectionsService.getFollowers(userId);
  }

  @Get('following/:id')
  async getFollowing(@Request() req, @Param('id') id: string) {
    const userId = id === 'me' ? req.user.id : id;
    return this.connectionsService.getFollowing(userId);
  }
}
