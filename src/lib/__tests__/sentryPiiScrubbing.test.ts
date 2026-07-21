import { describe, expect, it } from "vitest";
import { scrubPiiData, scrubSentryEvent } from "../sentryPiiScrubbing";

describe("sentryPiiScrubbing", () => {
  it("redacts common PII fields", () => {
    expect(
      scrubPiiData({
        email: "user@example.com",
        chat_id: "chat-1",
        cep: "01310-100",
      }),
    ).toEqual({
      email: "[redacted]",
      chat_id: "chat-1",
      cep: "[redacted]",
    });
  });

  it("redacts nested CHD keys", () => {
    expect(
      scrubPiiData({
        request: {
          cardData: { cardNumber: "4111", securityCode: "123" },
          cpf: "03019758092",
          phone: "48999999999",
        },
        schedule_id: "sch-1",
      }),
    ).toEqual({
      request: {
        cardData: "[redacted]",
        cpf: "[redacted]",
        phone: "[redacted]",
      },
      schedule_id: "sch-1",
    });
  });

  it("does not redact operational message fields outside chat scrubbing", () => {
    expect(
      scrubPiiData({
        message: "request_quote.order_failed",
        reason: "exception",
      }),
    ).toEqual({
      message: "request_quote.order_failed",
      reason: "exception",
    });
  });

  it("scrubs PII from sentry error events", () => {
    const event = scrubSentryEvent({
      type: undefined,
      extra: { email: "user@example.com", service_request_id: "sr-1" },
    });

    expect(event.extra).toEqual({
      email: "[redacted]",
      service_request_id: "sr-1",
    });
  });
});
