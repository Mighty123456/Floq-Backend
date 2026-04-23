import { Module } from '@nestjs/common';
import { EffectsController } from './effects.controller';
import { EffectsService } from './effects.service';

@Module({
  controllers: [EffectsController],
  providers: [EffectsService],
  exports: [EffectsService],
})
export class EffectsModule {}
