import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShadowingController } from './shadowing.controller';
import { ShadowingService } from './shadowing.service';
import { ShadowingVideoMetadata } from './shadowing-video-metadata.entity';
import { ShadowingRecentVideo } from './shadowing-recent-video.entity';
import { SupadataTranscriptService } from './supadata-transcript.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ShadowingVideoMetadata, ShadowingRecentVideo]),
  ],
  controllers: [ShadowingController],
  providers: [ShadowingService, SupadataTranscriptService],
})
export class ShadowingModule {}
