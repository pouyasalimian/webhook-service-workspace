import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { CreateSubscriptionDto } from '../dto/create-subscription.dto.js';
import { ListSubscriptionsQueryDto } from '../dto/list-subscriptions-query.dto.js';
import { UpdateSubscriptionDto } from '../dto/update-subscription.dto.js';

@Injectable()
export class WebhookSubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSubscriptionDto) {
    return this.prisma.webhookSubscription.create({
      data: { ...dto },
    });
  }

  async list(query: ListSubscriptionsQueryDto) {
    const where: Prisma.WebhookSubscriptionWhereInput = {
      deletedAt: null,
      ...(query.eventType ? { eventType: query.eventType } : {}),
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.webhookSubscription.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.webhookSubscription.count({ where }),
    ]);

    return { data, limit: query.limit, offset: query.offset, total };
  }

  async get(id: string) {
    const subscription = await this.prisma.webhookSubscription.findUnique({
      where: { id },
    });

    if (!subscription) {
      throw new NotFoundException('Webhook subscription not found');
    }

    return subscription;
  }

  async update(id: string, dto: UpdateSubscriptionDto) {
    const result = await this.prisma.webhookSubscription.updateMany({
      where: { id, deletedAt: null },
      data: {
        ...dto,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Active webhook subscription not found');
    }

    return this.get(id);
  }

  async softDelete(id: string) {
    await this.prisma.webhookSubscription.updateMany({
      where: { id, deletedAt: null },
      data: { isActive: false, deletedAt: new Date() },
    });

    return this.get(id);
  }
}
