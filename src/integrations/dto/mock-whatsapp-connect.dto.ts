import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class WhatsAppConnectionBaseDto {
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
}

export class WhatsappConnectDto extends WhatsAppConnectionBaseDto {
  @ApiProperty({ description: 'Temporary development token used for WhatsApp Cloud API testing.' })
  @IsString()
  @IsNotEmpty()
  accessToken: string;
}

export class MockWhatsappConnectDto extends WhatsappConnectDto {}

export class CompleteWhatsappConnectDto extends WhatsAppConnectionBaseDto {
  @ApiPropertyOptional({
    description: 'Optional token if the onboarding provider returns one to the backend.',
  })
  @IsOptional()
  @IsString()
  accessToken?: string;

  @ApiPropertyOptional({ example: 'Leadnix Sales WhatsApp' })
  @IsOptional()
  @IsString()
  businessAccountName?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Additional onboarding metadata from Meta Embedded Signup.',
  })
  @IsOptional()
  @IsObject()
  configJson?: Record<string, unknown>;
}
