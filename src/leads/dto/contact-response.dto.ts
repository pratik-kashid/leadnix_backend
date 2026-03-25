import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ContactResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  businessId: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  phone: string | null;

  @ApiPropertyOptional({ nullable: true })
  email: string | null;

  @ApiPropertyOptional({ nullable: true })
  socialHandle: string | null;

  @ApiPropertyOptional({ nullable: true })
  source: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
