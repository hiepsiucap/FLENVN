import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserRanksController } from './user-ranks.controller';
import { UserRanksService } from './user-ranks.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController, UserRanksController],
  providers: [UsersService, UserRanksService],
  exports: [UsersService],
})
export class UsersModule {}
