import { Prisma } from '../../generated/prisma/client.js';
import { WebhookEventType } from '../../generated/prisma/enums.js';
import type { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { OUTBOX_MESSAGE_TYPE } from '../../webhook/constants/outbox.constant.js';
import { PaymentEventService } from './payment-event.service.js';

describe('PaymentEventService', () => {
  const dto = {
    eventId: 'payment-event-123',
    type: WebhookEventType.PAYMENT_COMPLETED,
    occurredAt: '2026-10-15T12:00:00.000Z',
    payload: { amount: 1200, currency: 'USD' },
  };

  function setup(subscriptions: Array<{ id: string; endpoint: string }> = []) {
    const transaction = {
      webhookEvent: {
        create: vi.fn().mockResolvedValue({ id: 'event-db-id' }),
      },
      webhookSubscription: {
        findMany: vi.fn().mockResolvedValue(subscriptions),
      },
      webhook: {
        createMany: vi.fn().mockResolvedValue({ count: subscriptions.length }),
      },
      outboxMessage: {
        createMany: vi.fn().mockResolvedValue({ count: subscriptions.length }),
      },
    };

    const prisma = {
      $transaction: vi.fn((callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
      ),
      webhookEvent: { findUnique: vi.fn() },
    };

    return {
      service: new PaymentEventService(prisma as unknown as PrismaService),
      prisma,
      transaction,
    };
  }

  it('writes the event, matching deliveries, and outbox messages in one transaction', async () => {
    const { service, prisma, transaction } = setup([
      { id: 'subscription-1', endpoint: 'https://one.example/hook' },
      { id: 'subscription-2', endpoint: 'https://two.example/hook' },
    ]);

    await expect(service.ingest(dto)).resolves.toEqual({
      eventId: dto.eventId,
      accepted: true,
      deliveriesCreated: 2,
      duplicate: false,
    });

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(transaction.webhookEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceEventId: dto.eventId,
        eventType: dto.type,
        occurredAt: new Date(dto.occurredAt),
      }),
    });

    expect(transaction.webhook.createMany).toHaveBeenCalledOnce();

    const [deliveries] = transaction.webhook.createMany.mock.calls[0];
    expect(deliveries.data).toHaveLength(2);
    expect(deliveries.data[0]).toMatchObject({
      eventId: 'event-db-id',
      subscriptionId: 'subscription-1',
      endpoint: 'https://one.example/hook',
      eventType: dto.type,
    });

    expect(deliveries.data[0].id).toEqual(expect.any(String));

    expect(transaction.outboxMessage.createMany).toHaveBeenCalledWith({
      data: deliveries.data.map((delivery: { id: string }) => ({
        webhookId: delivery.id,
        type: OUTBOX_MESSAGE_TYPE,
        payload: { webhookId: delivery.id },
      })),
    });
  });

  it('does not issue bulk delivery or outbox inserts when there are no matching subscriptions', async () => {
    const { service, transaction } = setup();

    await expect(service.ingest(dto)).resolves.toMatchObject({
      deliveriesCreated: 0,
      duplicate: false,
    });

    expect(transaction.webhook.createMany).not.toHaveBeenCalled();
    expect(transaction.outboxMessage.createMany).not.toHaveBeenCalled();
  });

  it('stores a null occurrence time when the event omits occurredAt', async () => {
    const { service, transaction } = setup();
    const { occurredAt: _occurredAt, ...dtoWithoutTimestamp } = dto;

    await service.ingest(dtoWithoutTimestamp);

    expect(transaction.webhookEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ occurredAt: null }),
    });
  });

  it('returns the existing delivery count for a duplicate source event', async () => {
    const { service, prisma } = setup();

    const duplicateError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      { code: 'P2002', clientVersion: 'test' },
    );

    prisma.$transaction.mockRejectedValue(duplicateError);
    prisma.webhookEvent.findUnique.mockResolvedValue({
      _count: { webhooks: 4 },
    });

    await expect(service.ingest(dto)).resolves.toEqual({
      eventId: dto.eventId,
      accepted: true,
      deliveriesCreated: 4,
      duplicate: true,
    });

    expect(prisma.webhookEvent.findUnique).toHaveBeenCalledWith({
      where: { sourceEventId: dto.eventId },
      select: { _count: { select: { webhooks: true } } },
    });
  });

  it('rethrows non-unique database errors', async () => {
    const { service, prisma } = setup();
    const error = new Error('database unavailable');
    prisma.$transaction.mockRejectedValue(error);

    await expect(service.ingest(dto)).rejects.toBe(error);
    expect(prisma.webhookEvent.findUnique).not.toHaveBeenCalled();
  });

  it('rethrows a unique error if no matching source event can be found', async () => {
    const { service, prisma } = setup();
    const error = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      { code: 'P2002', clientVersion: 'test' },
    );

    prisma.$transaction.mockRejectedValue(error);
    prisma.webhookEvent.findUnique.mockResolvedValue(null);

    await expect(service.ingest(dto)).rejects.toBe(error);
  });
});
