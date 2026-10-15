import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { ListWebhooksQueryDto } from '../dto/list-webhooks-query.dto.js';

const MAX_RESPONSE_BODY_CHARS = 4096;

@Injectable()
export class WebhookHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListWebhooksQueryDto) {
    const createdAfter = query.createdAfter
      ? new Date(query.createdAfter)
      : undefined;
    const createdBefore = query.createdBefore
      ? new Date(query.createdBefore)
      : undefined;

    if (
      createdAfter &&
      createdBefore &&
      createdAfter.getTime() > createdBefore.getTime()
    ) {
      throw new BadRequestException(
        'createdAfter must be earlier than or equal to createdBefore',
      );
    }

    const where: Prisma.WebhookWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.eventType ? { eventType: query.eventType } : {}),
      ...(query.subscriptionId ? { subscriptionId: query.subscriptionId } : {}),
      ...(query.eventId ? { eventId: query.eventId } : {}),
      ...(createdAfter || createdBefore
        ? {
            createdAt: {
              ...(createdAfter ? { gte: createdAfter } : {}),
              ...(createdBefore ? { lte: createdBefore } : {}),
            },
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.webhook.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit,
        skip: query.offset,
        select: {
          id: true,
          eventId: true,
          subscriptionId: true,
          eventType: true,
          status: true,
          attemptCount: true,
          failureReason: true,
          nextAttemptAt: true,
          lastAttemptAt: true,
          succeededAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.webhook.count({ where }),
    ]);

    return { data, limit: query.limit, offset: query.offset, total };
  }

  async get(id: string) {
    const webhook = await this.prisma.webhook.findUnique({
      where: { id },
      select: {
        id: true,
        eventId: true,
        subscriptionId: true,
        eventType: true,
        status: true,
        attemptCount: true,
        failureReason: true,
        nextAttemptAt: true,
        lastAttemptAt: true,
        succeededAt: true,
        createdAt: true,
        updatedAt: true,
        attempts: {
          orderBy: { attemptNumber: 'asc' },
          select: {
            id: true,
            attemptNumber: true,
            status: true,
            clientHttpStatus: true,
            failureReason: true,
            durationMs: true,
            startedAt: true,
            completedAt: true,
          },
        },
      },
    });

    if (!webhook) {
      throw new NotFoundException('Webhook delivery not found');
    }

    return webhook;
  }

  async listAttempts(id: string) {
    const webhook = await this.prisma.webhook.findUnique({
      where: { id },
      select: {
        attempts: {
          orderBy: { attemptNumber: 'asc' },
          select: {
            id: true,
            attemptNumber: true,
            status: true,
            clientHttpStatus: true,
            failureReason: true,
            failureDetails: true,
            responseBody: true,
            durationMs: true,
            startedAt: true,
            completedAt: true,
          },
        },
      },
    });

    if (!webhook) {
      throw new NotFoundException('Webhook delivery not found');
    }

    return webhook.attempts.map((attempt) => {
      const responseBody = attempt.responseBody;
      return {
        ...attempt,
        responseBody:
          responseBody === null
            ? null
            : responseBody.slice(0, MAX_RESPONSE_BODY_CHARS),
        responseBodyTruncated:
          responseBody !== null &&
          responseBody.length > MAX_RESPONSE_BODY_CHARS,
      };
    });
  }
}
