import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { TeamMembersModule } from '../team-members/team-members.module';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService): JwtModuleOptions => ({
        secret: configService.get<string>('JWT_SECRET') ?? 'leadnix-jwt-secret',
        signOptions: {
          expiresIn: (configService.get<string>('JWT_EXPIRES_IN') ?? 60 * 60 * 24 * 7) as never,
        },
      }),
    }),
    UsersModule,
    BusinessesModule,
    TeamMembersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
