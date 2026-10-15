import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ListWebhooksQueryDto } from '../dto/list-webhooks-query.dto.js';
import {
  WebhookAttemptResponseDto,
  WebhookDeliveryDetailDto,
  WebhookDeliveryListResponseDto,
} from '../dto/webhook-history-response.dto.js';
import { WebhookHistoryService } from '../services/webhook-history.service.js';

@ApiTags('Webhook History')
@Controller('webhooks')
export class WebhookHistoryController {
  constructor(private readonly history: WebhookHistoryService) {}

  @Get()
  @ApiOperation({ summary: 'List webhook deliveries' })
  @ApiQuery({ type: ListWebhooksQueryDto })
  @ApiOkResponse({ type: WebhookDeliveryListResponseDto })
  @ApiBadRequestResponse({
    description: 'The filters are invalid or the date range is reversed.',
  })
  list(@Query() query: ListWebhooksQueryDto) {
    return this.history.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a webhook delivery and its attempt history' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: WebhookDeliveryDetailDto })
  @ApiNotFoundResponse({ description: 'The webhook delivery does not exist.' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.history.get(id);
  }

  @Get(':id/deliveries')
  @ApiOperation({ summary: 'List HTTP attempts for a webhook delivery' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: [WebhookAttemptResponseDto] })
  @ApiNotFoundResponse({ description: 'The webhook delivery does not exist.' })
  listAttempts(@Param('id', ParseUUIDPipe) id: string) {
    return this.history.listAttempts(id);
  }
}
