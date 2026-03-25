import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Aarav Sharma' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'aarav@leadnix.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'StrongPassword123!' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Leadnix India' })
  @IsString()
  @IsNotEmpty()
  businessName: string;
}
