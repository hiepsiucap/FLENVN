import { Module } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { ManagedImageService } from './managed-image.service';

@Module({
  controllers: [UploadsController],
  providers: [UploadsService, ManagedImageService, AppConfigService],
  exports: [UploadsService, ManagedImageService],
})
export class UploadsModule {}
