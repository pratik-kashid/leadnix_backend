import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';
import { WhatsAppOauthCallbackResponseDto } from './dto/whatsapp-oauth-callback-response.dto';

@ApiTags('integrations')
@Controller('integrations/whatsapp/oauth')
export class WhatsAppOauthController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get('callback')
  @ApiOperation({
    summary: 'Handle Meta WhatsApp Embedded Signup callback',
    description:
      'Parses Meta Login for Business or Embedded Signup redirect parameters and prepares a business completion payload.',
  })
  @ApiOkResponse({ type: WhatsAppOauthCallbackResponseDto })
  callback(@Query() query: Record<string, unknown>): Promise<WhatsAppOauthCallbackResponseDto> {
    return this.integrationsService.prepareWhatsAppOauthCallback(query);
  }
}
