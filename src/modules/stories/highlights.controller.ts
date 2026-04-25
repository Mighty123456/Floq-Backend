import { 
  Controller, Post, Get, Body, Param, UseGuards, 
  Request, Delete, Patch 
} from '@nestjs/common';
import { HighlightsService } from './highlights.service';
import { JwtAuthGuard } from '../../common/guards/auth.guard';

@Controller('highlights')
@UseGuards(JwtAuthGuard)
export class HighlightsController {
  constructor(private readonly highlightsService: HighlightsService) {}

  @Post()
  async createHighlight(
    @Request() req,
    @Body('name') name: string,
    @Body('stories') stories: string[],
    @Body('coverUrl') coverUrl?: string,
  ) {
    return this.highlightsService.createHighlight(req.user.id, name, stories, coverUrl);
  }

  @Get('user/:id')
  async getUserHighlights(@Param('id') id: string) {
    return this.highlightsService.getUserHighlights(id);
  }

  @Get('archive')
  async getArchivedStories(@Request() req) {
    return this.highlightsService.getArchivedStories(req.user.id);
  }

  @Patch(':id')
  async updateHighlight(
    @Request() req,
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return this.highlightsService.updateHighlight(id, req.user.id, data);
  }

  @Delete(':id')
  async deleteHighlight(@Request() req, @Param('id') id: string) {
    return this.highlightsService.deleteHighlight(id, req.user.id);
  }
}
