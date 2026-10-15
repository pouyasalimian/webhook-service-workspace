import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CreateSubscriptionDto } from '../dto/create-subscription.dto.js';
import { ListSubscriptionsQueryDto } from '../dto/list-subscriptions-query.dto.js';
import { UpdateSubscriptionDto } from '../dto/update-subscription.dto.js';
import {
  CreateWebhookSubscriptionResponseDto,
  RotateWebhookSubscriptionSecretResponseDto,
  WebhookSubscriptionListResponseDto,
  WebhookSubscriptionResponseDto,
} from '../dto/webhook-api-response.dto.js';
import { WebhookSubscriptionService } from '../services/webhook-subscription.service.js';

@ApiTags('Webhook Subscriptions')
@Controller('webhook-subscriptions')
export class WebhookSubscriptionsController {
  constructor(private readonly subscriptions: WebhookSubscriptionService) {}

  @Post()
  @ApiOperation({ summary: 'Create a webhook subscription' })
  @ApiCreatedResponse({ type: CreateWebhookSubscriptionResponseDto })
  @ApiBadRequestResponse({
    description: 'The request is invalid or the endpoint is not allowed.',
  })
  create(@Body() dto: CreateSubscriptionDto) {
    return this.subscriptions.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List webhook subscriptions' })
  @ApiQuery({ type: ListSubscriptionsQueryDto })
  @ApiOkResponse({ type: WebhookSubscriptionListResponseDto })
  list(@Query() query: ListSubscriptionsQueryDto) {
    return this.subscriptions.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a webhook subscription by ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: WebhookSubscriptionResponseDto })
  @ApiNotFoundResponse({ description: 'The subscription does not exist.' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.subscriptions.get(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a webhook subscription' })
  @ApiBody({ type: UpdateSubscriptionDto })
  @ApiOkResponse({ type: WebhookSubscriptionResponseDto })
  @ApiBadRequestResponse({
    description: 'The request is invalid or the endpoint is not allowed.',
  })
  @ApiNotFoundResponse({
    description: 'The active subscription does not exist.',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    return await this.subscriptions.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Soft-delete a webhook subscription',
    description:
      'Deactivates the subscription and preserves it and its delivery history.',
  })
  @ApiOkResponse({ type: WebhookSubscriptionResponseDto })
  @ApiNotFoundResponse({ description: 'The subscription does not exist.' })
  softDelete(@Param('id', ParseUUIDPipe) id: string) {
    return this.subscriptions.softDelete(id);
  }

  @Post(':id/rotate-signing-secret')
  @ApiOperation({
    summary: 'Rotate a subscription signing secret',
    description:
      'Returns the new secret once. Update the consumer configuration before relying on signature validation.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: RotateWebhookSubscriptionSecretResponseDto })
  @ApiNotFoundResponse({
    description: 'The active subscription does not exist.',
  })
  rotateSigningSecret(@Param('id', ParseUUIDPipe) id: string) {
    return this.subscriptions.rotateSigningSecret(id);
  }
}
