import { Module } from '@nestjs/common';
import { ShadowingController } from './shadowing.controller';
import { ShadowingService } from './shadowing.service';

@Module({
  controllers: [ShadowingController],
  providers: [ShadowingService],
})
export class ShadowingModule {}
