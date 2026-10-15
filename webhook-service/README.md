# Webhook Service

NestJS service for accepting payment events and delivering them to subscribed webhook endpoints. The design and delivery semantics are documented in [`../docs/webhook-delivery-architecture.md`](../docs/webhook-delivery-architecture.md).

## Local development

Requirements: Node.js 22+, pnpm 10+, and Docker Compose.

```bash
pnpm install
cp .env.example .env
docker compose up -d postgres redis
pnpm db:generate
pnpm db:migrate
pnpm start:dev
```

The Compose stack exposes PostgreSQL on `localhost:5432` and Redis on `localhost:6379`. Its credentials are for local development only. `docker compose ps` shows service health; stop the services with `docker compose down` (use `docker compose down -v` only when you intend to delete local database and Redis data).

## Configuration

`src/configs/env.validation.ts` validates and normalizes environment variables during Nest startup. `DATABASE_URL` is required and must be a PostgreSQL URL. Other development defaults are listed in `.env.example`.

Prisma 7 reads the migration connection from `prisma.config.ts`; the Nest runtime creates its PostgreSQL driver adapter using the same `DATABASE_URL`.

## Database commands

```bash
pnpm db:generate           # Generate the Prisma client
pnpm db:migrate             # Apply pending migrations and create a new one if needed
pnpm db:migrate:create --name change_name
pnpm db:deploy              # Apply committed migrations in deployment
pnpm db:status
pnpm db:studio
```

Prisma model properties remain idiomatic camelCase in TypeScript. `@map` and `@@map` map every database field, enum type, and table to snake_case.

## Run

```bash
pnpm start:dev
pnpm build
pnpm start:prod
```

## Subscription and event APIs

All routes use the `/api/v1` prefix. Request DTOs reject unknown fields and invalid types.

- `POST /webhook-subscriptions` creates an active subscription. Example body: `{"eventType":"PAYMENT_COMPLETED","endpoint":"https://consumer.example.com/hooks"}`.
- `GET /webhook-subscriptions?limit=50&offset=0&eventType=PAYMENT_COMPLETED&isActive=true` lists non-deleted subscriptions with stable pagination.
- `GET /webhook-subscriptions/:id` reads a subscription, including a soft-deleted one for audit.
- `PATCH /webhook-subscriptions/:id` updates `endpoint` and/or `isActive`.
- `DELETE /webhook-subscriptions/:id` sets `deletedAt` and deactivates the subscription; it does not remove delivery history.
- `POST /webhook-subscriptions/:id/rotate-signing-secret` rotates its signing secret and returns it once.
- `POST /payment-events` accepts `{ "eventId": "payment-event-123", "type": "PAYMENT_COMPLETED", "occurredAt": "2026-10-15T00:00:00Z", "payload": { "paymentId": "pay_123", "amount": 5000, "currency": "USD" } }`.

Event ingestion writes the event, matching deliveries, and outbox rows in one database transaction. A new event returns `202 Accepted`; a repeated `eventId` returns `200 OK` with `duplicate: true` and the existing delivery count. It does not fan out twice. Subscriptions are selected only when their event type matches, they are active, and `deletedAt` is null. Each delivery snapshots the subscription endpoint at ingestion time.

Subscription endpoints must be valid absolute HTTP(S) URLs. They are parsed with the standard `URL` API when a delivery is sent.

Each subscription receives a cryptographically random 256-bit signing secret. The secret is returned only in the create response and when explicitly rotated; list/get responses never expose it. Every delivery includes `X-Webhook-Signature: sha256=<hex>` computed as HMAC-SHA256 over the exact UTF-8 JSON request body. Consumers must verify against the raw request bytes and compare signatures using a constant-time comparison. For example, in Node.js:

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

function verifyWebhook(rawBody: Buffer, header: string, secret: string) {
  const match = /^sha256=([a-f0-9]{64})$/.exec(header);
  if (!match) return false;

  const expected = createHmac('sha256', secret).update(rawBody).digest();
  const received = Buffer.from(match[1], 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}
```

Secret rotation takes effect for subsequent delivery attempts. Configure the new secret at the consumer before using the rotation endpoint; this initial design does not provide an overlap window for old and new secrets.

## Delivery history APIs

- `GET /webhooks?status=FAILED&eventType=PAYMENT_COMPLETED&subscriptionId=<uuid>&eventId=<uuid>&createdAfter=<date-time>&createdBefore=<date-time>&limit=50&offset=0` lists deliveries with optional filters and stable newest-first pagination. The response includes `data`, `limit`, `offset`, and `total`.
- `GET /webhooks/:id` returns a delivery's current status and attempt summaries.
- `GET /webhooks/:id/deliveries` returns its individual HTTP attempts, including failure details and response bodies capped at 4096 characters.

History responses omit the event payload and endpoint. The attempt list is ordered by attempt number, and an invalid date range where `createdAfter` is later than `createdBefore` returns `400 Bad Request`.

## Outbox and queue

The outbox dispatcher starts with the Nest application and polls every `OUTBOX_POLL_INTERVAL_MS` (default `1000` ms). It processes up to 100 unpublished rows per poll, enqueues a `deliver-webhook` BullMQ job on the `webhook-deliveries` queue with ID `webhook-<webhookId>`, then records `publishedAt`. If enqueueing fails, the row stays unpublished for a later poll. If Redis accepted the job but updating PostgreSQL failed, the dispatcher can enqueue it again; BullMQ's deterministic job ID suppresses the duplicate while the job remains in the queue.

Redis connection settings are `REDIS_HOST`, `REDIS_PORT`, and optional `REDIS_PASSWORD`. BullMQ job data contains only `{ "webhookId": "<uuid>" }`; delivery state remains in PostgreSQL.

The service starts `WEBHOOK_WORKER_COUNT` Node.js worker threads (default `1`), each running an independent NestJS BullMQ consumer for the same queue. Set it to `0` to run the API without consumers, or increase it to add consumers. Each consumer processes up to `WEBHOOK_WORKER_CONCURRENCY` jobs concurrently (default `2`), so the maximum in-flight jobs per service instance is worker count multiplied by per-thread concurrency. The processor claims a pending delivery and persists its next `WebhookDelivery` row before making an HTTP request. Requests use the event envelope, `Content-Type: application/json`, and the logical delivery UUID as `Idempotency-Key`. Redirects are not followed, and each request has a `WEBHOOK_HTTP_TIMEOUT_MS` deadline. Any 2xx response marks the delivery successful. HTTP, timeout, and network failures are recorded and retried for up to six total attempts, using delays of 1 minute, 10 minutes, 30 minutes, 1 hour, and 24 hours.

The reconciliation service runs every `RECONCILIATION_INTERVAL_MS` (default `30000` ms). It recovers deliveries left in `PROCESSING` longer than the HTTP timeout plus a 30-second safety margin, and re-enqueues due `PENDING` deliveries when their deterministic BullMQ job is missing or terminal. The database status and attempt history remain authoritative; conditional claims prevent duplicate jobs from sending concurrently.
