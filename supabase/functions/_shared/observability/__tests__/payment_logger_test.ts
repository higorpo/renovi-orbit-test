import { assertEquals } from "std/testing/asserts";
import {
  PAYMENT_LOG_EVENTS,
  buildPaymentLogContext,
  buildWebhookLogContext,
  createPaymentLogger,
  sanitizePaymentLogContext,
} from "../payment-logger.ts";

Deno.test("sanitizePaymentLogContext strips blocked sensitive keys", () => {
  const sanitized = sanitizePaymentLogContext({
    service_id: "svc-1",
    cardNumber: "4111111111111111",
    cvv: "123",
    token: "secret",
    password: "x",
    authorization: "Bearer x",
    rawBody: "{}",
    pan: "4111",
    card_number: "4111",
    billingAddress: { street: "x" },
    safe: true,
  });

  assertEquals(sanitized.service_id, "svc-1");
  assertEquals(sanitized.safe, true);
  assertEquals("cardNumber" in sanitized, false);
  assertEquals("cvv" in sanitized, false);
  assertEquals("token" in sanitized, false);
  assertEquals("password" in sanitized, false);
  assertEquals("authorization" in sanitized, false);
  assertEquals("rawBody" in sanitized, false);
  assertEquals("pan" in sanitized, false);
  assertEquals("card_number" in sanitized, false);
  assertEquals("billingAddress" in sanitized, false);
});

Deno.test("buildPaymentLogContext sets correlation_id from service_id", () => {
  const context = buildPaymentLogContext({
    service_id: "svc-1",
    schedule_id: "sch-1",
    gateway_slug: "netcred",
    error_code: "TIMEOUT",
    cardNumber: "should-strip",
  });

  assertEquals(context.service_id, "svc-1");
  assertEquals(context.correlation_id, "svc-1");
  assertEquals(context.schedule_id, "sch-1");
  assertEquals(context.gateway_slug, "netcred");
  assertEquals(context.error_code, "TIMEOUT");
  assertEquals("cardNumber" in context, false);
});

Deno.test("buildWebhookLogContext defaults gateway and correlation to event id", () => {
  const context = buildWebhookLogContext({
    event_type: "TRANSACTION_UPDATE",
    gateway_event_id: "gw-1",
    processing_duration_ms: 12,
    outcome: "processed",
  });

  assertEquals(context.event_type, "TRANSACTION_UPDATE");
  assertEquals(context.gateway_event_id, "gw-1");
  assertEquals(context.gateway_slug, "netcred");
  assertEquals(context.correlation_id, "gw-1");
  assertEquals(context.processing_duration_ms, 12);
  assertEquals(context.outcome, "processed");
});

Deno.test("buildWebhookLogContext prefers service_id as correlation_id", () => {
  const context = buildWebhookLogContext({
    event_type: "TRANSACTION_UPDATE",
    gateway_event_id: "gw-1",
    service_id: "svc-9",
  });
  assertEquals(context.correlation_id, "svc-9");
});

Deno.test("createPaymentLogger exposes wrapped log methods", () => {
  const logger = createPaymentLogger("payment-logger-test");
  logger.debug(PAYMENT_LOG_EVENTS.CHARGE_ATTEMPT_STARTED, {
    service_id: "svc-1",
    token: "secret",
  });
  logger.info(PAYMENT_LOG_EVENTS.WEBHOOK_RECEIVED, { gateway_event_id: "gw" });
  logger.warn(PAYMENT_LOG_EVENTS.CHARGE_ATTEMPT_FAILED, { error_code: "X" });
  logger.error(PAYMENT_LOG_EVENTS.CHARGE_ATTEMPT_FAILED, { error_code: "Y" });
  assertEquals(typeof logger.info, "function");
});
