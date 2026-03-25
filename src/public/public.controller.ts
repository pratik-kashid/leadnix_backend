import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PublicService } from './public.service';
import { CreateWebLeadDto } from './dto/create-web-lead.dto';

@ApiTags('public')
@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Post('leads/web-form')
  @ApiBody({ type: CreateWebLeadDto })
  @ApiOkResponse()
  createWebLead(@Body() dto: CreateWebLeadDto): Promise<{ leadId: string; conversationId: string }> {
    return this.publicService.createWebLead(dto);
  }
}
