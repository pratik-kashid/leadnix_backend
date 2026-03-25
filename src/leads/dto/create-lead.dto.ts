import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { LeadPriority } from '../../common/enums/lead-priority.enum';

export class CreateLeadDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  contactName: string;

  @ApiPropertyOptional({ example: '+91 98765 43210' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ example: 'john@acme.com' })
  @IsOptional()
  @IsString()
  contactEmail?: string;

  @ApiPropertyOptional({ example: '@johndoe' })
  @IsOptional()
  @IsString()
  socialHandle?: string;

  @ApiPropertyOptional({ example: 'website' })
  @IsOptional()
  @IsString()
  contactSource?: string;

  @ApiProperty({ example: 'Demo request from website' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'website' })
  @IsString()
  @IsNotEmpty()
  source: string;

  @ApiPropertyOptional({ enum: LeadPriority, example: LeadPriority.MEDIUM })
  @IsOptional()
  @IsEnum(LeadPriority)
  priority?: LeadPriority;

  @ApiPropertyOptional({ example: 'Needs follow-up after demo.' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: '7c4c3c6d-5c4c-4e6f-bf4b-13b5e7a7a111' })
  @IsOptional()
  @IsString()
  assignedToUserId?: string;

  @ApiPropertyOptional({ example: '2026-03-23T09:30:00.000Z' })
  @IsOptional()
  @IsDateString()
  lastMessageAt?: string;
}
