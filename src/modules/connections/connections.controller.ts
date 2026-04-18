import { Controller, Post, Delete, Param, UseGuards, Request } from '@nestjs/common';
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

  @Delete('unfollow/:id')
  async unfollow(@Request() req, @Param('id') id: string) {
    return this.connectionsService.unfollowUser(req.user.id, id);
  }
}
