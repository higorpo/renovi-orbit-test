import { assertEquals } from "std/testing/asserts";
import {
  buildDeliveryReportPayload,
  buildPushDeliveryReportPayload,
} from "../report.ts";

Deno.test("buildDeliveryReportPayload maps checkout deliveries to sent outcomes", () => {
  const payload = buildDeliveryReportPayload([
    {
      delivery_id: "550e8400-e29b-41d4-a716-446655440000",
      device_id: "device-1",
      fcm_token_snapshot: "token",
    },
  ]);

  assertEquals(payload?.length, 1);
  assertEquals(payload?.[0].outcome, "sent");
});

Deno.test("buildPushDeliveryReportPayload maps mixed fan-out outcomes", () => {
  const payload = buildPushDeliveryReportPayload([
    {
      delivery: {
        delivery_id: "550e8400-e29b-41d4-a716-446655440001",
        device_id: "device-ok",
        fcm_token_snapshot: "token-ok",
      },
      ok: true,
      httpStatus: 200,
    },
    {
      delivery: {
        delivery_id: "550e8400-e29b-41d4-a716-446655440002",
        device_id: "device-bad",
        fcm_token_snapshot: "token-bad",
      },
      ok: false,
      httpStatus: 404,
      errorCode: "NOT_FOUND",
    },
  ]);

  assertEquals(payload?.length, 2);
  assertEquals(payload?.[0].outcome, "sent");
  assertEquals(payload?.[1].outcome, "failed_terminal");
  assertEquals(payload?.[1].vendor_error_code, "invalid_token");
});
