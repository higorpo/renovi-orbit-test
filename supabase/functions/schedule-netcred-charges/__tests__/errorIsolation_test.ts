import { assertEquals } from "std/testing/asserts";
import {
  handleScheduleNetcredChargesRequest,
  type ScheduleNetcredChargesDeps,
} from "../handleRequest.ts";
import type { CronChargeSchedule } from "../types.ts";

const baseSchedule: CronChargeSchedule = {
  id: "schedule-1",
  contracted_service_id: "service-1",
  service_request_id: "sr-1",
  client_id: "client-1",
  provider_id: "provider-1",
  gateway_slug: "netcred",
  client_card_token_id: "token-1",
  provider_payout: 850,
  netcred_company_id: "1048",
  installment_number: 1,
  base_amount: 1000,
  automatic_attempt_count: 1,
  max_attempts: 3,
  clearsale_session_id: "session-1",
  client_ip_address: "189.0.0.1",
};

function scheduleVariant(
  id: string,
  serviceId: string,
): CronChargeSchedule {
  return {
    ...baseSchedule,
    id,
    contracted_service_id: serviceId,
    service_request_id: `sr-${id}`,
  };
}

function cronRequest(): Request {
  return new Request("https://example.com/schedule-netcred-charges", {
    method: "POST",
    headers: {
      Authorization: "Bearer test-service-role",
    },
  });
}

function withCronAuthEnv<T>(fn: () => Promise<T>): Promise<T> {
  const previousServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const previousEnvironment = Deno.env.get("ENVIRONMENT");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");
  Deno.env.set("ENVIRONMENT", "development");

  return fn().finally(() => {
    if (previousServiceRoleKey === undefined) {
      Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    } else {
      Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", previousServiceRoleKey);
    }
    if (previousEnvironment === undefined) {
      Deno.env.delete("ENVIRONMENT");
    } else {
      Deno.env.set("ENVIRONMENT", previousEnvironment);
    }
  });
}

Deno.test("one schedule failure does not abort remaining batch processing", async () => {
  await withCronAuthEnv(async () => {
    const processedIds: string[] = [];
    const schedules = [
      scheduleVariant("schedule-1", "service-1"),
      scheduleVariant("schedule-2", "service-2"),
      scheduleVariant("schedule-3", "service-3"),
    ];

    const deps: ScheduleNetcredChargesDeps = {
      dequeueSchedules: async () => schedules,
      processSchedule: async (schedule) => {
        processedIds.push(schedule.id);
        if (schedule.id === "schedule-2") {
          throw new Error("gateway_timeout");
        }
        return {
          scheduleId: schedule.id,
          outcome: "PAID",
          chargeAmount: "1024.29",
        };
      },
      captureException: () => {},
      maxAttempts: 3,
    };

    const response = await handleScheduleNetcredChargesRequest(cronRequest(), deps);
    const summary = await response.json();

    assertEquals(response.status, 200);
    assertEquals(summary.processed, 3);
    assertEquals(summary.paid, 2);
    assertEquals(summary.errors, 1);
    assertEquals(processedIds, ["schedule-1", "schedule-2", "schedule-3"]);
  });
});

Deno.test("captureException receives per-schedule isolation context", async () => {
  await withCronAuthEnv(async () => {
    const captured: Array<Record<string, unknown>> = [];
    const failingSchedule = scheduleVariant("schedule-fail", "service-fail");
    failingSchedule.automatic_attempt_count = 2;

    const deps: ScheduleNetcredChargesDeps = {
      dequeueSchedules: async () => [
        scheduleVariant("schedule-ok", "service-ok"),
        failingSchedule,
      ],
      processSchedule: async (schedule) => {
        if (schedule.id === "schedule-fail") {
          throw new Error("PROVIDER_NOT_CREDENTIALED");
        }
        return {
          scheduleId: schedule.id,
          outcome: "PAID",
          chargeAmount: "1024.29",
        };
      },
      captureException: (error, extra) => {
        captured.push({
          message: error instanceof Error ? error.message : String(error),
          ...extra,
        });
      },
      maxAttempts: 3,
    };

    const response = await handleScheduleNetcredChargesRequest(cronRequest(), deps);
    const summary = await response.json();

    assertEquals(summary.processed, 2);
    assertEquals(summary.paid, 1);
    assertEquals(summary.errors, 1);
    assertEquals(captured.length, 1);
    assertEquals(captured[0].schedule_id, "schedule-fail");
    assertEquals(captured[0].contracted_service_id, "service-fail");
    assertEquals(captured[0].automatic_attempt_count, 2);
    assertEquals(captured[0].gateway_slug, "netcred");
    assertEquals(captured[0].current_state, "PROCESSING");
    assertEquals(captured[0].message, "PROVIDER_NOT_CREDENTIALED");
  });
});

Deno.test("multiple schedule failures each emit isolated captureException", async () => {
  await withCronAuthEnv(async () => {
    const capturedScheduleIds: string[] = [];

    const deps: ScheduleNetcredChargesDeps = {
      dequeueSchedules: async () => [
        scheduleVariant("schedule-a", "service-a"),
        scheduleVariant("schedule-b", "service-b"),
        scheduleVariant("schedule-c", "service-c"),
      ],
      processSchedule: async (schedule) => {
        if (schedule.id === "schedule-a" || schedule.id === "schedule-c") {
          throw new Error(`isolated_failure:${schedule.id}`);
        }
        return {
          scheduleId: schedule.id,
          outcome: "FAILED",
          chargeAmount: "1024.29",
        };
      },
      captureException: (_error, extra) => {
        if (typeof extra.schedule_id === "string") {
          capturedScheduleIds.push(extra.schedule_id);
        }
      },
      maxAttempts: 3,
    };

    const response = await handleScheduleNetcredChargesRequest(cronRequest(), deps);
    const summary = await response.json();

    assertEquals(summary.processed, 3);
    assertEquals(summary.failed, 1);
    assertEquals(summary.errors, 2);
    assertEquals(capturedScheduleIds, ["schedule-a", "schedule-c"]);
  });
});

Deno.test("invoke deadline stops starting new charges; leftover counted as skipped_deadline", async () => {
  await withCronAuthEnv(async () => {
    const processedIds: string[] = [];
    let clock = 0;

    const deps: ScheduleNetcredChargesDeps = {
      dequeueSchedules: async () => [
        scheduleVariant("schedule-1", "service-1"),
        scheduleVariant("schedule-2", "service-2"),
        scheduleVariant("schedule-3", "service-3"),
      ],
      processSchedule: async (schedule) => {
        processedIds.push(schedule.id);
        clock += 20_000;
        return {
          scheduleId: schedule.id,
          outcome: "PAID",
          chargeAmount: "1024.29",
        };
      },
      captureException: () => {},
      maxAttempts: 3,
      invokeStartedAtMs: 0,
      invokeDeadlineMs: 25_000,
      now: () => clock,
    };

    const response = await handleScheduleNetcredChargesRequest(cronRequest(), deps);
    const summary = await response.json();

    assertEquals(response.status, 200);
    assertEquals(processedIds, ["schedule-1", "schedule-2"]);
    assertEquals(summary.processed, 2);
    assertEquals(summary.paid, 2);
    assertEquals(summary.skipped_deadline, 1);
  });
});
