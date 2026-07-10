import { assertEquals } from "std/testing/asserts";
import {
  handleReconcileInanalysisAutoCancelVoidsRequest,
  type ReconcileInanalysisAutoCancelVoidsDeps,
} from "../handleRequest.ts";
import type { InanalysisVoidSchedule } from "../types.ts";

function createDeps(
  overrides: Partial<ReconcileInanalysisAutoCancelVoidsDeps> = {},
): ReconcileInanalysisAutoCancelVoidsDeps {
  return {
    listPendingSchedules: async () => [],
    processSchedule: async () => ({
      scheduleId: "schedule-1",
      outcome: "SKIPPED",
    }),
    ...overrides,
  };
}

function cronRequest(): Request {
  return new Request("https://example.com/reconcile-inanalysis-auto-cancel-voids", {
    method: "POST",
    headers: { Authorization: "Bearer test-service-role" },
  });
}

const pendingSchedule: InanalysisVoidSchedule = {
  id: "schedule-1",
  contracted_service_id: "service-1",
  client_id: "client-1",
  provider_id: "provider-1",
  gateway_charge_id: "9001",
  gateway_transaction_id: "txn-1",
  netcred_company_id: "1048",
  reconciliation_failure_count: 0,
};

Deno.test("handleReconcileInanalysisAutoCancelVoidsRequest returns summary for voided row", async () => {
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");
  Deno.env.set("ENVIRONMENT", "development");
  try {
    const response = await handleReconcileInanalysisAutoCancelVoidsRequest(
      cronRequest(),
      createDeps({
        listPendingSchedules: async () => [pendingSchedule],
        processSchedule: async () => ({
          scheduleId: pendingSchedule.id,
          outcome: "VOIDED",
        }),
      }),
    );

    assertEquals(response.status, 200);
    const body = await response.json();
    assertEquals(body.processed, 1);
    assertEquals(body.voided, 1);
    assertEquals(body.failures, 0);
  } finally {
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    Deno.env.delete("ENVIRONMENT");
  }
});

Deno.test("handleReconcileInanalysisAutoCancelVoidsRequest rejects unauthorized requests", async () => {
  const response = await handleReconcileInanalysisAutoCancelVoidsRequest(
    new Request("https://example.com/reconcile-inanalysis-auto-cancel-voids", {
      method: "POST",
    }),
    createDeps(),
  );

  assertEquals(response.status, 401);
});

Deno.test("handleRequest OPTIONS returns 204 and non-POST returns 405", async () => {
  const options = await handleReconcileInanalysisAutoCancelVoidsRequest(
    new Request("https://example.com/reconcile-inanalysis-auto-cancel-voids", {
      method: "OPTIONS",
    }),
    createDeps(),
  );
  assertEquals(options.status, 204);

  const get = await handleReconcileInanalysisAutoCancelVoidsRequest(
    new Request("https://example.com/reconcile-inanalysis-auto-cancel-voids", {
      method: "GET",
    }),
    createDeps(),
  );
  assertEquals(get.status, 405);
});

Deno.test("handleRequest summary buckets deferred, already_terminal, failures and warnings", async () => {
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");
  Deno.env.set("ENVIRONMENT", "development");
  try {
    const schedules: InanalysisVoidSchedule[] = [
      { ...pendingSchedule, id: "s-deferred" },
      { ...pendingSchedule, id: "s-terminal" },
      { ...pendingSchedule, id: "s-fail" },
      { ...pendingSchedule, id: "s-throw" },
    ];

    const response = await handleReconcileInanalysisAutoCancelVoidsRequest(
      cronRequest(),
      createDeps({
        listPendingSchedules: async () => schedules,
        processSchedule: async (schedule) => {
          if (schedule.id === "s-deferred") {
            return { scheduleId: schedule.id, outcome: "DEFERRED" };
          }
          if (schedule.id === "s-terminal") {
            return { scheduleId: schedule.id, outcome: "ALREADY_TERMINAL" };
          }
          if (schedule.id === "s-fail") {
            return { scheduleId: schedule.id, outcome: "FAILURE", failureCount: 3 };
          }
          throw new Error("unexpected");
        },
      }),
    );

    assertEquals(response.status, 200);
    const body = await response.json();
    assertEquals(body.processed, 4);
    assertEquals(body.deferred, 1);
    assertEquals(body.already_terminal, 1);
    assertEquals(body.failures, 2);
    assertEquals(body.warnings_emitted, 2);
  } finally {
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    Deno.env.delete("ENVIRONMENT");
  }
});
