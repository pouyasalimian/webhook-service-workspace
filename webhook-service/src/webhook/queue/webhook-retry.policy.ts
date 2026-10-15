export const MAX_DELIVERY_ATTEMPTS = 6;
export const WEBHOOK_RETRY_BACKOFF_TYPE = 'webhook-delivery-retry';

const RETRY_DELAYS_MS = [3_000, 3_000, 3_000, 3_000, 3_000];

/** `failedAttemptNumber` is one-based: attempt 1 maps to the first retry delay. */
export function getWebhookRetryDelayMs(
  failedAttemptNumber: number,
): number | undefined {
  return RETRY_DELAYS_MS[failedAttemptNumber - 1];
}

/** BullMQ passes attemptsMade as a one-based count when calculating a retry. */
export function webhookRetryBackoff(attemptsMade: number): number {
  return getWebhookRetryDelayMs(attemptsMade) ?? -1;
}
