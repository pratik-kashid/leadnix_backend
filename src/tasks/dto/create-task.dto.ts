import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTaskDto {
  @ApiProperty({ example: 'a2f8b6d4-1f1c-4b7d-9d1e-2f2c7a7b1234' })
  @IsString()
  @IsNotEmpty()
  leadId: string;

  @ApiPropertyOptional({ example: '7c4c3c6d-5c4c-4e6f-bf4b-13b5e7a7a111' })
  @IsOptional()
  @IsString()
  assignedToUserId?: string;

  @ApiProperty({ example: 'Call lead and confirm demo time' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 'Follow up after the product demo.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '2026-03-25T09:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  dueAt?: string;
}
