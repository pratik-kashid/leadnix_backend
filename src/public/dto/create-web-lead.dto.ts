import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateWebLeadDto {
  @ApiProperty()
  @IsString()
  businessToken: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty()
  @IsString()
  message: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  source: string;
}
