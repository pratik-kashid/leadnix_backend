import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class MockWhatsappConnectDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  phoneNumberId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  wabaId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  displayLabel: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accessToken?: string;
}
