import crypto from "node:crypto";
import type { Express, Request, Response } from "express";

const FINNHUB_SECRET_HEADER = "x-finnhub-secret";

export function isValidFinnhubWebhookSecret(received: string | undefined): boolean {
  const expected = process.env.FINNHUB_WEBHOOK_SECRET;
  if (!expected || !received) return false;
  const expectedBytes = Buffer.from(expected, "utf8");
  const receivedBytes = Buffer.from(received, "utf8");
  if (expectedBytes.length !== receivedBytes.length) return false;
  return crypto.timingSafeEqual(expectedBytes, receivedBytes);
}

export function createFinnhubWebhookHandler() {
  return (req: Request, res: Response) => {
    const receivedSecret = req.get(FINNHUB_SECRET_HEADER);
    if (!isValidFinnhubWebhookSecret(receivedSecret)) {
      res.status(401).end();
      return;
    }

    // Intentionally acknowledge before any future event processing. The current
    // release does not persist or trigger actions from webhook payloads.
    res.status(204).end();
  };
}

export function registerFinnhubWebhookRoute(app: Express): void {
  app.post("/api/webhooks/finnhub", createFinnhubWebhookHandler());
}
