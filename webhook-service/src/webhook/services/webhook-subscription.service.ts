import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { CreateSubscriptionDto } from '../dto/create-subscription.dto.js';
import { ListSubscriptionsQueryDto } from '../dto/list-subscriptions-query.dto.js';
import { UpdateSubscriptionDto } from '../dto/update-subscription.dto.js';

@Injectable()
export class WebhookSubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSubscriptionDto) {
    const signingSecret = this.generateSigningSecret();
    const subscription = await this.prisma.webhookSubscription.create({
      data: { ...dto, signingSecret },
      select: {
        id: true,
        eventType: true,
        endpoint: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });

    return { ...subscription, signingSecret };
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
        select: {
          id: true,
          eventType: true,
          endpoint: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
        },
      }),
      this.prisma.webhookSubscription.count({ where }),
    ]);

    return { data, limit: query.limit, offset: query.offset, total };
  }

  async get(id: string) {
    const subscription = await this.prisma.webhookSubscription.findUnique({
      where: { id },
      select: {
        id: true,
        eventType: true,
        endpoint: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
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

  async rotateSigningSecret(id: string) {
    const signingSecret = this.generateSigningSecret();
    const updated = await this.prisma.webhookSubscription.updateMany({
      where: { id, deletedAt: null },
      data: { signingSecret },
    });

    if (updated.count === 0) {
      throw new NotFoundException('Active webhook subscription not found');
    }

    return { id, signingSecret };
  }

  private generateSigningSecret() {
    return randomBytes(32).toString('hex');
  }
}
