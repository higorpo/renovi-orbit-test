import { assertEquals, assertRejects } from "std/testing/asserts";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildFailedDeliveryReportPayload,
  reportDeliveryOutcome,
} from "../report.ts";

function mockSupabaseReport(
  response: { data: unknown; error: { message: string } | null },
): SupabaseClient {
  return {
    schema: () => ({
      rpc: async (name: string, args: Record<string, unknown>) => {
        assertEquals(name, "message_dispatcher_report_delivery_outcome");
        return response;
      },
    }),
  } as unknown as SupabaseClient;
}

Deno.test("reportDeliveryOutcome returns applied result on RPC success", async () => {
  const supabase = mockSupabaseReport({
    data: { applied: true, status: "DELIVERED", reason: null },
    error: null,
  });

  const result = await reportDeliveryOutcome(supabase, {
    dispatchId: "d-1",
    workerId: "w-1",
    channel: "email",
    success: true,
    vendorMessageId: "re_123",
    httpStatus: 200,
  });

  assertEquals(result.applied, true);
  assertEquals(result.status, "DELIVERED");
});

Deno.test("reportDeliveryOutcome returns not-applied with reason", async () => {
  const supabase = mockSupabaseReport({
    data: { applied: false, status: "PROCESSING", reason: "stale_worker_lock" },
    error: null,
  });

  const result = await reportDeliveryOutcome(supabase, {
    dispatchId: "d-2",
    workerId: "w-stale",
    channel: "push",
    success: true,
    httpStatus: 200,
  });

  assertEquals(result.applied, false);
  assertEquals(result.reason, "stale_worker_lock");
});

Deno.test("reportDeliveryOutcome throws on RPC error", async () => {
  const supabase = mockSupabaseReport({
    data: null,
    error: { message: "dispatch_not_found" },
  });

  await assertRejects(
    () =>
      reportDeliveryOutcome(supabase, {
        dispatchId: "d-missing",
        workerId: "w-1",
        channel: "email",
        success: false,
        httpStatus: 500,
        errorCode: "provider_error",
        retryable: true,
      }),
    Error,
    "report_delivery_outcome failed: dispatch_not_found",
  );
});

Deno.test("reportDeliveryOutcome passes deliveries array to RPC", async () => {
  let capturedArgs: Record<string, unknown> | undefined;
  const supabase = {
    schema: () => ({
      rpc: async (_name: string, args: Record<string, unknown>) => {
        capturedArgs = args;
        return { data: { applied: true, status: "DELIVERED" }, error: null };
      },
    }),
  } as unknown as SupabaseClient;

  await reportDeliveryOutcome(supabase, {
    dispatchId: "d-push",
    workerId: "w-1",
    channel: "push",
    success: true,
    httpStatus: 200,
    deliveries: [
      { delivery_id: "del-1", device_id: "dev-1", outcome: "sent", vendor_error_code: null },
      { delivery_id: "del-2", device_id: "dev-2", outcome: "failed_terminal", vendor_error_code: "invalid_token" },
    ],
  });

  const deliveries = capturedArgs?.p_deliveries as Array<Record<string, unknown>>;
  assertEquals(deliveries?.length, 2);
  assertEquals(deliveries?.[0]?.outcome, "sent");
  assertEquals(deliveries?.[1]?.outcome, "failed_terminal");
});

// --- buildFailedDeliveryReportPayload ---

Deno.test("buildFailedDeliveryReportPayload maps all deliveries to failed outcome", () => {
  const payload = buildFailedDeliveryReportPayload(
    [
      { delivery_id: "del-1", device_id: "dev-1", fcm_token_snapshot: "tok-1" },
      { delivery_id: "del-2", device_id: "dev-2", fcm_token_snapshot: "tok-2" },
    ],
    "invalid_token",
    "failed_terminal",
  );

  assertEquals(payload?.length, 2);
  assertEquals(payload?.[0].outcome, "failed_terminal");
  assertEquals(payload?.[0].vendor_error_code, "invalid_token");
  assertEquals(payload?.[1].outcome, "failed_terminal");
});

Deno.test("buildFailedDeliveryReportPayload defaults to failed_terminal", () => {
  const payload = buildFailedDeliveryReportPayload(
    [{ delivery_id: "del-1", device_id: "dev-1", fcm_token_snapshot: "tok-1" }],
    "fcm_timeout",
  );

  assertEquals(payload?.[0].outcome, "failed_terminal");
  assertEquals(payload?.[0].vendor_error_code, "fcm_timeout");
});

Deno.test("buildFailedDeliveryReportPayload supports retryable outcome", () => {
  const payload = buildFailedDeliveryReportPayload(
    [{ delivery_id: "del-1", device_id: "dev-1", fcm_token_snapshot: "tok-1" }],
    "rate_limit_exceeded",
    "failed_retryable",
  );

  assertEquals(payload?.[0].outcome, "failed_retryable");
});
