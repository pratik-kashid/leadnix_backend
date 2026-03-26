import { Body, Controller, Delete, Get, NotFoundException, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { UsersService } from './users.service';
import { UserResponseDto } from '../auth/dto/user-response.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateProfilePhotoDto } from './dto/update-profile-photo.dto';
import { User } from './entities/user.entity';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOkResponse({ type: UserResponseDto })
  async getMe(@CurrentUser() user: JwtPayload): Promise<UserResponseDto> {
    const currentUser = await this.usersService.findById(user.sub);
    return this.toResponse(currentUser);
  }

  @Patch('me')
  @ApiBody({ type: UpdateMeDto })
  @ApiOkResponse({ type: UserResponseDto })
  async updateMe(@CurrentUser() user: JwtPayload, @Body() dto: UpdateMeDto): Promise<UserResponseDto> {
    const currentUser = await this.usersService.findById(user.sub);
    return this.toResponse(await this.usersService.updateMe(currentUser, dto));
  }

  @Post('me/profile-photo')
  @ApiBody({ type: UpdateProfilePhotoDto })
  @ApiOkResponse({ type: UserResponseDto })
  async updateProfilePhoto(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfilePhotoDto,
  ): Promise<UserResponseDto> {
    const currentUser = await this.usersService.findById(user.sub);
    return this.toResponse(await this.usersService.updateProfilePhoto(currentUser, dto.profilePhotoUrl ?? null));
  }

  @Delete('me/profile-photo')
  @ApiOkResponse({ type: UserResponseDto })
  async deleteProfilePhoto(@CurrentUser() user: JwtPayload): Promise<UserResponseDto> {
    const currentUser = await this.usersService.findById(user.sub);
    return this.toResponse(await this.usersService.updateProfilePhoto(currentUser, null));
  }

  private toResponse(user: User | null): UserResponseDto {
    if (!user) {
      throw new NotFoundException('User not found');
    }

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
}
