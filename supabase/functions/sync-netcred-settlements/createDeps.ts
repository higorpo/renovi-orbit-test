import { NetCredAdapter } from "../_shared/payment/index.ts";
import { resolveIsProduction } from "../_shared/payment/netcred-auth.ts";
import type { SettlementMovementUpsertItem } from "../_shared/payment/mapSettlementMovementUpsert.ts";
import { createServiceRoleClient } from "../_shared/serviceRoleClient.ts";
import type { SyncNetcredSettlementsDeps } from "./handleRequest.ts";
import { parseClaimedSchedules } from "./parseClaimedSchedules.ts";
import { processSettlementSyncSchedule } from "./processSchedule.ts";
import type { SettlementSyncUpsertResult } from "./types.ts";

export type CreateSyncDepsOptions = {
  createClient?: typeof createServiceRoleClient;
  createAdapter?: (args: {
    supabase: ReturnType<typeof createServiceRoleClient>;
    platformBankAccountId: string;
    platformCompanyId: string;
    isProduction: boolean;
  }) => Pick<NetCredAdapter, "listMovementsByTransactionId">;
  resolvePlatformCompanyId?: () => string;
  resolvePlatformBankAccountId?: () => string;
  resolveIsProduction?: () => boolean;
};

export function resolvePlatformCompanyId(): string {
  const value = Deno.env.get("NETCRED_PLATFORM_COMPANY_ID")?.trim();
  if (!value) {
    throw new Error("NETCRED_PLATFORM_COMPANY_ID is not configured");
  }
  return value;
}

export function resolvePlatformBankAccountId(): string {
  const value = Deno.env.get("NETCRED_PLATFORM_BANK_ACCOUNT_ID")?.trim();
  if (!value) {
    throw new Error("NETCRED_PLATFORM_BANK_ACCOUNT_ID is not configured");
  }
  return value;
}

export function createSyncNetcredSettlementsDeps(
  options: CreateSyncDepsOptions = {},
): SyncNetcredSettlementsDeps {
  const createClient = options.createClient ?? createServiceRoleClient;
  const resolveCompanyId = options.resolvePlatformCompanyId ??
    resolvePlatformCompanyId;
  const resolveBankAccountId = options.resolvePlatformBankAccountId ??
    resolvePlatformBankAccountId;
  const resolveProduction = options.resolveIsProduction ?? resolveIsProduction;
  const createAdapter = options.createAdapter ??
    ((args) => new NetCredAdapter(args));

  const supabase = createClient();
  const adapter = createAdapter({
    supabase,
    platformBankAccountId: resolveBankAccountId(),
    platformCompanyId: resolveCompanyId(),
    isProduction: resolveProduction(),
  });

  return {
    listSchedulesNeedingSync: async (batchSize) => {
      const { data, error } = await supabase.rpc(
        "payment_claim_schedules_for_settlement_sync",
        { p_batch_size: batchSize ?? undefined },
      );

      if (error) {
        throw new Error(error.message);
      }

      return parseClaimedSchedules(data);
    },
    processSchedule: (schedule) =>
      processSettlementSyncSchedule(
        {
          listMovementsByTransactionId: (transactionId) =>
            adapter.listMovementsByTransactionId(transactionId),
          upsertSettlementMovements: async (movements) => {
            const { data, error } = await supabase.rpc(
              "payment_upsert_settlement_movements",
              { p_movements: movements as SettlementMovementUpsertItem[] },
            );

            if (error) {
              throw new Error(error.message);
            }

            const result = data as SettlementSyncUpsertResult | null;
            return {
              upserted: Number(result?.upserted ?? 0),
              skipped_platform: Number(result?.skipped_platform ?? 0),
              skipped_not_found: Number(result?.skipped_not_found ?? 0),
              skipped_invalid: Number(result?.skipped_invalid ?? 0),
              results: result?.results,
            };
          },
        },
        schedule,
      ),
  };
}
