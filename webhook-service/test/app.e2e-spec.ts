import {
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { InfrastructureModule } from '../src/infrastructure/infrastructure.module.js';
import { PrismaService } from '../src/infrastructure/database/prisma.service.js';
import { PaymentEventsModule } from '../src/payment-events/payment-events.module.js';
import { PaymentEventService } from '../src/payment-events/services/payment-event.service.js';
import { WebhookHistoryController } from '../src/webhook/controllers/webhook-history.controller.js';
import { WebhookSubscriptionsController } from '../src/webhook/controllers/webhook-subscriptions.controller.js';
import { WebhookHistoryService } from '../src/webhook/services/webhook-history.service.js';
import { WebhookSubscriptionService } from '../src/webhook/services/webhook-subscription.service.js';

describe('Webhook HTTP API (e2e)', () => {
  let app: INestApplication;

  const paymentEvents = {
    ingest: vi.fn(),
  };

  const subscriptions = {
    create: vi.fn(),
    list: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    rotateSigningSecret: vi.fn(),
  };

  const history = {
    list: vi.fn(),
    get: vi.fn(),
    listAttempts: vi.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [InfrastructureModule, PaymentEventsModule],
      controllers: [WebhookSubscriptionsController, WebhookHistoryController],
      providers: [
        { provide: WebhookSubscriptionService, useValue: subscriptions },
        { provide: WebhookHistoryService, useValue: history },
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(PaymentEventService)
      .useValue(paymentEvents)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/payment-events', () => {
    const event = {
      eventId: 'payment-event-123',
      type: 'PAYMENT_COMPLETED',
      occurredAt: '2026-10-15T12:00:00.000Z',
      payload: { paymentId: 'payment-1', amount: 1250 },
    };

    it('accepts a valid event with 202 and returns the ingestion result', async () => {
      const result = {
        eventId: event.eventId,
        accepted: true,
        deliveriesCreated: 2,
        duplicate: false,
      };

      paymentEvents.ingest.mockResolvedValue(result);

      await request(app.getHttpServer())
        .post('/api/v1/payment-events')
        .send(event)
        .expect(202)
        .expect(result);

      expect(paymentEvents.ingest).toHaveBeenCalledWith(event);
    });

    it('returns 200 when the event was already accepted', async () => {
      const result = {
        eventId: event.eventId,
        accepted: true,
        deliveriesCreated: 2,
        duplicate: true,
      };

      paymentEvents.ingest.mockResolvedValue(result);

      await request(app.getHttpServer())
        .post('/api/v1/payment-events')
        .send(event)
        .expect(200)
        .expect(result);
    });

    it('rejects invalid event fields and unknown properties before service invocation', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/payment-events')
        .send({ ...event, type: 'UNKNOWN', extra: true })
        .expect(400);

      expect(paymentEvents.ingest).not.toHaveBeenCalled();
    });

    it('rejects requests without an object payload', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/payment-events')
        .send({ eventId: event.eventId, type: event.type, payload: 'bad' })
        .expect(400);

      expect(paymentEvents.ingest).not.toHaveBeenCalled();
    });
  });

  describe('webhook subscriptions', () => {
    it('creates a subscription and returns the signing secret', async () => {
      const response = {
        id: 'subscription-1',
        eventType: 'PAYMENT_COMPLETED',
        endpoint: 'https://consumer.example/webhook',
        isActive: true,
        signingSecret: 'once-only-secret',
      };
      subscriptions.create.mockResolvedValue(response);

      await request(app.getHttpServer())
        .post('/api/v1/webhook-subscriptions')
        .send({
          eventType: 'PAYMENT_COMPLETED',
          endpoint: 'https://consumer.example/webhook',
        })
        .expect(201)
        .expect(response);

      expect(subscriptions.create).toHaveBeenCalledWith({
        eventType: 'PAYMENT_COMPLETED',
        endpoint: 'https://consumer.example/webhook',
      });
    });

    it('rejects an invalid endpoint or event type', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/webhook-subscriptions')
        .send({ eventType: 'UNKNOWN', endpoint: 'not-a-url' })
        .expect(400);

      expect(subscriptions.create).not.toHaveBeenCalled();
    });

    it('parses boolean and pagination query parameters before listing', async () => {
      const response = { data: [], limit: 25, offset: 5, total: 0 };
      subscriptions.list.mockResolvedValue(response);

      await request(app.getHttpServer())
        .get('/api/v1/webhook-subscriptions')
        .query({
          eventType: 'PAYMENT_COMPLETED',
          isActive: 'false',
          limit: '25',
          offset: '5',
        })
        .expect(200)
        .expect(response);

      expect(subscriptions.list).toHaveBeenCalledWith({
        eventType: 'PAYMENT_COMPLETED',
        isActive: false,
        limit: 25,
        offset: 5,
      });
    });

    it('rejects invalid list query values', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/webhook-subscriptions')
        .query({ isActive: 'sometimes', limit: '1000' })
        .expect(400);

      expect(subscriptions.list).not.toHaveBeenCalled();
    });

    it('uses UUID validation for subscription detail routes', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/webhook-subscriptions/not-a-uuid')
        .expect(400);

      expect(subscriptions.get).not.toHaveBeenCalled();
    });

    it('returns 404 when a subscription service lookup fails', async () => {
      subscriptions.get.mockRejectedValue(
        new NotFoundException('Webhook subscription not found'),
      );

      await request(app.getHttpServer())
        .get(
          '/api/v1/webhook-subscriptions/00000000-0000-4000-8000-000000000001',
        )
        .expect(404);
    });
  });

  describe('webhook delivery history', () => {
    it('lists deliveries with typed query filters and pagination', async () => {
      const response = { data: [], limit: 10, offset: 20, total: 0 };
      history.list.mockResolvedValue(response);

      await request(app.getHttpServer())
        .get('/api/v1/webhooks')
        .query({ status: 'FAILED', limit: '10', offset: '20' })
        .expect(200)
        .expect(response);

      expect(history.list).toHaveBeenCalledWith({
        status: 'FAILED',
        limit: 10,
        offset: 20,
      });
    });

    it('rejects invalid history filters', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/webhooks')
        .query({ status: 'UNKNOWN', limit: '0' })
        .expect(400);

      expect(history.list).not.toHaveBeenCalled();
    });

    it('rejects invalid delivery IDs before calling the history service', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/webhooks/not-a-uuid')
        .expect(400);

      expect(history.get).not.toHaveBeenCalled();
    });

    it('returns attempt history from the delivery route', async () => {
      const attempts = [
        {
          id: 'attempt-1',
          attemptNumber: 1,
          status: 'SUCCESS',
          responseBody: 'accepted',
          responseBodyTruncated: false,
        },
      ];
      history.listAttempts.mockResolvedValue(attempts);

      await request(app.getHttpServer())
        .get('/api/v1/webhooks/00000000-0000-4000-8000-000000000001/deliveries')
        .expect(200)
        .expect(attempts);

      expect(history.listAttempts).toHaveBeenCalledWith(
        '00000000-0000-4000-8000-000000000001',
      );
    });
  });

  it('serves API routes under the versioned prefix only', async () => {
    await request(app.getHttpServer()).get('/').expect(404);
    await request(app.getHttpServer()).get('/payment-events').expect(404);
  });
});
