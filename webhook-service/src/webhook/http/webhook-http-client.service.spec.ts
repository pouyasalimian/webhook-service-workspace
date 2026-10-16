import { createHmac } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import { WebhookFailureReason } from '../../generated/prisma/enums.js';
import {
  WebhookHttpClientService,
  WebhookTransportError,
} from './webhook-http-client.service.js';

describe('WebhookHttpClientService', () => {
  const event = {
    id: 'source-event-1',
    type: 'PAYMENT_COMPLETED',
    occurredAt: '2026-10-15T12:00:00.000Z',
    data: { amount: 1200 },
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts the event and signs the exact serialized body with HMAC-SHA256', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('accepted', { status: 202 }));

    vi.stubGlobal('fetch', fetchMock);

    const config = { get: vi.fn().mockReturnValue(5_000) };
    const secret = 'secret-for-test';

    const client = new WebhookHttpClientService(
      config as unknown as ConfigService,
    );

    await expect(
      client.post(
        'https://receiver.example/webhook',
        'webhook-1',
        secret,
        event,
      ),
    ).resolves.toMatchObject({ statusCode: 202, responseBody: 'accepted' });

    const [url, init] = fetchMock.mock.calls[0];
    const body = JSON.stringify(event);

    const expectedSignature = createHmac('sha256', secret)
      .update(body, 'utf8')
      .digest('hex');

    expect(url).toBeInstanceOf(URL);
    expect((url as URL).href).toBe('https://receiver.example/webhook');

    expect(init).toMatchObject({
      method: 'POST',
      redirect: 'manual',
      body,
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'webhook-1',
        'x-webhook-signature': `sha256=${expectedSignature}`,
      },
    });
  });

  it('maps fetch failures to a typed network transport error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const config = { get: vi.fn().mockReturnValue(5_000) };
    const client = new WebhookHttpClientService(
      config as unknown as ConfigService,
    );

    await expect(
      client.post(
        'https://receiver.example/hook',
        'webhook-1',
        'secret',
        event,
      ),
    ).rejects.toMatchObject({
      constructor: WebhookTransportError,
      reason: WebhookFailureReason.NETWORK_ERROR,
    });
  });

  it('maps request timeout failures to a timeout transport error', async () => {
    const timeoutError = new Error('timeout');
    timeoutError.name = 'TimeoutError';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timeoutError));
    const config = { get: vi.fn().mockReturnValue(5_000) };
    const client = new WebhookHttpClientService(
      config as unknown as ConfigService,
    );

    await expect(
      client.post(
        'https://receiver.example/hook',
        'webhook-1',
        'secret',
        event,
      ),
    ).rejects.toMatchObject({ reason: WebhookFailureReason.TIMEOUT });
  });

  it.each([0, -1, 1.5, Number.NaN])(
    'rejects invalid HTTP timeout configuration: %s',
    (timeout) => {
      const config = { get: vi.fn().mockReturnValue(timeout) };
      expect(
        () => new WebhookHttpClientService(config as unknown as ConfigService),
      ).toThrow('WEBHOOK_HTTP_TIMEOUT_MS must be a positive integer');
    },
  );
});
