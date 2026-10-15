-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "webhook_event_type" AS ENUM ('PAYMENT_COMPLETED');

-- CreateEnum
CREATE TYPE "webhook_status" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "webhook_attempt_status" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "webhook_failure_reason" AS ENUM ('TIMEOUT', 'NETWORK_ERROR', 'HTTP_ERROR', 'INVALID_RESPONSE', 'INTERNAL_ERROR');

-- CreateTable
CREATE TABLE "webhook_subscriptions" (
    "id" UUID NOT NULL,
    "event_type" "webhook_event_type" NOT NULL,
    "endpoint" VARCHAR(2048) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "webhook_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL,
    "source_event_id" VARCHAR(255) NOT NULL,
    "event_type" "webhook_event_type" NOT NULL,
    "payload" JSONB NOT NULL,
    "occurred_at" TIMESTAMPTZ(6),
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhooks" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "event_type" "webhook_event_type" NOT NULL,
    "endpoint" VARCHAR(2048) NOT NULL,
    "status" "webhook_status" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "failure_reason" TEXT,
    "next_attempt_at" TIMESTAMPTZ(6),
    "last_attempt_at" TIMESTAMPTZ(6),
    "succeeded_at" TIMESTAMPTZ(6),
    "processing_started_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" UUID NOT NULL,
    "webhook_id" UUID NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "endpoint_audit" VARCHAR(2048) NOT NULL,
    "status" "webhook_attempt_status" NOT NULL DEFAULT 'PENDING',
    "failure_reason" "webhook_failure_reason",
    "failure_details" TEXT,
    "client_http_status" INTEGER,
    "response_body" TEXT,
    "duration_ms" INTEGER,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_messages" (
    "id" UUID NOT NULL,
    "webhook_id" UUID NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "outbox_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "webhook_subscriptions_event_type_is_active_deleted_at_idx" ON "webhook_subscriptions"("event_type", "is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "webhook_subscriptions_created_at_idx" ON "webhook_subscriptions"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_source_event_id_key" ON "webhook_events"("source_event_id");

-- CreateIndex
CREATE INDEX "webhook_events_event_type_received_at_idx" ON "webhook_events"("event_type", "received_at");

-- CreateIndex
CREATE INDEX "webhooks_status_next_attempt_at_idx" ON "webhooks"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "webhooks_subscription_id_created_at_idx" ON "webhooks"("subscription_id", "created_at");

-- CreateIndex
CREATE INDEX "webhooks_event_id_idx" ON "webhooks"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "webhooks_subscription_id_event_id_key" ON "webhooks"("subscription_id", "event_id");

-- CreateIndex
CREATE INDEX "webhook_deliveries_webhook_id_created_at_idx" ON "webhook_deliveries"("webhook_id", "created_at");

-- CreateIndex
CREATE INDEX "webhook_deliveries_status_started_at_idx" ON "webhook_deliveries"("status", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_deliveries_webhook_id_attempt_number_key" ON "webhook_deliveries"("webhook_id", "attempt_number");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_messages_webhook_id_key" ON "outbox_messages"("webhook_id");

-- CreateIndex
CREATE INDEX "outbox_messages_published_at_created_at_idx" ON "outbox_messages"("published_at", "created_at");

-- AddForeignKey
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "webhook_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "webhook_subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "webhooks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_messages" ADD CONSTRAINT "outbox_messages_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "webhooks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
