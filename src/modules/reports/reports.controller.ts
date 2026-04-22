import { Controller, Post, Get, Patch, Param, Body, UseGuards, Request, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateReportDto } from './dto/report.dto';
import { Throttle } from '@nestjs/throttler';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Throttle({ default: { limit: 10, ttl: 3600000 } }) // 10 per hour
  @Post()
  async reportContent(
    @Request() req,
    @Body() createReportDto: CreateReportDto,
  ) {
    return this.reportsService.createReport({
      reporterId: req.user.id,
      ...createReportDto
    });
  }

  @Roles('admin')
  @Get('admin')
  async getAllReports(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('status') status?: string,
  ) {
    return this.reportsService.getAllReports(parseInt(page, 10), parseInt(limit, 10), status);
  }

  @Roles('admin')
  @Patch('admin/:id/resolve')
  async resolveReport(
    @Param('id') id: string,
    @Body() resolution: { status: string; adminNotes?: string; resolutionAction?: string },
  ) {
    return this.reportsService.resolveReport(id, resolution);
  }
}
