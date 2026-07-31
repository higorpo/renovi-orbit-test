import {
  assertEquals,
  assertRejects,
} from "std/testing/asserts";
import { createServiceRoleClient } from "../../_shared/serviceRoleClient.ts";
import {
  createSyncNetcredSettlementsDeps,
  resolvePlatformBankAccountId,
  resolvePlatformCompanyId,
} from "../createDeps.ts";
import type { SettlementSyncSchedule } from "../types.ts";

type RpcCall = {
  name: string;
  args: Record<string, unknown>;
};

function createFakeClient(options: {
  claim?: { data?: unknown; error?: { message: string } | null };
  upsert?: { data?: unknown; error?: { message: string } | null };
  onRpc?: (call: RpcCall) => void;
}): ReturnType<typeof createServiceRoleClient> {
  return {
    rpc: async (name: string, args: Record<string, unknown>) => {
      options.onRpc?.({ name, args });
      if (name === "payment_claim_schedules_for_settlement_sync") {
        return {
          data: options.claim?.data ?? [],
          error: options.claim?.error ?? null,
        };
      }
      if (name === "payment_upsert_settlement_movements") {
        const hasExplicitData = options.upsert && "data" in options.upsert;
        return {
          data: hasExplicitData
            ? options.upsert!.data
            : {
              upserted: 1,
              skipped_platform: 0,
              skipped_not_found: 0,
              skipped_invalid: 0,
            },
          error: options.upsert?.error ?? null,
        };
      }
      return { data: null, error: { message: `unexpected rpc ${name}` } };
    },
  } as unknown as ReturnType<typeof createServiceRoleClient>;
}

const schedule: SettlementSyncSchedule = {
  id: "schedule-1",
  provider_id: "provider-1",
  state: "PAID",
  gateway_transaction_id: "tx-1",
  gateway_slug: "netcred",
  netcred_company_id: "1048",
  paid_at: "2026-07-01T12:00:00Z",
};

Deno.test("resolvePlatformCompanyId throws when env is missing", () => {
  Deno.env.delete("NETCRED_PLATFORM_COMPANY_ID");
  let thrown: unknown;
  try {
    resolvePlatformCompanyId();
  } catch (error) {
    thrown = error;
  }
  assertEquals(thrown instanceof Error, true);
  assertEquals(
    (thrown as Error).message,
    "NETCRED_PLATFORM_COMPANY_ID is not configured",
  );
});

Deno.test("resolvePlatformBankAccountId throws when env is missing", () => {
  Deno.env.delete("NETCRED_PLATFORM_BANK_ACCOUNT_ID");
  let thrown: unknown;
  try {
    resolvePlatformBankAccountId();
  } catch (error) {
    thrown = error;
  }
  assertEquals(thrown instanceof Error, true);
  assertEquals(
    (thrown as Error).message,
    "NETCRED_PLATFORM_BANK_ACCOUNT_ID is not configured",
  );
});

Deno.test("resolvePlatform* returns trimmed env values", () => {
  Deno.env.set("NETCRED_PLATFORM_COMPANY_ID", "  company-1  ");
  Deno.env.set("NETCRED_PLATFORM_BANK_ACCOUNT_ID", "  bank-1  ");
  try {
    assertEquals(resolvePlatformCompanyId(), "company-1");
    assertEquals(resolvePlatformBankAccountId(), "bank-1");
  } finally {
    Deno.env.delete("NETCRED_PLATFORM_COMPANY_ID");
    Deno.env.delete("NETCRED_PLATFORM_BANK_ACCOUNT_ID");
  }
});

Deno.test("listSchedulesNeedingSync maps claim RPC rows and omits batch when unset", async () => {
  const calls: RpcCall[] = [];
  const deps = createSyncNetcredSettlementsDeps({
    createClient: () =>
      createFakeClient({
        claim: {
          data: [{
            schedule_id: "s-1",
            provider_id: "p-1",
            state: "PAID",
            gateway_transaction_id: "tx-1",
          }],
        },
        onRpc: (call) => calls.push(call),
      }),
    createAdapter: () => ({
      listMovementsByTransactionId: async () => [],
    }),
    resolvePlatformCompanyId: () => "company",
    resolvePlatformBankAccountId: () => "bank",
    resolveIsProduction: () => false,
  });

  const schedules = await deps.listSchedulesNeedingSync();
  assertEquals(schedules.length, 1);
  assertEquals(schedules[0]?.id, "s-1");
  assertEquals(calls[0]?.name, "payment_claim_schedules_for_settlement_sync");
  assertEquals(calls[0]?.args, { p_batch_size: undefined });
});

Deno.test("listSchedulesNeedingSync forwards batch size and surfaces RPC errors", async () => {
  const calls: RpcCall[] = [];
  const deps = createSyncNetcredSettlementsDeps({
    createClient: () =>
      createFakeClient({
        claim: { error: { message: "claim failed" } },
        onRpc: (call) => calls.push(call),
      }),
    createAdapter: () => ({
      listMovementsByTransactionId: async () => [],
    }),
    resolvePlatformCompanyId: () => "company",
    resolvePlatformBankAccountId: () => "bank",
    resolveIsProduction: () => false,
  });

  await assertRejects(
    () => deps.listSchedulesNeedingSync(25),
    Error,
    "claim failed",
  );
  assertEquals(calls[0]?.args, { p_batch_size: 25 });
});

Deno.test("processSchedule upserts GraphQL movements via RPC", async () => {
  const calls: RpcCall[] = [];
  const deps = createSyncNetcredSettlementsDeps({
    createClient: () =>
      createFakeClient({
        upsert: {
          data: {
            upserted: 2,
            skipped_platform: 1,
            skipped_not_found: 0,
            skipped_invalid: 0,
            results: [{ ok: true }],
          },
        },
        onRpc: (call) => calls.push(call),
      }),
    createAdapter: () => ({
      listMovementsByTransactionId: async () => [{
        id: "98765",
        amount: "1500.00",
        netAmount: "1470.00",
        movementStatus: "PENDING",
        recordType: "CREDIT",
        transactionId: "tx-1",
        payoutId: "payout-1",
      }],
    }),
    resolvePlatformCompanyId: () => "company",
    resolvePlatformBankAccountId: () => "bank",
    resolveIsProduction: () => false,
  });

  const result = await deps.processSchedule(schedule);
  assertEquals(result.outcome, "upserted");
  assertEquals(result.upserted, 2);
  assertEquals(result.skippedPlatform, 1);
  assertEquals(calls[0]?.name, "payment_upsert_settlement_movements");
});

Deno.test("processSchedule throws when upsert RPC fails", async () => {
  const deps = createSyncNetcredSettlementsDeps({
    createClient: () =>
      createFakeClient({
        upsert: { error: { message: "upsert failed" } },
      }),
    createAdapter: () => ({
      listMovementsByTransactionId: async () => [{
        id: "98765",
        amount: "1500.00",
        netAmount: "1470.00",
        movementStatus: "PENDING",
        recordType: "CREDIT",
        transactionId: "tx-1",
        payoutId: "payout-1",
      }],
    }),
    resolvePlatformCompanyId: () => "company",
    resolvePlatformBankAccountId: () => "bank",
    resolveIsProduction: () => false,
  });

  const result = await deps.processSchedule(schedule);
  assertEquals(result.outcome, "failure");
  assertEquals(result.error, "upsert failed");
});

Deno.test("processSchedule defaults null upsert counters to zero", async () => {
  const deps = createSyncNetcredSettlementsDeps({
    createClient: () =>
      createFakeClient({
        upsert: { data: null },
      }),
    createAdapter: () => ({
      listMovementsByTransactionId: async () => [{
        id: "98765",
        amount: "1500.00",
        netAmount: "1470.00",
        movementStatus: "PENDING",
        recordType: "CREDIT",
        transactionId: "tx-1",
        payoutId: "payout-1",
      }],
    }),
    resolvePlatformCompanyId: () => "company",
    resolvePlatformBankAccountId: () => "bank",
    resolveIsProduction: () => false,
  });

  const result = await deps.processSchedule(schedule);
  assertEquals(result.outcome, "upserted");
  assertEquals(result.upserted, 0);
  assertEquals(result.skippedPlatform, 0);
  assertEquals(result.skippedNotFound, 0);
  assertEquals(result.skippedInvalid, 0);
});

Deno.test("createSyncNetcredSettlementsDeps uses default env resolvers and adapter factory", async () => {
  Deno.env.set("NETCRED_PLATFORM_COMPANY_ID", "company-default");
  Deno.env.set("NETCRED_PLATFORM_BANK_ACCOUNT_ID", "bank-default");
  Deno.env.set("ENVIRONMENT", "development");
  try {
    const calls: RpcCall[] = [];
    const deps = createSyncNetcredSettlementsDeps({
      createClient: () =>
        createFakeClient({
          claim: {
            data: [{
              id: "s-default",
              provider_id: "p-1",
              state: "PAID",
              gateway_transaction_id: "tx-default",
            }],
          },
          onRpc: (call) => calls.push(call),
        }),
      // Intentionally omit createAdapter / resolve* to exercise defaults.
    });

    const schedules = await deps.listSchedulesNeedingSync();
    assertEquals(schedules.length, 1);
    assertEquals(schedules[0]?.gateway_transaction_id, "tx-default");
    assertEquals(calls[0]?.name, "payment_claim_schedules_for_settlement_sync");
  } finally {
    Deno.env.delete("NETCRED_PLATFORM_COMPANY_ID");
    Deno.env.delete("NETCRED_PLATFORM_BANK_ACCOUNT_ID");
    Deno.env.delete("ENVIRONMENT");
  }
});

Deno.test("createSyncNetcredSettlementsDeps uses default createServiceRoleClient factory", () => {
  Deno.env.set("SUPABASE_URL", "http://127.0.0.1:54321");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");
  try {
    const deps = createSyncNetcredSettlementsDeps({
      createAdapter: () => ({
        listMovementsByTransactionId: async () => [],
      }),
      resolvePlatformCompanyId: () => "company",
      resolvePlatformBankAccountId: () => "bank",
      resolveIsProduction: () => false,
    });
    assertEquals(typeof deps.listSchedulesNeedingSync, "function");
    assertEquals(typeof deps.processSchedule, "function");
  } finally {
    Deno.env.delete("SUPABASE_URL");
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
  }
});

Deno.test("processSchedule defaults missing upsert counter fields to zero", async () => {
  const deps = createSyncNetcredSettlementsDeps({
    createClient: () =>
      createFakeClient({
        upsert: { data: { upserted: 1 } },
      }),
    createAdapter: () => ({
      listMovementsByTransactionId: async () => [{
        id: "98765",
        amount: "1500.00",
        netAmount: "1470.00",
        movementStatus: "PENDING",
        recordType: "CREDIT",
        transactionId: "tx-1",
        payoutId: "payout-1",
      }],
    }),
    resolvePlatformCompanyId: () => "company",
    resolvePlatformBankAccountId: () => "bank",
    resolveIsProduction: () => false,
  });

  const result = await deps.processSchedule(schedule);
  assertEquals(result.outcome, "upserted");
  assertEquals(result.upserted, 1);
  assertEquals(result.skippedPlatform, 0);
  assertEquals(result.skippedNotFound, 0);
  assertEquals(result.skippedInvalid, 0);
});
