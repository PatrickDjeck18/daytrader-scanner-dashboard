import { describe, expect, it, vi } from "vitest";
import { createFinnhubWebhookHandler, isValidFinnhubWebhookSecret } from "./finnhub-webhook";

const describeWhenWebhookIsConfigured = process.env.FINNHUB_WEBHOOK_SECRET ? describe : describe.skip;

function responseMock() {
  return { status: vi.fn().mockReturnThis(), end: vi.fn() };
}

describeWhenWebhookIsConfigured("Finnhub webhook secret", () => {
  it("accepts the configured server-side secret", () => {
    const configured = process.env.FINNHUB_WEBHOOK_SECRET;
    expect(configured).toBeTruthy();
    expect(isValidFinnhubWebhookSecret(configured ?? "")).toBe(true);
  });

  it("rejects missing, incorrect, and length-mismatched secrets", () => {
    expect(isValidFinnhubWebhookSecret(undefined)).toBe(false);
    expect(isValidFinnhubWebhookSecret("incorrect-secret")).toBe(false);
    expect(isValidFinnhubWebhookSecret("x".repeat(64))).toBe(false);
  });

  it("acknowledges an authenticated webhook without processing its payload", () => {
    const response = responseMock();
    const request = { get: vi.fn().mockReturnValue(process.env.FINNHUB_WEBHOOK_SECRET), body: { event: "opaque" } };
    createFinnhubWebhookHandler()(request as never, response as never);
    expect(response.status).toHaveBeenCalledWith(204);
    expect(response.end).toHaveBeenCalledOnce();
  });

  it("rejects an unauthenticated webhook without acknowledging it", () => {
    const response = responseMock();
    const request = { get: vi.fn().mockReturnValue("wrong-secret") };
    createFinnhubWebhookHandler()(request as never, response as never);
    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.end).toHaveBeenCalledOnce();
  });
});
