import { assertEquals } from "std/testing/asserts";
import {
  handleProcessFarRescheduleRecaptureRequest,
  type ProcessFarRecaptureDeps,
} from "../handleRequest.ts";
import type {
  FarRecaptureCommitResult,
  FarRecapturePrepareResult,
} from "../types.ts";

const prepareReady: FarRecapturePrepareResult = {
  outcome: "ready",
  scheduleId: "schedule-1",
  contractedServiceId: "service-1",
  providerTransactionId: "tx-1",
  gatewayReferenceCode: "ref-1",
  refundAmount: "1024.29",
  alreadySubmitted: false,
  refundSubmitStatus: null,
};

const commitOk: FarRecaptureCommitResult = {
  outcome: "committed",
  scheduleId: "schedule-1",
  newScheduleId: "schedule-2",
  contractedServiceId: "service-1",
  refundAmount: "1024.29",
};

function createDeps(
  overrides: Partial<ProcessFarRecaptureDeps> = {},
): ProcessFarRecaptureDeps {
  return {
    prepare: async () => ({ ...prepareReady }),
    commitAfterGateway: async () => ({ ...commitOk }),
    markGatewayAcked: async () => {},
    refundTransaction: async () => ({ success: true }),
    captureCriticalError: () => {},
    ...overrides,
  };
}

function cronRequest(body: Record<string, unknown>): Request {
  return new Request("https://example.com/process-far-reschedule-recapture", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Orbit-Cron-Secret": "orbit-cron-secret",
    },
    body: JSON.stringify(body),
  });
}

Deno.test("rejects caller without internal auth", async () => {
  Deno.env.set("ORBIT_CRON_SECRET", "orbit-cron-secret");
  const response = await handleProcessFarRescheduleRecaptureRequest(
    new Request("https://example.com/process-far-reschedule-recapture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schedule_id: "schedule-1" }),
    }),
    createDeps(),
  );
  assertEquals(response.status, 401);
});

Deno.test("gateway OK commits domain without cancel side effects", async () => {
  Deno.env.set("ORBIT_CRON_SECRET", "orbit-cron-secret");
  let commitCalls = 0;
  const response = await handleProcessFarRescheduleRecaptureRequest(
    cronRequest({ schedule_id: "schedule-1" }),
    createDeps({
      commitAfterGateway: async () => {
        commitCalls += 1;
        return { ...commitOk };
      },
    }),
  );

  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.outcome, "committed");
  assertEquals(body.new_schedule_id, "schedule-2");
  assertEquals(commitCalls, 1);
});

Deno.test("gateway fail leaves pending (no commit)", async () => {
  Deno.env.set("ORBIT_CRON_SECRET", "orbit-cron-secret");
  let commitCalls = 0;
  const response = await handleProcessFarRescheduleRecaptureRequest(
    cronRequest({ schedule_id: "schedule-1" }),
    createDeps({
      refundTransaction: async () => ({
        success: false,
        error: { code: "GATEWAY_ERROR", message: "down" },
      }),
      commitAfterGateway: async () => {
        commitCalls += 1;
        return { ...commitOk };
      },
    }),
  );

  assertEquals(response.status, 500);
  const body = await response.json();
  assertEquals(body.pending, true);
  assertEquals(commitCalls, 0);
});

Deno.test("already_done prepare returns success without gateway", async () => {
  Deno.env.set("ORBIT_CRON_SECRET", "orbit-cron-secret");
  let refundCalls = 0;
  const response = await handleProcessFarRescheduleRecaptureRequest(
    cronRequest({ schedule_id: "schedule-1" }),
    createDeps({
      prepare: async () => ({
        ...prepareReady,
        outcome: "already_done",
        newScheduleId: "schedule-2",
      }),
      refundTransaction: async () => {
        refundCalls += 1;
        return { success: true };
      },
    }),
  );

  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.outcome, "already_done");
  assertEquals(refundCalls, 0);
});

Deno.test("already_submitted skips gateway and commits domain only", async () => {
  Deno.env.set("ORBIT_CRON_SECRET", "orbit-cron-secret");
  let refundCalls = 0;
  const response = await handleProcessFarRescheduleRecaptureRequest(
    cronRequest({ schedule_id: "schedule-1" }),
    createDeps({
      prepare: async () => ({
        ...prepareReady,
        alreadySubmitted: true,
        refundSubmitStatus: "SUBMITTED",
      }),
      refundTransaction: async () => {
        refundCalls += 1;
        return { success: true };
      },
    }),
  );

  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.already_submitted, true);
  assertEquals(body.new_schedule_id, "schedule-2");
  assertEquals(refundCalls, 0);
});

Deno.test("commit failure after gateway marks acked and retries", async () => {
  Deno.env.set("ORBIT_CRON_SECRET", "orbit-cron-secret");
  let commitCalls = 0;
  let markCalls = 0;
  const response = await handleProcessFarRescheduleRecaptureRequest(
    cronRequest({ schedule_id: "schedule-1" }),
    createDeps({
      commitAfterGateway: async () => {
        commitCalls += 1;
        if (commitCalls === 1) return "INVALID_SCHEDULE_STATE";
        return { ...commitOk };
      },
      markGatewayAcked: async () => {
        markCalls += 1;
      },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(commitCalls, 2);
  assertEquals(markCalls, 1);
});
