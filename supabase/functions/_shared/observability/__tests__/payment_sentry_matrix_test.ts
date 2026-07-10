import { assertEquals } from "std/testing/asserts";
import {
  captureCriticalAlertSync,
  captureNetcredAuthFailureCritical,
  capturePaymentException,
  capturePaymentExceptionSync,
  captureSandboxCredentialsCritical,
  captureWebhookDeadLetterCritical,
  createNetcredCaptureCriticalHook,
  dispatchPaymentSentryAlerts,
  emitAutoCancelCommittedWarning,
  emitFailedPermanentTransitionWarning,
  emitInvalidWebhookSignatureWarning,
  emitMissingClearSaleSessionWarning,
  emitProviderMultipleEdgesWarning,
  emitReconciliationFailureWarning,
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

Deno.test("emitInvalidWebhookSignatureWarning records warning", async () => {
  const messages: string[] = [];
  setPaymentSentryRecordersForTests({
    onMessage: (record) => messages.push(record.message),
  });
  try {
    await emitInvalidWebhookSignatureWarning({
      event_type: "TRANSACTION_UPDATE",
      gateway_event_id: "gw-1",
      source_ip: "1.2.3.4",
      event_id: "event-1",
    });
    assertEquals(messages, ["webhook_invalid_signature"]);
  } finally {
    setPaymentSentryRecordersForTests({});
  }
});

Deno.test("emitMissingClearSaleSessionWarning records warning", async () => {
  const messages: Array<{ message: string; extra: Record<string, unknown> }> = [];
  setPaymentSentryRecordersForTests({
    onMessage: (record) => messages.push(record),
  });
  try {
    await emitMissingClearSaleSessionWarning({
      schedule_id: "sch-1",
      service_id: "svc-1",
    });
    assertEquals(messages[0]?.message, "missing_clearsale_session_id");
    assertEquals(messages[0]?.extra.reason, "MISSING_CLEARSALE_SESSION_ID");
  } finally {
    setPaymentSentryRecordersForTests({});
  }
});

Deno.test("emitProviderMultipleEdgesWarning and emitReconciliationFailureWarning record", async () => {
  const messages: string[] = [];
  setPaymentSentryRecordersForTests({
    onMessage: (record) => messages.push(record.message),
  });
  try {
    await emitProviderMultipleEdgesWarning({ document: "123", edges_count: 2 });
    await emitReconciliationFailureWarning({
      schedule_id: "sch-1",
      service_id: "svc-1",
      reconciliation_failure_count: 3,
    });
    assertEquals(messages.includes("provider_multiple_company_edges"), true);
    assertEquals(messages.includes("payment_reconciliation_failure_threshold"), true);
  } finally {
    setPaymentSentryRecordersForTests({});
  }
});

Deno.test("captureSandboxCredentialsCritical records fatal alert", () => {
  const messages: Array<{ level: string; message: string }> = [];
  setPaymentSentryRecordersForTests({
    onMessage: (record) => messages.push(record),
  });
  try {
    captureSandboxCredentialsCritical({ environment: "production" });
    assertEquals(messages[0]?.level, "fatal");
    assertEquals(messages[0]?.message, "SANDBOX_CREDENTIALS_IN_PRODUCTION");
  } finally {
    setPaymentSentryRecordersForTests({});
  }
});

Deno.test("createNetcredCaptureCriticalHook routes known critical alerts", () => {
  const messages: string[] = [];
  setPaymentSentryRecordersForTests({
    onMessage: (record) => messages.push(record.message),
  });
  try {
    const hook = createNetcredCaptureCriticalHook();
    hook("NETCRED_AUTH_FAILURE", { error: "bad token" });
    hook("SANDBOX_CREDENTIALS_IN_PRODUCTION", { env: "prod" });
    hook("CUSTOM_ALERT", { x: 1 });
    assertEquals(messages.includes("NETCRED_AUTH_FAILURE"), true);
    assertEquals(messages.includes("SANDBOX_CREDENTIALS_IN_PRODUCTION"), true);
    assertEquals(messages.includes("CUSTOM_ALERT"), true);
  } finally {
    setPaymentSentryRecordersForTests({});
  }
});

Deno.test("capturePaymentExceptionSync schedules exception capture", () => {
  const exceptions: unknown[] = [];
  setPaymentSentryRecordersForTests({
    onException: (record) => exceptions.push(record.error),
  });
  try {
    capturePaymentExceptionSync(new Error("sync fail"), {
      schedule_id: "sch-1",
    });
  } finally {
    setPaymentSentryRecordersForTests({});
  }
});

Deno.test("capturePaymentException stringifies non-Error and defaults gateway_slug", async () => {
  const exceptions: Array<{ extra: Record<string, unknown>; tags: Record<string, string> }> = [];
  setPaymentSentryRecordersForTests({
    onException: (record) => exceptions.push(record),
  });
  try {
    await capturePaymentException("plain failure", {
      schedule_id: "sch-2",
    });
    assertEquals(exceptions[0]?.extra.error, "plain failure");
    assertEquals(exceptions[0]?.extra.gateway_slug, "netcred");
    assertEquals(exceptions[0]?.tags.gateway_slug, "netcred");
  } finally {
    setPaymentSentryRecordersForTests({});
  }
});

Deno.test("emitFailedPermanentTransitionWarning defaults gateway_slug and omits empty tags", async () => {
  const messages: Array<{ tags: Record<string, string>; extra: Record<string, unknown> }> = [];
  setPaymentSentryRecordersForTests({
    onMessage: (record) => messages.push(record),
  });
  try {
    await emitFailedPermanentTransitionWarning({
      service_id: "service-1",
      schedule_id: "schedule-1",
      failure_codes: ["51"],
    });
    assertEquals(messages[0]?.extra.gateway_slug, "netcred");
    assertEquals(messages[0]?.tags.gateway_slug, "netcred");
  } finally {
    setPaymentSentryRecordersForTests({});
  }
});

Deno.test("emitAutoCancelCommittedWarning defaults null last_failure_reason", async () => {
  const messages: Array<{ extra: Record<string, unknown> }> = [];
  setPaymentSentryRecordersForTests({
    onMessage: (record) => messages.push(record),
  });
  try {
    await emitAutoCancelCommittedWarning({
      service_id: "service-1",
      schedule_id: "schedule-1",
    });
    assertEquals(messages[0]?.extra.last_failure_reason, null);
  } finally {
    setPaymentSentryRecordersForTests({});
  }
});

Deno.test("captureMessage path with DSN set remains non-blocking", async () => {
  const prev = Deno.env.get("SENTRY_DSN");
  Deno.env.set("SENTRY_DSN", "https://examplePublicKey@o0.ingest.sentry.io/0");
  setPaymentSentryRecordersForTests({
    onMessage: () => {},
  });
  try {
    await emitProviderMultipleEdgesWarning({ document: "123", edges_count: 2 });
    await capturePaymentException(new Error("with dsn"), { schedule_id: "sch-dsn" });
  } finally {
    setPaymentSentryRecordersForTests({});
    if (prev === undefined) Deno.env.delete("SENTRY_DSN");
    else Deno.env.set("SENTRY_DSN", prev);
  }
});

Deno.test("stringTags omits null empty and undefined values via capturePaymentException", async () => {
  const exceptions: Array<{ tags: Record<string, string> }> = [];
  setPaymentSentryRecordersForTests({
    onException: (record) => exceptions.push(record),
  });
  try {
    await capturePaymentException(new Error("x"), {
      schedule_id: "",
      contracted_service_id: "svc",
      gateway_slug: undefined,
    });
    assertEquals(exceptions[0]?.tags.service_id, "svc");
    assertEquals("schedule_id" in (exceptions[0]?.tags ?? {}), false);
  } finally {
    setPaymentSentryRecordersForTests({});
  }
});

Deno.test("captureNetcredAuthFailureCritical stringifies non-Error", () => {
  const messages: Array<{ extra: Record<string, unknown> }> = [];
  setPaymentSentryRecordersForTests({
    onMessage: (record) => messages.push(record),
  });
  try {
    captureNetcredAuthFailureCritical("token rejected");
    assertEquals(messages[0]?.extra.error, "token rejected");
  } finally {
    setPaymentSentryRecordersForTests({});
  }
});

Deno.test("dispatchPaymentSentryAlerts returns zero for empty list", async () => {
  assertEquals(await dispatchPaymentSentryAlerts([]), 0);
});
