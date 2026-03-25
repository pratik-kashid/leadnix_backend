import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { UsersService } from '../users/users.service';
import { BusinessesService } from '../businesses/businesses.service';
import { TeamMembersService } from '../team-members/team-members.service';
import { Role } from '../common/enums/role.enum';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { MeResponseDto } from './dto/me-response.dto';
import { JwtPayload } from './types/jwt-payload.type';
import { User } from '../users/entities/user.entity';
import { Business } from '../businesses/entities/business.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly businessesService: BusinessesService,
    private readonly teamMembersService: TeamMembersService,
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 12);

    const { user, business } = await this.dataSource.transaction(async (manager) => {
      const user = await this.usersService.create(
        {
          name: registerDto.name,
          email: registerDto.email,
          passwordHash: hashedPassword,
          isActive: true,
        },
        manager,
      );

      const business = await this.businessesService.create(
        {
          name: registerDto.businessName,
          phone: null,
          email: null,
          industry: null,
          timezone: null,
        },
        manager,
      );

      await this.teamMembersService.create(
        {
          userId: user.id,
          businessId: business.id,
          role: Role.OWNER,
        },
        manager,
      );

      return { user, business };
    });

    return this.buildAuthResponse(user, business);
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Account is inactive');
    }

    const passwordMatches = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const membership = await this.teamMembersService.findFirstForUser(user.id);
    if (!membership?.business) {
      throw new UnauthorizedException('User does not belong to an active business');
    }

    return this.buildAuthResponse(user, membership.business);
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string; resetToken?: string }> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.isActive) {
      return {
        message: 'If the email exists, a reset token was generated.',
      };
    }

    const resetToken = randomBytes(32).toString('hex');
    user.passwordResetTokenHash = this.hashToken(resetToken);
    user.passwordResetExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await this.usersService.save(user);

    return {
      message: 'If the email exists, a reset token was generated.',
      resetToken: process.env.NODE_ENV === 'production' ? undefined : resetToken,
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const tokenHash = this.hashToken(dto.token);
    const user = await this.usersService.findByResetTokenHash(tokenHash);

    if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    user.passwordHash = await bcrypt.hash(dto.newPassword, 12);
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    await this.usersService.save(user);

    return { message: 'Password reset successful' };
  }

  async me(payload: JwtPayload): Promise<MeResponseDto> {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    let membership = payload.businessId
      ? await this.teamMembersService.findByUserIdAndBusinessId(payload.sub, payload.businessId)
      : null;

    if (!membership) {
      membership = await this.teamMembersService.findFirstForUser(payload.sub);
    }

    if (!membership?.business) {
      throw new UnauthorizedException('User does not belong to an active business');
    }

    return {
      user: this.toPublicUser(user),
      activeBusiness: this.toPublicBusiness(membership.business),
    };
  }

  private async buildAuthResponse(user: User, business: Business): Promise<AuthResponseDto> {
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      businessId: business.id,
    });

    return {
      accessToken,
      user: this.toPublicUser(user),
      activeBusiness: this.toPublicBusiness(business),
    };
  }

  private toPublicUser(user: User) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private toPublicBusiness(business: Business) {
    return {
      id: business.id,
      name: business.name,
      phone: business.phone,
      email: business.email,
      industry: business.industry,
      timezone: business.timezone,
      publicLeadToken: business.publicLeadToken,
      createdAt: business.createdAt,
      updatedAt: business.updatedAt,
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
