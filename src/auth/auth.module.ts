import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { Token } from './token.entity';
import { TokenService } from './token.service';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AdminGuard } from './guards/admin.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Token]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_ACCESS_TTL', '15m'),
        },
      }),
    }),
    SubscriptionsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService, JwtStrategy, AdminGuard],
  exports: [AuthService, JwtStrategy, PassportModule],
})
export class AuthModule {}
