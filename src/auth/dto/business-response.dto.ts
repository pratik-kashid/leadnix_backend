import { ApiProperty } from '@nestjs/swagger';

export class BusinessResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false, nullable: true })
  phone: string | null;

  @ApiProperty({ required: false, nullable: true })
  email: string | null;

  @ApiProperty({ required: false, nullable: true })
  industry: string | null;

  @ApiProperty({ required: false, nullable: true })
  timezone: string | null;

  @ApiProperty({ required: false, nullable: true })
  publicLeadToken: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
