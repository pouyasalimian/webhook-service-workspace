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
import { CreateSubscriptionDto } from '../dto/create-subscription.dto.js';
import { ListSubscriptionsQueryDto } from '../dto/list-subscriptions-query.dto.js';
import { UpdateSubscriptionDto } from '../dto/update-subscription.dto.js';
import { WebhookSubscriptionService } from '../services/webhook-subscription.service.js';

@Controller('webhook-subscriptions')
export class WebhookSubscriptionsController {
  constructor(private readonly subscriptions: WebhookSubscriptionService) {}

  @Post()
  create(@Body() dto: CreateSubscriptionDto) {
    return this.subscriptions.create(dto);
  }

  @Get()
  list(@Query() query: ListSubscriptionsQueryDto) {
    return this.subscriptions.list(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.subscriptions.get(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    return this.subscriptions.update(id, dto);
  }

  @Delete(':id')
  softDelete(@Param('id', ParseUUIDPipe) id: string) {
    return this.subscriptions.softDelete(id);
  }
}
