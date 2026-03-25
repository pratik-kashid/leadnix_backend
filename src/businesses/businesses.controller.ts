import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { BusinessesService } from './businesses.service';
import { BusinessResponseDto } from '../auth/dto/business-response.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';

@ApiTags('businesses')
@Controller('businesses')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Get('me')
  @ApiOkResponse({ type: BusinessResponseDto })
  getMe(@CurrentUser() user: JwtPayload): Promise<BusinessResponseDto> {
    return this.businessesService.getMyBusiness(user.sub, user.businessId ?? undefined).then((business) => this.toResponse(business));
  }

  @Patch('me')
  @ApiBody({ type: UpdateBusinessDto })
  @ApiOkResponse({ type: BusinessResponseDto })
  updateMe(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateBusinessDto,
  ): Promise<BusinessResponseDto> {
    return this.businessesService.updateMyBusiness(user.sub, dto, user.businessId ?? undefined).then((business) => this.toResponse(business));
  }

  private toResponse(business: { id: string; name: string; phone: string | null; email: string | null; industry: string | null; timezone: string | null; publicLeadToken: string | null; createdAt: Date; updatedAt: Date; }): BusinessResponseDto {
    return {
      id: business.id,
      name: business.name,
      phone: business.phone,
      email: business.email,
      industry: business.industry,
      timezone: business.timezone,
      publicLeadToken: business.publicLeadToken,
      createdAt: business.createdAt,
      updatedAt: business.updatedAt,
    };
  }
}
