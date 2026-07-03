import { assertEquals } from "std/testing/asserts";
import {
  captureCriticalAlertSync,
  captureNetcredAuthFailureCritical,
  capturePaymentException,
  captureWebhookDeadLetterCritical,
  dispatchPaymentSentryAlerts,
  emitAutoCancelCommittedWarning,
  emitFailedPermanentTransitionWarning,
  setPaymentSentryRecordersForTests,
} from "../payment-sentry-matrix.ts";

Deno.test("emitFailedPermanentTransitionWarning records WARNING with failure_codes", async () => {
  const messages: Array<{ level: string; message: string; extra: Record<string, unknown> }> = [];

  setPaymentSentryRecordersForTests({
    onMessage: (record) => {
      messages.push(record);
    },
  });

  try {
    Deno.env.delete("SENTRY_DSN");
    await emitFailedPermanentTransitionWarning({
      service_id: "service-1",
      schedule_id: "schedule-1",
      gateway_slug: "netcred",
      failure_codes: ["51", "05"],
    });

    assertEquals(messages.length, 1);
    assertEquals(messages[0]?.level, "warning");
    assertEquals(messages[0]?.message, "payment_schedule_failed_permanent");
    assertEquals(messages[0]?.extra.failure_codes, ["51", "05"]);
  } finally {
    setPaymentSentryRecordersForTests({});
  }
});

Deno.test("captureNetcredAuthFailureCritical records AUTH_FAILURE as fatal", () => {
  const messages: Array<{ level: string; message: string; extra: Record<string, unknown> }> = [];

  setPaymentSentryRecordersForTests({
    onMessage: (record) => {
      messages.push(record);
    },
  });

  try {
    captureNetcredAuthFailureCritical(new Error("token rejected"), {
      operation: "tokenAuth",
    });

    assertEquals(messages.length, 1);
    assertEquals(messages[0]?.level, "fatal");
    assertEquals(messages[0]?.message, "NETCRED_AUTH_FAILURE");
    assertEquals(messages[0]?.extra.error_type, "AUTH_FAILURE");
    assertEquals(messages[0]?.extra.gateway_slug, "netcred");
  } finally {
    setPaymentSentryRecordersForTests({});
  }
});

Deno.test("captureWebhookDeadLetterCritical records WEBHOOK_DEAD_LETTER as fatal", () => {
  const messages: Array<{ level: string; message: string; extra: Record<string, unknown> }> = [];

  setPaymentSentryRecordersForTests({
    onMessage: (record) => {
      messages.push(record);
    },
  });

  try {
    captureWebhookDeadLetterCritical({
      event_id: "event-1",
      event_type: "TRANSACTION_UPDATE",
      gateway_event_id: "gw-1",
      failure_reason: "handler_timeout",
      retry_count: 3,
    });

    assertEquals(messages.length, 1);
    assertEquals(messages[0]?.message, "WEBHOOK_DEAD_LETTER");
    assertEquals(messages[0]?.extra.event_type, "TRANSACTION_UPDATE");
  } finally {
    setPaymentSentryRecordersForTests({});
  }
});

Deno.test("emitAutoCancelCommittedWarning records service and schedule context", async () => {
  const messages: Array<{ level: string; message: string; extra: Record<string, unknown> }> = [];

  setPaymentSentryRecordersForTests({
    onMessage: (record) => {
      messages.push(record);
    },
  });

  try {
    await emitAutoCancelCommittedWarning({
      service_id: "service-1",
      schedule_id: "schedule-1",
      last_failure_reason: "Insufficient funds",
    });

    assertEquals(messages[0]?.message, "payment_service_auto_cancelled");
    assertEquals(messages[0]?.extra.last_failure_reason, "Insufficient funds");
  } finally {
    setPaymentSentryRecordersForTests({});
  }
});

Deno.test("capturePaymentException records schedule correlation context", async () => {
  const exceptions: Array<{ extra: Record<string, unknown>; tags: Record<string, string> }> = [];

  setPaymentSentryRecordersForTests({
    onException: (record) => {
      exceptions.push(record);
    },
  });

  try {
    await capturePaymentException(new Error("charge failed"), {
      schedule_id: "schedule-1",
      contracted_service_id: "service-1",
      automatic_attempt_count: 2,
      gateway_slug: "netcred",
      current_state: "PROCESSING",
      error_code: "GATEWAY_TIMEOUT",
    });

    assertEquals(exceptions.length, 1);
    assertEquals(exceptions[0]?.extra.schedule_id, "schedule-1");
    assertEquals(exceptions[0]?.extra.automatic_attempt_count, 2);
    assertEquals(exceptions[0]?.tags.service_id, "service-1");
  } finally {
    setPaymentSentryRecordersForTests({});
  }
});

Deno.test("dispatchPaymentSentryAlerts routes auto_cancel and dead_letter alerts", async () => {
  const messages: string[] = [];

  setPaymentSentryRecordersForTests({
    onMessage: (record) => {
      messages.push(record.message);
    },
  });

  try {
    const dispatched = await dispatchPaymentSentryAlerts([
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
    ]);

    assertEquals(dispatched, 2);
    assertEquals(messages.includes("payment_service_auto_cancelled"), true);
    assertEquals(messages.includes("WEBHOOK_DEAD_LETTER"), true);
  } finally {
    setPaymentSentryRecordersForTests({});
  }
});

Deno.test("captureCriticalAlertSync is non-blocking without Sentry DSN", () => {
  const prev = Deno.env.get("SENTRY_DSN");
  Deno.env.delete("SENTRY_DSN");

  try {
    captureCriticalAlertSync("TEST_ALERT", { error_type: "AUTH_FAILURE" });
  } finally {
    if (prev !== undefined) {
      Deno.env.set("SENTRY_DSN", prev);
    }
  }
});
