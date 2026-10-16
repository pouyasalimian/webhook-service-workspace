# Webhook Service Workspace

A NestJS webhook delivery service with PostgreSQL persistence, a transactional outbox, BullMQ/Redis workers, delivery history, and a small Express receiver that verifies the service's HMAC signatures.

## Workspace layout

| Path                                                                               | Purpose                                                                                |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [`webhook-service/`](./webhook-service/README.md)                                  | NestJS API, Prisma schema and migrations, BullMQ workers, and health endpoints.        |
| [`webhook-receiver-example/`](./webhook-receiver-example/README.md)                | Minimal Express receiver that verifies webhook signatures against raw request bytes.   |
| [`docs/webhook-delivery-architecture.md`](./docs/webhook-delivery-architecture.md) | Architecture specification, data model, delivery guarantees, and implementation notes. |
| [`docker-compose.yml`](./docker-compose.yml)                                       | PostgreSQL, Redis, migration job, and the API service.                                 |

## Start everything

Install Docker Desktop or Docker Engine with Docker Compose, then run from this workspace root:

```bash
docker compose up --build
```

Compose builds the Node 24 API image, starts PostgreSQL and Redis, waits for their health checks, applies committed Prisma migrations, and then starts the API. No local Node.js, pnpm, Prisma, or separate database setup is needed for the containerized stack.

| Service           | Address                                      |
| ----------------- | -------------------------------------------- |
| API               | <http://localhost:3000/api/v1>               |
| Swagger UI        | <http://localhost:3000/swagger>              |
| Liveness          | <http://localhost:3000/api/v1/health/check>  |
| Dependency status | <http://localhost:3000/api/v1/health/status> |
| PostgreSQL        | `localhost:5432`                             |
| Redis             | `localhost:6379`                             |

Compose uses local-development PostgreSQL credentials (`webhook` / `local-dev-password`, database `webhook_service`). Override worker settings through your shell or a workspace-root `.env` file: `WEBHOOK_WORKER_COUNT`, `WEBHOOK_WORKER_CONCURRENCY`, `WEBHOOK_HTTP_TIMEOUT_MS`, and `RECONCILIATION_INTERVAL_MS`.

Useful Compose commands:

```bash
docker compose ps
docker compose logs -f webhook-service
docker compose down
```

The named PostgreSQL and Redis volumes persist after `docker compose down`. Use `docker compose down -v` only when you want to delete that local data.

## Try the delivery flow

With the API running, create a subscription, then post an event. Use a receiver URL reachable from the API container, such as `http://host.docker.internal:4000/webhooks` when running the example receiver on the host.

```bash
curl -X POST http://localhost:3000/api/v1/webhook-subscriptions \
  -H 'content-type: application/json' \
  -d '{"eventType":"PAYMENT_COMPLETED","endpoint":"http://host.docker.internal:4000/webhooks"}'
```

Save the returned `signingSecret`, start the receiver with that secret (see its [README](./webhook-receiver-example/README.md)), then submit an event:

```bash
curl -X POST http://localhost:3000/api/v1/payment-events \
  -H 'content-type: application/json' \
  -d '{"eventId":"payment-event-123","type":"PAYMENT_COMPLETED","payload":{"paymentId":"pay_123","amount":5000,"currency":"USD"}}'
```

The first accepted source event returns `202`; resubmitting the same `eventId` returns `200` without creating a second set of deliveries. The receiver verifies `X-Webhook-Signature` and prints a successfully verified event.

## Run and test the API on the host

The API's host development workflow needs Node.js 24 and pnpm 10. From `webhook-service/`, start the backing services and prepare the database:

```bash
docker compose -f ../docker-compose.yml up -d postgres redis
pnpm install
cp .env.example .env
pnpm db:generate
pnpm db:migrate
pnpm start:dev
```

Run checks from `webhook-service/`:

```bash
pnpm test
pnpm test:e2e
pnpm test:cov
```

See the [service README](./webhook-service/README.md) for API routes, configuration, retries, worker concurrency, and signing details.

## Current security limits

This is a challenge and local-development implementation. It does not authenticate the management or event-ingestion APIs, block private-network webhook destinations or defend against DNS rebinding, cap response bytes before storing them, or use timestamped signatures. Do not expose it to untrusted callers or use it as a production webhook platform without addressing these gaps.
