import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { MusicService } from './music.service';
import { JwtAuthGuard } from '../../common/guards/auth.guard';

@Controller('music')
@UseGuards(JwtAuthGuard)
export class MusicController {
  constructor(private readonly musicService: MusicService) {}

  @Get('trending')
  async getTrending(@Query('q') query?: string) {
    return await this.musicService.findAll(query);
  }
}
