export const MAX_DELIVERY_ATTEMPTS = 6;
export const WEBHOOK_RETRY_BACKOFF_TYPE = 'webhook-delivery-retry';

const RETRY_DELAYS_MS = [
  60_000, // retry after attempt 1 fails: 1 minute
  10 * 60_000, // retry after attempt 2 fails: 10 minutes
  30 * 60_000, // retry after attempt 3 fails: 30 minutes
  60 * 60_000, // retry after attempt 4 fails: 1 hour
  24 * 60 * 60_000, // retry after attempt 5 fails: 24 hours
];

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
