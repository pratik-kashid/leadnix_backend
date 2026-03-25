import { ApiProperty } from '@nestjs/swagger';
import { BusinessResponseDto } from './business-response.dto';
import { UserResponseDto } from './user-response.dto';

export class MeResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;

  @ApiProperty({ type: BusinessResponseDto })
  activeBusiness: BusinessResponseDto;
}
