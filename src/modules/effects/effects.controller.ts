import { Controller, Get } from '@nestjs/common';
import { EffectsService } from './effects.service';

@Controller('effects')
export class EffectsController {
  constructor(private readonly effectsService: EffectsService) {}

  @Get()
  getAllEffects() {
    return {
      success: true,
      data: this.effectsService.getAllEffects(),
    };
  }

  @Get('filters')
  getFilters() {
    return {
      success: true,
      data: this.effectsService.getFilters(),
    };
  }

  @Get('overlays')
  getOverlays() {
    return {
      success: true,
      data: this.effectsService.getOverlays(),
    };
  }
}
