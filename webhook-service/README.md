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
- `POST /payment-events` accepts `{ "eventId": "payment-event-123", "type": "PAYMENT_COMPLETED", "occurredAt": "2026-10-15T00:00:00Z", "payload": { "paymentId": "pay_123", "amount": 5000, "currency": "USD" } }`.

Event ingestion writes the event, matching deliveries, and outbox rows in one database transaction. A new event returns `202 Accepted`; a repeated `eventId` returns `200 OK` with `duplicate: true` and the existing delivery count. It does not fan out twice. Subscriptions are selected only when their event type matches, they are active, and `deletedAt` is null. Each delivery snapshots the subscription endpoint at ingestion time.

Subscription endpoints must be absolute HTTP(S) URLs without embedded credentials or fragments. Production requires HTTPS. DNS results are checked and private/reserved destinations are rejected; loopback HTTP endpoints are allowed only in development or test for local receiver testing. Delivery-time DNS validation is still required when the worker is implemented to protect against DNS rebinding.
