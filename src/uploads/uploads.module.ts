import { Module } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  controllers: [UploadsController],
  providers: [UploadsService, AppConfigService],
  exports: [UploadsService],
})
export class UploadsModule {}
