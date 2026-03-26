import { Body, Controller, Get, HttpCode, Post, Query, Res } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { WhatsappWebhookService } from './whatsapp-webhook.service';

@ApiTags('webhooks')
@Controller('webhooks/whatsapp')
export class WebhooksController {
  constructor(private readonly whatsappWebhookService: WhatsappWebhookService) {}

  @Get()
  @ApiOperation({
    summary: 'Verify the WhatsApp webhook endpoint',
    description: 'Compatible with Meta webhook verification challenge.',
  })
  @ApiQuery({ name: 'hub.mode', required: true, example: 'subscribe' })
  @ApiQuery({ name: 'hub.verify_token', required: true })
  @ApiQuery({ name: 'hub.challenge', required: true })
  @ApiOkResponse({ schema: { type: 'string' } })
  async verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const verifiedChallenge = await this.whatsappWebhookService.verifyWebhook(mode, verifyToken, challenge);
    res.type('text/plain');
    return verifiedChallenge;
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Receive WhatsApp webhook events',
    description: 'Accepts WhatsApp Cloud API webhook payloads and returns a clean success response.',
  })
  @ApiBody({ schema: { type: 'object', additionalProperties: true } })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
      },
    },
  })
  async receiveWebhook(@Body() payload: unknown, @Res({ passthrough: true }) res: Response): Promise<{ success: true }> {
    res.type('application/json');
    return this.whatsappWebhookService.handleWebhook(payload);
  }
}
