import { Module } from '@nestjs/common';
import { ShadowingController } from './shadowing.controller';
import { ShadowingService } from './shadowing.service';
import { SupadataTranscriptService } from './supadata-transcript.service';

@Module({
  controllers: [ShadowingController],
  providers: [ShadowingService, SupadataTranscriptService],
})
export class ShadowingModule {}
