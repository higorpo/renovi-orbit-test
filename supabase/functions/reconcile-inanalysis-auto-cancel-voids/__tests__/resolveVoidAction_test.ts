import { assertEquals } from "std/testing/asserts";
import { resolveVoidGatewayAction } from "../resolveVoidAction.ts";

Deno.test("resolveVoidGatewayAction voids IN_ANALYSIS and SCHEDULED charges", () => {
  assertEquals(resolveVoidGatewayAction("IN_ANALYSIS"), "void");
  assertEquals(resolveVoidGatewayAction("SCHEDULED"), "void");
});

Deno.test("resolveVoidGatewayAction defers when gateway already captured", () => {
  assertEquals(resolveVoidGatewayAction("PAID"), "defer_captured");
});

Deno.test("resolveVoidGatewayAction treats terminal gateway states as reconciled", () => {
  assertEquals(resolveVoidGatewayAction("VOIDED"), "already_terminal");
  assertEquals(resolveVoidGatewayAction("REJECTED"), "already_terminal");
  assertEquals(resolveVoidGatewayAction("REFUNDED"), "already_terminal");
});

Deno.test("resolveVoidGatewayAction retries when gateway state is missing", () => {
  assertEquals(resolveVoidGatewayAction(null), "retry");
  assertEquals(resolveVoidGatewayAction(undefined), "retry");
});
