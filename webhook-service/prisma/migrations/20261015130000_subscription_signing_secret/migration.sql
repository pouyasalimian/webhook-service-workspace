ALTER TABLE "webhook_subscriptions"
ADD COLUMN "signing_secret" VARCHAR(64)
NOT NULL
DEFAULT (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''));

ALTER TABLE "webhook_subscriptions"
ALTER COLUMN "signing_secret" DROP DEFAULT;
