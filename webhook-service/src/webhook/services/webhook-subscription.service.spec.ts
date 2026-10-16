import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { WebhookSubscriptionService } from './webhook-subscription.service.js';

describe('WebhookSubscriptionService', () => {
  function setup() {
    const prisma = {
      webhookSubscription: {
        create: vi.fn().mockResolvedValue({
          id: 'subscription-1',
          eventType: 'PAYMENT_COMPLETED',
          endpoint: 'https://receiver.example/webhook',
          isActive: true,
        }),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        findUnique: vi.fn().mockResolvedValue(null),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: vi.fn((queries: unknown[]) => Promise.all(queries)),
    };

    return {
      service: new WebhookSubscriptionService(
        prisma as unknown as PrismaService,
      ),
      prisma,
    };
  }

  it('creates a subscription and returns its generated signing secret once', async () => {
    const { service, prisma } = setup();

    const result = await service.create({
      eventType: 'PAYMENT_COMPLETED',
      endpoint: 'https://receiver.example/webhook',
    } as never);

    expect(result.signingSecret).toMatch(/^[a-f0-9]{64}$/);
    expect(prisma.webhookSubscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          signingSecret: result.signingSecret,
          endpoint: 'https://receiver.example/webhook',
        }),
        select: expect.not.objectContaining({ signingSecret: true }),
      }),
    );
  });

  it('filters soft-deleted records and applies optional list filters', async () => {
    const { service, prisma } = setup();
    const query = {
      eventType: 'PAYMENT_COMPLETED',
      isActive: false,
      limit: 20,
      offset: 10,
    } as never;

    await service.list(query);

    const where = {
      deletedAt: null,
      eventType: 'PAYMENT_COMPLETED',
      isActive: false,
    };

    expect(prisma.webhookSubscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where, take: 20, skip: 10 }),
    );

    expect(prisma.webhookSubscription.count).toHaveBeenCalledWith({ where });
  });

  it('lists all non-deleted subscriptions when no filters are supplied', async () => {
    const { service, prisma } = setup();

    await service.list({ limit: 25, offset: 0 } as never);

    expect(prisma.webhookSubscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null },
        take: 25,
        skip: 0,
      }),
    );

    expect(prisma.webhookSubscription.count).toHaveBeenCalledWith({
      where: { deletedAt: null },
    });
  });

  it('does not return signing secrets in ordinary subscription reads', async () => {
    const { service, prisma } = setup();
    prisma.webhookSubscription.findUnique.mockResolvedValue({
      id: 'subscription-1',
      endpoint: 'https://receiver.example/webhook',
    });

    await service.get('subscription-1');

    expect(prisma.webhookSubscription.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.not.objectContaining({ signingSecret: true }),
      }),
    );
  });

  it('returns not found for a missing subscription', async () => {
    const { service } = setup();
    await expect(service.get('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates an active subscription and returns its public representation', async () => {
    const { service, prisma } = setup();
    const updated = {
      id: 'subscription-1',
      endpoint: 'https://new.example/hook',
      isActive: false,
    };
    prisma.webhookSubscription.findUnique.mockResolvedValue(updated);

    await expect(
      service.update('subscription-1', {
        endpoint: updated.endpoint,
        isActive: false,
      }),
    ).resolves.toEqual(updated);

    expect(prisma.webhookSubscription.updateMany).toHaveBeenCalledWith({
      where: { id: 'subscription-1', deletedAt: null },
      data: { endpoint: updated.endpoint, isActive: false },
    });
  });

  it('returns not found when updating a deleted or missing subscription', async () => {
    const { service, prisma } = setup();
    prisma.webhookSubscription.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.update('missing', {
        endpoint: 'https://new.example/hook',
        isActive: true,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('soft-deletes a subscription by deactivating it and setting deletedAt', async () => {
    const { service, prisma } = setup();
    const publicSubscription = {
      id: 'subscription-1',
      isActive: false,
      deletedAt: new Date(),
    };

    prisma.webhookSubscription.findUnique.mockResolvedValue(publicSubscription);

    await expect(service.softDelete('subscription-1')).resolves.toEqual(
      publicSubscription,
    );

    expect(prisma.webhookSubscription.updateMany).toHaveBeenCalledWith({
      where: { id: 'subscription-1', deletedAt: null },
      data: expect.objectContaining({
        isActive: false,
        deletedAt: expect.any(Date),
      }),
    });
  });

  it('rotates the secret and returns it once without selecting it from the database', async () => {
    const { service, prisma } = setup();

    const result = await service.rotateSigningSecret('subscription-1');

    expect(result).toMatchObject({
      id: 'subscription-1',
      signingSecret: expect.stringMatching(/^[a-f0-9]{64}$/),
    });

    expect(prisma.webhookSubscription.updateMany).toHaveBeenCalledWith({
      where: { id: 'subscription-1', deletedAt: null },
      data: { signingSecret: result.signingSecret },
    });
  });

  it('returns not found when rotating the secret for a deleted or missing subscription', async () => {
    const { service, prisma } = setup();
    prisma.webhookSubscription.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.rotateSigningSecret('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
