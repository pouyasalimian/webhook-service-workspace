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

If the API runs directly on the host, create a subscription with `http://localhost:4000/webhooks` as its endpoint. If the API runs in Docker Compose while this receiver runs on the host, use `http://host.docker.internal:4000/webhooks`; the Compose service maps that hostname to the host gateway for Linux as well. Copy the returned `signingSecret` into this app's `.env` as `WEBHOOK_SIGNING_SECRET`, start the receiver, then submit a payment event. The receiver responds with `200` and prints the event when its signature is valid; a missing or invalid signature receives `401`.

The receiver reads the body as raw bytes before parsing JSON, computes `HMAC-SHA256(secret, rawBody)`, and uses a constant-time comparison. This is important: parsing and re-serializing JSON can change the bytes and invalidate a correct signature.
