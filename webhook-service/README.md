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
