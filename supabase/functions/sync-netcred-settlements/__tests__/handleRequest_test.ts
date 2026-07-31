import { assertEquals } from "std/testing/asserts";
import {
  handleSyncNetcredSettlementsRequest,
  type SyncNetcredSettlementsDeps,
} from "../handleRequest.ts";
import type { SettlementSyncSchedule } from "../types.ts";

function createDeps(
  overrides: Partial<SyncNetcredSettlementsDeps> = {},
): SyncNetcredSettlementsDeps {
  return {
    listSchedulesNeedingSync: async () => [],
    processSchedule: async () => ({
      scheduleId: "schedule-1",
      outcome: "skipped",
      movementCount: 0,
      upserted: 0,
      skippedPlatform: 0,
      skippedNotFound: 0,
      skippedInvalid: 0,
    }),
    ...overrides,
  };
}

function cronRequest(): Request {
  return new Request("https://example.com/sync-netcred-settlements", {
    method: "POST",
    headers: { Authorization: "Bearer test-service-role" },
  });
}

function withCronAuth(
  run: () => Promise<void>,
): Promise<void> {
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");
  Deno.env.set("ENVIRONMENT", "development");
  return run().finally(() => {
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    Deno.env.delete("ENVIRONMENT");
  });
}

const paidSchedule: SettlementSyncSchedule = {
  id: "schedule-1",
  provider_id: "provider-1",
  state: "PAID",
  gateway_transaction_id: "tx-99",
  gateway_slug: "netcred",
  netcred_company_id: "1048",
  paid_at: "2026-07-01T12:00:00Z",
};

Deno.test("rejects unauthorized requests", async () => {
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
  Deno.env.delete("ORBIT_CRON_SECRET");
  const response = await handleSyncNetcredSettlementsRequest(
    new Request("https://example.com/sync-netcred-settlements", {
      method: "POST",
    }),
    createDeps(),
  );
  assertEquals(response.status, 401);
});

Deno.test("OPTIONS returns 204 for CORS preflight", async () => {
  const response = await handleSyncNetcredSettlementsRequest(
    new Request("https://example.com/sync-netcred-settlements", {
      method: "OPTIONS",
    }),
    createDeps(),
  );
  assertEquals(response.status, 204);
});

Deno.test("rejects non-POST methods with 405", async () => {
  const response = await handleSyncNetcredSettlementsRequest(
    new Request("https://example.com/sync-netcred-settlements", {
      method: "GET",
    }),
    createDeps(),
  );
  assertEquals(response.status, 405);
  assertEquals(await response.json(), { error: "method_not_allowed" });
});

Deno.test("returns empty summary when no schedules need sync", async () => {
  await withCronAuth(async () => {
    const response = await handleSyncNetcredSettlementsRequest(
      cronRequest(),
      createDeps(),
    );
    assertEquals(response.status, 200);
    assertEquals(await response.json(), {
      processed: 0,
      upserted_schedules: 0,
      empty: 0,
      skipped: 0,
      failures: 0,
      movements_upserted: 0,
      movements_skipped_platform: 0,
      movements_skipped_not_found: 0,
      movements_skipped_invalid: 0,
    });
  });
});

Deno.test("aggregates upserted / empty / failure outcomes", async () => {
  await withCronAuth(async () => {
    const response = await handleSyncNetcredSettlementsRequest(
      cronRequest(),
      createDeps({
        listSchedulesNeedingSync: async () => [
          paidSchedule,
          { ...paidSchedule, id: "schedule-2", gateway_transaction_id: "tx-2" },
          { ...paidSchedule, id: "schedule-3", gateway_transaction_id: "tx-3" },
        ],
        processSchedule: async (schedule) => {
          if (schedule.id === "schedule-1") {
            return {
              scheduleId: schedule.id,
              outcome: "upserted",
              movementCount: 2,
              upserted: 1,
              skippedPlatform: 1,
              skippedNotFound: 2,
              skippedInvalid: 3,
            };
          }
          if (schedule.id === "schedule-2") {
            return {
              scheduleId: schedule.id,
              outcome: "empty",
              movementCount: 0,
              upserted: 0,
              skippedPlatform: 0,
              skippedNotFound: 0,
              skippedInvalid: 0,
            };
          }
          return {
            scheduleId: schedule.id,
            outcome: "failure",
            movementCount: 0,
            upserted: 0,
            skippedPlatform: 0,
            skippedNotFound: 0,
            skippedInvalid: 0,
            error: "graphql down",
          };
        },
      }),
    );

    assertEquals(response.status, 200);
    const body = await response.json();
    assertEquals(body.processed, 3);
    assertEquals(body.upserted_schedules, 1);
    assertEquals(body.empty, 1);
    assertEquals(body.failures, 1);
    assertEquals(body.movements_upserted, 1);
    assertEquals(body.movements_skipped_platform, 1);
    assertEquals(body.movements_skipped_not_found, 2);
    assertEquals(body.movements_skipped_invalid, 3);
  });
});

Deno.test("counts skipped outcome when schedule cannot be synced", async () => {
  await withCronAuth(async () => {
    const response = await handleSyncNetcredSettlementsRequest(
      cronRequest(),
      createDeps({
        listSchedulesNeedingSync: async () => [paidSchedule],
        processSchedule: async (schedule) => ({
          scheduleId: schedule.id,
          outcome: "skipped",
          movementCount: 0,
          upserted: 0,
          skippedPlatform: 0,
          skippedNotFound: 0,
          skippedInvalid: 0,
          error: "missing_gateway_transaction_id",
        }),
      }),
    );

    assertEquals(response.status, 200);
    const body = await response.json();
    assertEquals(body.processed, 1);
    assertEquals(body.skipped, 1);
    assertEquals(body.failures, 0);
  });
});

Deno.test("counts unexpected processSchedule throw as failure", async () => {
  await withCronAuth(async () => {
    const response = await handleSyncNetcredSettlementsRequest(
      cronRequest(),
      createDeps({
        listSchedulesNeedingSync: async () => [paidSchedule],
        processSchedule: async () => {
          throw new Error("unexpected boom");
        },
      }),
    );

    assertEquals(response.status, 200);
    const body = await response.json();
    assertEquals(body.processed, 1);
    assertEquals(body.failures, 1);
  });
});

Deno.test("stringifies non-Error throws when processSchedule fails", async () => {
  await withCronAuth(async () => {
    const response = await handleSyncNetcredSettlementsRequest(
      cronRequest(),
      createDeps({
        listSchedulesNeedingSync: async () => [paidSchedule],
        processSchedule: async () => {
          throw "string failure";
        },
      }),
    );

    assertEquals(response.status, 200);
    const body = await response.json();
    assertEquals(body.failures, 1);
  });
});
