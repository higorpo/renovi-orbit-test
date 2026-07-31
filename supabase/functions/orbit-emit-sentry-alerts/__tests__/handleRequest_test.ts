import { assertEquals } from "std/testing/asserts";
import {
  handleOrbitEmitSentryAlertsRequest,
  type OrbitEmitSentryAlertsDeps,
} from "../handleRequest.ts";

function createRequest(
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  return new Request("https://example.com/orbit-emit-sentry-alerts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

Deno.test("rejects requests without orbit cron auth", async () => {
  const response = await handleOrbitEmitSentryAlertsRequest(
    createRequest({ alerts: [] }),
    { dispatchAlerts: async () => 0 },
  );

  assertEquals(response.status, 401);
});

Deno.test("accepts X-Orbit-Cron-Secret from pg_net bridge", async () => {
  Deno.env.set("ORBIT_CRON_SECRET", "orbit-cron-secret");

  try {
    const response = await handleOrbitEmitSentryAlertsRequest(
      createRequest({ alerts: [] }, { "X-Orbit-Cron-Secret": "orbit-cron-secret" }),
      { dispatchAlerts: async () => 0 },
    );

    assertEquals(response.status, 200);
  } finally {
    Deno.env.delete("ORBIT_CRON_SECRET");
  }
});

Deno.test("dispatches payment kind alerts from cron bridge payload", async () => {
  const prev = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");

  const dispatchedKinds: string[] = [];

  try {
    const deps: OrbitEmitSentryAlertsDeps = {
      dispatchAlerts: async (alerts) => {
        for (const alert of alerts) {
          if ("kind" in alert && typeof alert.kind === "string") {
            dispatchedKinds.push(alert.kind);
          }
        }
        return alerts.length;
      },
    };

    const response = await handleOrbitEmitSentryAlertsRequest(
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

Deno.test("dispatches generic level+message alerts", async () => {
  Deno.env.set("ORBIT_CRON_SECRET", "orbit-cron-secret");

  const received: unknown[] = [];

  try {
    const response = await handleOrbitEmitSentryAlertsRequest(
      createRequest({
        alerts: [
          {
            level: "fatal",
            code: "FAR_RESCHEDULE_RECAPTURE_STALE",
            message: "2 far-recapture pending older than 15 minutes",
            count: 2,
          },
        ],
      }, { "X-Orbit-Cron-Secret": "orbit-cron-secret" }),
      {
        dispatchAlerts: async (alerts) => {
          received.push(...alerts);
          return alerts.length;
        },
      },
    );

    const body = await response.json();
    assertEquals(response.status, 200);
    assertEquals(body.received, 1);
    assertEquals(body.dispatched, 1);
    assertEquals(
      (received[0] as { code?: string }).code,
      "FAR_RESCHEDULE_RECAPTURE_STALE",
    );
  } finally {
    Deno.env.delete("ORBIT_CRON_SECRET");
  }
});

Deno.test("OPTIONS returns 204", async () => {
  const response = await handleOrbitEmitSentryAlertsRequest(
    new Request("https://example.com/orbit-emit-sentry-alerts", {
      method: "OPTIONS",
    }),
    { dispatchAlerts: async () => 0 },
  );
  assertEquals(response.status, 204);
});

Deno.test("non-POST returns 405", async () => {
  Deno.env.set("ORBIT_CRON_SECRET", "orbit-cron-secret");
  try {
    const response = await handleOrbitEmitSentryAlertsRequest(
      new Request("https://example.com/orbit-emit-sentry-alerts", {
        method: "GET",
        headers: { "X-Orbit-Cron-Secret": "orbit-cron-secret" },
      }),
      { dispatchAlerts: async () => 0 },
    );
    assertEquals(response.status, 405);
  } finally {
    Deno.env.delete("ORBIT_CRON_SECRET");
  }
});

Deno.test("invalid JSON returns 400", async () => {
  Deno.env.set("ORBIT_CRON_SECRET", "orbit-cron-secret");
  try {
    const response = await handleOrbitEmitSentryAlertsRequest(
      new Request("https://example.com/orbit-emit-sentry-alerts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Orbit-Cron-Secret": "orbit-cron-secret",
        },
        body: "{bad",
      }),
      { dispatchAlerts: async () => 0 },
    );
    assertEquals(response.status, 400);
    const body = await response.json();
    assertEquals(body.error, "invalid_json");
  } finally {
    Deno.env.delete("ORBIT_CRON_SECRET");
  }
});

Deno.test("missing or non-array alerts defaults to empty list", async () => {
  Deno.env.set("ORBIT_CRON_SECRET", "orbit-cron-secret");
  try {
    const response = await handleOrbitEmitSentryAlertsRequest(
      createRequest({ alerts: "nope" }, {
        "X-Orbit-Cron-Secret": "orbit-cron-secret",
      }),
      { dispatchAlerts: async (alerts) => alerts.length },
    );
    const body = await response.json();
    assertEquals(response.status, 200);
    assertEquals(body.received, 0);
    assertEquals(body.dispatched, 0);
  } finally {
    Deno.env.delete("ORBIT_CRON_SECRET");
  }
});

Deno.test("null body parses as empty alerts", async () => {
  Deno.env.set("ORBIT_CRON_SECRET", "orbit-cron-secret");
  try {
    const response = await handleOrbitEmitSentryAlertsRequest(
      createRequest(null, {
        "X-Orbit-Cron-Secret": "orbit-cron-secret",
      }),
      { dispatchAlerts: async (alerts) => alerts.length },
    );
    const body = await response.json();
    assertEquals(response.status, 200);
    assertEquals(body.received, 0);
  } finally {
    Deno.env.delete("ORBIT_CRON_SECRET");
  }
});
