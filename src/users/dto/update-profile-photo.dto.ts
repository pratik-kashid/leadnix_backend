import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUrl } from 'class-validator';

export class UpdateProfilePhotoDto {
  @ApiProperty({ example: 'https://cdn.leadnix.com/users/avatar.png', required: false, nullable: true })
  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'profilePhotoUrl must be a valid URL.' })
  profilePhotoUrl?: string | null;
}
