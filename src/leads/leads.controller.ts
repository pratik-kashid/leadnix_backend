import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { LeadsService } from './leads.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { CreateLeadDto } from './dto/create-lead.dto';
import { QueryLeadsDto } from './dto/query-leads.dto';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';
import { LeadResponseDto } from './dto/lead-response.dto';
import { PaginatedLeadsResponseDto } from './dto/paginated-leads-response.dto';

@ApiTags('leads')
@Controller('leads')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post()
  @ApiBody({ type: CreateLeadDto })
  @ApiCreatedResponse({ type: LeadResponseDto })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateLeadDto): Promise<LeadResponseDto> {
    return this.leadsService.create(user.sub, dto);
  }

  @Get()
  @ApiOkResponse({ type: PaginatedLeadsResponseDto })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: QueryLeadsDto): Promise<PaginatedLeadsResponseDto> {
    return this.leadsService.findAll(user.sub, query);
  }

  @Get(':id')
  @ApiOkResponse({ type: LeadResponseDto })
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string): Promise<LeadResponseDto> {
    return this.leadsService.findOne(user.sub, id);
  }

  @Patch(':id/status')
  @ApiBody({ type: UpdateLeadStatusDto })
  @ApiOkResponse({ type: LeadResponseDto })
  updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateLeadStatusDto,
  ): Promise<LeadResponseDto> {
    return this.leadsService.updateStatus(user.sub, id, dto);
  }
}
