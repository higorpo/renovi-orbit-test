import { assertEquals } from "std/testing/asserts";
import {
  classifyChargeError,
  isTerminalGatewayState,
  isValidWebhookTransition,
  TERMINAL_STATES,
} from "../error-classification.ts";

Deno.test("classifyChargeError treats TERMINAL code as terminal", () => {
  assertEquals(
    classifyChargeError({ code: "TERMINAL", message: "rejected" }),
    "terminal",
  );
});

Deno.test("classifyChargeError treats AUTH_FAILURE as retryable", () => {
  assertEquals(
    classifyChargeError({ code: "AUTH_FAILURE", message: "auth" }),
    "retryable",
  );
});

Deno.test("classifyChargeError uses terminal gateway original codes", () => {
  assertEquals(
    classifyChargeError({
      code: "GATEWAY",
      message: "card rejected",
      originalCode: "REJECTED",
    }),
    "terminal",
  );
});

Deno.test("classifyChargeError defaults unknown errors to retryable", () => {
  assertEquals(
    classifyChargeError({ code: "TIMEOUT", message: "timeout" }),
    "retryable",
  );
});

Deno.test("isTerminalGatewayState matches TERMINAL_STATES set", () => {
  for (const state of TERMINAL_STATES) {
    assertEquals(isTerminalGatewayState(state), true);
  }
  assertEquals(isTerminalGatewayState("PROCESSING"), false);
  assertEquals(isTerminalGatewayState("IN_ANALYSIS"), false);
});

Deno.test("isValidWebhookTransition blocks leaving a terminal state", () => {
  assertEquals(isValidWebhookTransition("PAID", "REFUNDED"), false);
  assertEquals(isValidWebhookTransition("VOIDED", "PAID"), false);
});

Deno.test("isValidWebhookTransition allows same-state terminal updates", () => {
  assertEquals(isValidWebhookTransition("PAID", "PAID"), true);
});

Deno.test("isValidWebhookTransition allows non-terminal transitions", () => {
  assertEquals(isValidWebhookTransition("PROCESSING", "PAID"), true);
  assertEquals(isValidWebhookTransition("IN_ANALYSIS", "PAID"), true);
  assertEquals(isValidWebhookTransition("PROCESSING", "IN_ANALYSIS"), true);
});
