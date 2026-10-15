import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { ReceivePaymentEventDto } from '../dto/receive-payment-event.dto.js';

@Injectable()
export class WebhookEventService {
  constructor(private readonly prisma: PrismaService) {}

  async ingest(dto: ReceivePaymentEventDto) {
    try {
      const event = await this.prisma.$transaction(async (transaction) => {
        const createdEvent = await transaction.webhookEvent.create({
          data: {
            sourceEventId: dto.eventId,
            eventType: dto.type,
            occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : null,
            payload: dto.payload as Prisma.InputJsonValue,
          },
        });

        const subscriptions = await transaction.webhookSubscription.findMany({
          where: {
            eventType: dto.type,
            isActive: true,
            deletedAt: null,
          },
          select: { id: true, endpoint: true },
        });

        const deliveries = subscriptions.map((subscription) => ({
          id: randomUUID(),
          eventId: createdEvent.id,
          subscriptionId: subscription.id,
          eventType: dto.type,
          endpoint: subscription.endpoint,
          payload: dto.payload as Prisma.InputJsonValue,
        }));

        if (deliveries.length > 0) {
          await transaction.webhook.createMany({ data: deliveries });
          await transaction.outboxMessage.createMany({
            data: deliveries.map((delivery) => ({
              webhookId: delivery.id,
              type: 'WEBHOOK_DELIVERY',
              payload: { webhookId: delivery.id },
            })),
          });
        }

        return { deliveriesCreated: deliveries.length };
      });

      return {
        eventId: dto.eventId,
        accepted: true,
        deliveriesCreated: event.deliveriesCreated,
        duplicate: false,
      };
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) throw error;

      const existing = await this.prisma.webhookEvent.findUnique({
        where: { sourceEventId: dto.eventId },
        select: { _count: { select: { webhooks: true } } },
      });

      if (!existing) throw error;

      return {
        eventId: dto.eventId,
        accepted: true,
        deliveriesCreated: existing._count.webhooks,
        duplicate: true,
      };
    }
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
