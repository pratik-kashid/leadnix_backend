import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class WhatsappConnectDto {
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

  @ApiProperty({ description: 'Temporary development token used for WhatsApp Cloud API testing.' })
  @IsString()
  @IsNotEmpty()
  accessToken: string;
}

export class MockWhatsappConnectDto extends WhatsappConnectDto {}
