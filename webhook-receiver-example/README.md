# Webhook receiver example

Small Express app that receives a webhook and verifies the `X-Webhook-Signature` HMAC-SHA256 header using the raw JSON request body.

## Run it

```bash
cd webhook-receiver-example
pnpm install
cp .env.example .env
# Set WEBHOOK_SIGNING_SECRET in .env to the value returned when creating the subscription.
pnpm start
```

Create a subscription in `webhook-service` using `http://localhost:4000/webhooks` as its endpoint. Copy the `signingSecret` from the create response into `WEBHOOK_SIGNING_SECRET`, then submit a payment event. The receiver responds with `200` and prints the event when its signature is valid; a missing or invalid signature receives `401`.

The receiver reads the body as raw bytes before parsing JSON, computes `HMAC-SHA256(secret, rawBody)`, and uses a constant-time comparison. This is important: parsing and re-serializing JSON can change the bytes and invalidate a correct signature.
