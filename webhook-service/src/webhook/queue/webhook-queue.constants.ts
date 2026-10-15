export const WEBHOOK_QUEUE_NAME = 'webhook-deliveries';
export const WEBHOOK_JOB_NAME = 'deliver-webhook';
export const WEBHOOK_QUEUE = Symbol('WEBHOOK_QUEUE');

export interface WebhookDeliveryJobData {
  webhookId: string;
}
