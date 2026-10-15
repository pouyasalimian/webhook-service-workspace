import "dotenv/config";
import { createHmac, timingSafeEqual } from "node:crypto";
import express from "express";

const port = Number(process.env.PORT ?? 4000);
const secret = process.env.WEBHOOK_SIGNING_SECRET;

if (!secret) {
  throw new Error("Set WEBHOOK_SIGNING_SECRET to the subscription secret");
}

const app = express();

app.post(
  "/webhooks",
  express.raw({ type: "application/json", limit: "1mb" }),
  (req, res) => {
    if (!Buffer.isBuffer(req.body)) {
      return res.status(400).send("Expected an application/json request body");
    }

    const header = req.get("x-webhook-signature") ?? "";
    const match = /^sha256=([a-f0-9]{64})$/.exec(header);
    if (!match) {
      return res.status(401).send("Missing or malformed webhook signature");
    }

    const expected = createHmac("sha256", secret).update(req.body).digest();
    const received = Buffer.from(match[1], "hex");
    if (
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    ) {
      return res.status(401).send("Invalid webhook signature");
    }

    try {
      const event = JSON.parse(req.body.toString("utf8"));
      console.log("Verified webhook:", event);
      return res.status(200).json({ received: true });
    } catch {
      return res.status(400).send("Invalid JSON body");
    }
  },
);

app.listen(port, () => {
  console.log(
    `Webhook receiver listening at http://localhost:${port}/webhooks`,
  );
});
