import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource, QueryFailedError } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomInt } from 'crypto';
import { UsersService } from '../users/users.service';
import { BusinessesService } from '../businesses/businesses.service';
import { TeamMembersService } from '../team-members/team-members.service';
import { EmailService } from '../common/email/email.service';
import { Role } from '../common/enums/role.enum';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyResetOtpDto } from './dto/verify-reset-otp.dto';
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
    private readonly emailService: EmailService,
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 12);

    try {
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
    } catch (error) {
      if (this.isDuplicateEmailError(error)) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
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

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new NotFoundException('Email not registered');
    }

    const now = Date.now();
    const lastSentAt = user.passwordResetOtpSentAt?.getTime() ?? 0;
    if (now - lastSentAt < 60 * 1000 && user.passwordResetOtpExpiresAt && user.passwordResetOtpExpiresAt.getTime() > now) {
      return { message: 'OTP sent successfully' };
    }

    const otp = this.generateOtp();
    user.passwordResetOtpHash = this.hashToken(otp);
    user.passwordResetOtpExpiresAt = new Date(now + 10 * 60 * 1000);
    user.passwordResetOtpAttempts = 0;
    user.passwordResetOtpSentAt = new Date(now);
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    await this.usersService.save(user);

    await this.emailService.sendPasswordResetOtp({
      email: user.email,
      otp,
      name: user.name,
    });

    return { message: 'OTP sent successfully' };
  }

  async verifyResetOtp(dto: VerifyResetOtpDto): Promise<{ valid: boolean; message: string }> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.isActive) {
      return { valid: false, message: 'Invalid or expired OTP' };
    }

    const validation = this.validateResetOtp(user, dto.otp);
    if (!validation.valid) {
      if (validation.shouldPersist) {
        await this.usersService.save(user);
      }
      return { valid: false, message: 'Invalid or expired OTP' };
    }

    return { valid: true, message: 'OTP verified' };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    const validation = this.validateResetOtp(user, dto.otp);
    if (!validation.valid) {
      if (validation.shouldPersist) {
        await this.usersService.save(user);
      }
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    user.passwordHash = await bcrypt.hash(dto.newPassword, 12);
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    user.passwordResetOtpHash = null;
    user.passwordResetOtpExpiresAt = null;
    user.passwordResetOtpAttempts = 0;
    user.passwordResetOtpSentAt = null;
    await this.usersService.save(user);

    return { message: 'Password reset successful' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ message: string }> {
    const user = await this.usersService.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid current password');
    }

    const currentPasswordMatches = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!currentPasswordMatches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new ConflictException('New password must be different from the current password');
    }

    user.passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.usersService.save(user);

    return { message: 'Password changed successfully' };
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
      profilePhotoUrl: user.profilePhotoUrl,
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

  private generateOtp(): string {
    return randomInt(100000, 1000000).toString();
  }

  private validateResetOtp(
    user: User,
    otp: string,
  ): { valid: boolean; shouldPersist: boolean } {
    if (
      !user.passwordResetOtpHash ||
      !user.passwordResetOtpExpiresAt ||
      user.passwordResetOtpExpiresAt.getTime() < Date.now()
    ) {
      return {
        valid: false,
        shouldPersist: false,
      };
    }

    if (user.passwordResetOtpAttempts >= 5) {
      user.passwordResetOtpHash = null;
      user.passwordResetOtpExpiresAt = null;
      user.passwordResetOtpAttempts = 0;
      user.passwordResetOtpSentAt = null;
      return {
        valid: false,
        shouldPersist: true,
      };
    }

    const otpHash = this.hashToken(otp);
    if (otpHash !== user.passwordResetOtpHash) {
      user.passwordResetOtpAttempts += 1;
      if (user.passwordResetOtpAttempts >= 5) {
        user.passwordResetOtpHash = null;
        user.passwordResetOtpExpiresAt = null;
        user.passwordResetOtpSentAt = null;
      }
      return {
        valid: false,
        shouldPersist: true,
      };
    }

    return {
      valid: true,
      shouldPersist: false,
    };
  }

  private isDuplicateEmailError(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError = error.driverError as { code?: string; detail?: string; constraint?: string };
    if (driverError.code !== '23505') {
      return false;
    }

    const detail = driverError.detail?.toLowerCase() ?? '';
    const constraint = driverError.constraint?.toLowerCase() ?? '';
    return detail.includes('email') || constraint.includes('email');
  }
}
