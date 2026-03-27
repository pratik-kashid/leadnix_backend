import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomInt } from 'crypto';
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
import { GoogleAuthDto } from './dto/google-auth.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { MeResponseDto } from './dto/me-response.dto';
import { JwtPayload } from './types/jwt-payload.type';
import { User } from '../users/entities/user.entity';
import { Business } from '../businesses/entities/business.entity';
import { OAuth2Client } from 'google-auth-library';

const PASSWORD_RESET_OTP_EXPIRY_MINUTES = 10;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly businessesService: BusinessesService,
    private readonly teamMembersService: TeamMembersService,
    private readonly emailService: EmailService,
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
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

  async googleAuth(dto: GoogleAuthDto): Promise<AuthResponseDto> {
    const payload = await this.verifyGoogleIdToken(dto.idToken);
    const email = payload.email?.trim().toLowerCase();
    if (!email) {
      throw new UnauthorizedException('Google account email is missing');
    }

    if (payload.email_verified !== true) {
      throw new UnauthorizedException('Google email is not verified');
    }

    const profileName = payload.name?.trim() || email;
    const profilePhotoUrl = typeof payload.picture === 'string' && payload.picture.trim().length > 0
      ? payload.picture.trim()
      : null;

    const result = await this.dataSource.transaction(async (manager) => {
      let user = await this.usersService.findByEmail(email, manager);
      let business: Business | null = null;

      if (user) {
        if (!user.isActive) {
          throw new ForbiddenException('Account is inactive');
        }

        if (!user.name?.trim() && profileName) {
          user.name = profileName;
        }
        if (!user.profilePhotoUrl && profilePhotoUrl) {
          user.profilePhotoUrl = profilePhotoUrl;
        }
        await this.usersService.save(user, manager);

        let membership = await this.teamMembersService.findFirstForUser(user.id, manager);
        if (membership?.business) {
          business = membership.business;
        } else {
          business = await this.createGoogleBusinessAndMembership(user, profileName, manager);
        }
      } else {
        user = await this.usersService.create(
          {
            name: profileName,
            email,
            passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 12),
            isActive: true,
          },
          manager,
        );

        if (profilePhotoUrl) {
          user.profilePhotoUrl = profilePhotoUrl;
          await this.usersService.save(user, manager);
        }

        business = await this.createGoogleBusinessAndMembership(user, profileName, manager);
      }

      if (!business) {
        throw new UnauthorizedException('Unable to create or locate a business for this Google account');
      }

      return { user, business };
    });

    return this.buildAuthResponse(result.user, result.business);
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    this.logger.log(`forgot-password received for ${dto.email}`);
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      this.logger.warn(`forgot-password email not registered: ${dto.email}`);
      throw new NotFoundException('Email not registered');
    }

    const now = Date.now();
    const lastSentAt = user.passwordResetOtpSentAt?.getTime() ?? 0;
    if (now - lastSentAt < 60 * 1000 && user.passwordResetOtpExpiresAt && user.passwordResetOtpExpiresAt.getTime() > now) {
      this.logger.log(`forgot-password throttled for ${dto.email}; reusing existing valid OTP window`);
      return { message: 'OTP sent successfully' };
    }

    const otp = this.generateOtp();
    this.logger.log(`forgot-password generated OTP for ${dto.email}`);
    user.passwordResetOtpHash = this.hashToken(otp);
    user.passwordResetOtpExpiresAt = new Date(now + PASSWORD_RESET_OTP_EXPIRY_MINUTES * 60 * 1000);
    user.passwordResetOtpAttempts = 0;
    user.passwordResetOtpSentAt = new Date(now);
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    await this.usersService.save(user);

    try {
      await this.emailService.sendPasswordResetOtp({
        email: user.email,
        otp,
        name: user.name,
        expiresInMinutes: PASSWORD_RESET_OTP_EXPIRY_MINUTES,
      });
      this.logger.log(`forgot-password OTP email sent successfully to ${dto.email}`);
    } catch (error) {
      this.logger.error(
        `forgot-password OTP email failed for ${dto.email}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }

    return { message: 'OTP sent successfully' };
  }

  async verifyResetOtp(dto: VerifyResetOtpDto): Promise<{ valid: boolean; message: string }> {
    this.logger.log(`verify-reset-otp received for ${dto.email}`);
    const user = await this.usersService.findByEmail(dto.email);
    this.logger.log(`verify-reset-otp user ${user ? 'found' : 'not found'} for ${dto.email}`);
    if (!user || !user.isActive) {
      this.logger.warn(`verify-reset-otp invalid user state for ${dto.email}`);
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    const validation = this.validateResetOtp(user, dto.otp);
    this.logger.log(
      `verify-reset-otp result for ${dto.email}: expired=${!user.passwordResetOtpExpiresAt || user.passwordResetOtpExpiresAt.getTime() < Date.now()} matched=${validation.valid}`,
    );
    if (!validation.valid) {
      if (validation.shouldPersist) {
        await this.usersService.save(user);
      }
      this.logger.warn(`verify-reset-otp invalid or expired for ${dto.email}`);
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    this.logger.log(`verify-reset-otp final response valid for ${dto.email}`);
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

  private async verifyGoogleIdToken(idToken: string) {
    const clientIds = this.getGoogleClientIds();
    if (clientIds.length === 0) {
      throw new UnauthorizedException('Google sign-in is not configured');
    }

    try {
      const client = new OAuth2Client();
      const ticket = await client.verifyIdToken({
        idToken,
        audience: clientIds,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new UnauthorizedException('Invalid Google token');
      }

      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid Google token');
    }
  }

  private getGoogleClientIds(): string[] {
    const raw = [
      this.configService.get<string>('GOOGLE_WEB_CLIENT_ID'),
      this.configService.get<string>('GOOGLE_SIGN_IN_SERVER_CLIENT_ID'),
      this.configService.get<string>('GOOGLE_CLIENT_IDS'),
    ]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .flatMap((value) => value.split(','))
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    return [...new Set(raw)];
  }

  private async createGoogleBusinessAndMembership(
    user: User,
    profileName: string,
    manager: EntityManager,
  ): Promise<Business> {
    const business = await this.businessesService.create(
      {
        name: profileName ? `${profileName}'s Workspace` : 'Leadnix Workspace',
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

    return business;
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
