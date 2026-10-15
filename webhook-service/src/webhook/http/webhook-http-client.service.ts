import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { WebhookFailureReason } from '../../generated/prisma/enums.js';

export class WebhookTransportError extends Error {
  constructor(readonly reason: WebhookFailureReason) {
    super(
      reason === WebhookFailureReason.TIMEOUT
        ? 'Request timed out'
        : 'Network request failed',
    );
  }
}

export interface WebhookHttpResult {
  statusCode: number;
  responseBody: string;
  durationMs: number;
}

@Injectable()
export class WebhookHttpClientService {
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.timeoutMs = Number(config.get('WEBHOOK_HTTP_TIMEOUT_MS', 10_000));

    if (!Number.isSafeInteger(this.timeoutMs) || this.timeoutMs < 1) {
      throw new Error('WEBHOOK_HTTP_TIMEOUT_MS must be a positive integer');
    }
  }

  async post(
    endpoint: string,
    webhookId: string,
    signingSecret: string,
    event: { id: string; type: string; occurredAt: string; data: unknown },
  ): Promise<WebhookHttpResult> {
    const url = new URL(endpoint);
    const startedAt = Date.now();
    const body = JSON.stringify(event);
    const signature = createHmac('sha256', signingSecret)
      .update(body, 'utf8')
      .digest('hex');

    try {
      const response = await fetch(url, {
        method: 'POST',
        redirect: 'manual',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': webhookId,
          'x-webhook-signature': `sha256=${signature}`,
        },
        body,
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      return {
        statusCode: response.status,
        responseBody: await response.text(),
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'TimeoutError';
      throw new WebhookTransportError(
        timedOut
          ? WebhookFailureReason.TIMEOUT
          : WebhookFailureReason.NETWORK_ERROR,
      );
    }
  }
}
