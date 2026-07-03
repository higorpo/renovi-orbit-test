import { assertEquals } from "std/testing/asserts";
import {
  handlePaymentEmitSentryAlertsRequest,
  type PaymentEmitSentryAlertsDeps,
} from "../handleRequest.ts";

function createRequest(
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  return new Request("https://example.com/payment-emit-sentry-alerts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

Deno.test("rejects requests without orbit cron auth", async () => {
  const response = await handlePaymentEmitSentryAlertsRequest(
    createRequest({ alerts: [] }),
    { dispatchAlerts: async () => 0 },
  );

  assertEquals(response.status, 401);
});

Deno.test("accepts X-Orbit-Cron-Secret from pg_net bridge", async () => {
  Deno.env.set("ORBIT_CRON_SECRET", "orbit-cron-secret");

  try {
    const response = await handlePaymentEmitSentryAlertsRequest(
      createRequest({ alerts: [] }, { "X-Orbit-Cron-Secret": "orbit-cron-secret" }),
      { dispatchAlerts: async () => 0 },
    );

    assertEquals(response.status, 200);
  } finally {
    Deno.env.delete("ORBIT_CRON_SECRET");
  }
});

Deno.test("dispatches alerts from cron bridge payload", async () => {
  const prev = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");

  const dispatchedKinds: string[] = [];

  try {
    const deps: PaymentEmitSentryAlertsDeps = {
      dispatchAlerts: async (alerts) => {
        for (const alert of alerts) {
          dispatchedKinds.push(alert.kind);
        }
        return alerts.length;
      },
    };

    const response = await handlePaymentEmitSentryAlertsRequest(
      createRequest({
        alerts: [
          {
            kind: "auto_cancel",
            service_id: "service-1",
            schedule_id: "schedule-1",
            last_failure_reason: "Declined",
          },
          {
            kind: "webhook_dead_letter",
            event_id: "event-1",
            event_type: "TRANSACTION_UPDATE",
            gateway_event_id: "gw-1",
            failure_reason: "timeout",
          },
        ],
      }, {
        Authorization: "Bearer test-service-role",
      }),
      deps,
    );

    const body = await response.json();
    assertEquals(response.status, 200);
    assertEquals(body.received, 2);
    assertEquals(body.dispatched, 2);
    assertEquals(dispatchedKinds, ["auto_cancel", "webhook_dead_letter"]);
  } finally {
    if (prev === undefined) {
      Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    } else {
      Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", prev);
    }
  }
});
