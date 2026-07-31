import { assertEquals } from "std/testing/asserts";
import {
  dispatchOrbitSentryAlerts,
  emitGenericSentryAlert,
  isGenericSentryAlert,
  isPaymentSentryAlert,
  mapGenericSentryLevel,
  setGenericSentryRecordersForTests,
} from "../generic-sentry-alerts.ts";
import {
  setPaymentSentryRecordersForTests,
} from "../payment-sentry-matrix.ts";

Deno.test("mapGenericSentryLevel maps CRITICAL/critical/fatal to fatal", () => {
  assertEquals(mapGenericSentryLevel("CRITICAL"), "fatal");
  assertEquals(mapGenericSentryLevel("critical"), "fatal");
  assertEquals(mapGenericSentryLevel("fatal"), "fatal");
  assertEquals(mapGenericSentryLevel("FATAL"), "fatal");
  assertEquals(mapGenericSentryLevel("warning"), "warning");
  assertEquals(mapGenericSentryLevel("info"), "warning");
});

Deno.test("isPaymentSentryAlert / isGenericSentryAlert discriminate shapes", () => {
  assertEquals(
    isPaymentSentryAlert({
      kind: "auto_cancel",
      service_id: "s1",
      schedule_id: "sch1",
    }),
    true,
  );
  assertEquals(
    isGenericSentryAlert({
      level: "fatal",
      message: "stale",
      code: "FAR_RESCHEDULE_RECAPTURE_STALE",
      count: 2,
    }),
    true,
  );
  assertEquals(isPaymentSentryAlert({ level: "fatal", message: "x" }), false);
  assertEquals(isGenericSentryAlert({ kind: "auto_cancel" }), false);
  assertEquals(isGenericSentryAlert({ level: "fatal", message: "" }), false);
});

Deno.test("emitGenericSentryAlert records fatal with code tag and count extra", async () => {
  const messages: Array<{
    level: string;
    message: string;
    tags: Record<string, string>;
    extra: Record<string, unknown>;
  }> = [];

  setGenericSentryRecordersForTests({
    onMessage: (record) => messages.push(record),
  });

  try {
    Deno.env.delete("SENTRY_DSN");
    await emitGenericSentryAlert({
      level: "CRITICAL",
      code: "FAR_RESCHEDULE_RECAPTURE_STALE",
      message: "2 far-recapture pending older than 15 minutes",
      count: 2,
    });

    assertEquals(messages.length, 1);
    assertEquals(messages[0]?.level, "fatal");
    assertEquals(
      messages[0]?.message,
      "2 far-recapture pending older than 15 minutes",
    );
    assertEquals(messages[0]?.tags.code, "FAR_RESCHEDULE_RECAPTURE_STALE");
    assertEquals(messages[0]?.extra.count, 2);
  } finally {
    setGenericSentryRecordersForTests({});
  }
});

Deno.test("dispatchOrbitSentryAlerts routes kind and generic payloads", async () => {
  const paymentMessages: Array<{ message: string }> = [];
  const genericMessages: Array<{ message: string; level: string }> = [];

  setPaymentSentryRecordersForTests({
    onMessage: (record) => paymentMessages.push(record),
  });
  setGenericSentryRecordersForTests({
    onMessage: (record) => genericMessages.push(record),
  });

  try {
    Deno.env.delete("SENTRY_DSN");
    const dispatched = await dispatchOrbitSentryAlerts([
      {
        kind: "auto_cancel",
        service_id: "service-1",
        schedule_id: "schedule-1",
      },
      {
        level: "fatal",
        code: "FAR_RESCHEDULE_RECAPTURE_STALE",
        message: "1 far-recapture pending older than 15 minutes",
        count: 1,
      },
      { nonsense: true },
    ]);

    assertEquals(dispatched, 2);
    assertEquals(paymentMessages.length, 1);
    assertEquals(paymentMessages[0]?.message, "payment_service_auto_cancelled");
    assertEquals(genericMessages.length, 1);
    assertEquals(genericMessages[0]?.level, "fatal");
  } finally {
    setPaymentSentryRecordersForTests({});
    setGenericSentryRecordersForTests({});
  }
});
