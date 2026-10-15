export const WEBHOOK_QUEUE_NAME = 'webhook-deliveries';
export const WEBHOOK_JOB_NAME = 'deliver-webhook';
export const WEBHOOK_QUEUE = Symbol('WEBHOOK_QUEUE');
export const WEBHOOK_REDIS_CONNECTION = Symbol('WEBHOOK_REDIS_CONNECTION');

export interface WebhookDeliveryJobData {
  webhookId: string;
}
