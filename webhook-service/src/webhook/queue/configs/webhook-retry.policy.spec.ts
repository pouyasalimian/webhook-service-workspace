import {
  getWebhookRetryDelayMs,
  MAX_DELIVERY_ATTEMPTS,
  webhookRetryBackoff,
} from './webhook-retry.policy.js';

describe('webhook retry policy', () => {
  it('allows six total delivery attempts', () => {
    expect(MAX_DELIVERY_ATTEMPTS).toBe(6);
  });

  it.each([
    [1, 60_000],
    [2, 10 * 60_000],
    [3, 30 * 60_000],
    [4, 60 * 60_000],
    [5, 24 * 60 * 60_000],
  ])(
    'returns the configured delay after failed attempt %i',
    (attempt, delay) => {
      expect(getWebhookRetryDelayMs(attempt)).toBe(delay);
      expect(webhookRetryBackoff(attempt)).toBe(delay);
    },
  );

  it('marks attempts beyond the retry schedule as exhausted', () => {
    expect(getWebhookRetryDelayMs(6)).toBeUndefined();
    expect(webhookRetryBackoff(6)).toBe(-1);
  });
});
