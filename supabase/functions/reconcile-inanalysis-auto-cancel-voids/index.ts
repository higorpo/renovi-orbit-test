import "xhr";
import { servePaymentFunction } from "../_shared/observability/sentry.ts";
import {
  AdapterRegistry,
  configureAdapterRegistry,
} from "../_shared/payment/registry.ts";
import { resolveIsProduction } from "../_shared/payment/netcred-auth.ts";
import { createPaymentLogger } from "../_shared/observability/payment-logger.ts";
import { createServiceRoleClient } from "../_shared/serviceRoleClient.ts";
import {
  handleReconcileInanalysisAutoCancelVoidsRequest,
  type ProcessInanalysisVoidDeps,
  type ReconcileInanalysisAutoCancelVoidsDeps,
} from "./handleRequest.ts";
import { processInanalysisVoidSchedule } from "./processSchedule.ts";
import type { InanalysisVoidSchedule, VoidCommitOutcome } from "./types.ts";

const logger = createPaymentLogger("reconcile-inanalysis-auto-cancel-voids");

function parseClaimedSchedules(data: unknown): InanalysisVoidSchedule[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((row) => {
    const schedule = row as Record<string, unknown>;
    return {
      id: String(schedule.schedule_id ?? schedule.id),
      contracted_service_id: String(schedule.contracted_service_id),
      client_id: String(schedule.client_id),
      provider_id: String(schedule.provider_id),
      gateway_charge_id: String(schedule.gateway_charge_id),
      gateway_transaction_id: schedule.gateway_transaction_id != null
        ? String(schedule.gateway_transaction_id)
        : null,
      netcred_company_id: schedule.netcred_company_id != null
        ? String(schedule.netcred_company_id)
        : null,
      reconciliation_failure_count: Number(schedule.reconciliation_failure_count ?? 0),
    };
  });
}

function createProcessScheduleDeps(
  supabase: ReturnType<typeof createServiceRoleClient>,
): ProcessInanalysisVoidDeps {
  return {
    getTransaction: (input) => AdapterRegistry.get("netcred").getTransaction(input),
    voidCharge: (input) => AdapterRegistry.get("netcred").voidCharge(input),
    commitOutcome: async (input) => {
      const { data, error } = await supabase.rpc(
        "payment_commit_inanalysis_auto_cancel_void_outcome",
        {
          p_schedule_id: input.scheduleId,
          p_outcome: input.outcome,
          p_gateway_state: input.gatewayState ?? undefined,
          p_error_message: input.errorMessage ?? undefined,
        },
      );

      if (error) {
        throw new Error(error.message);
      }

      const result = data as {
        applied: boolean;
        reconciliation_failure_count?: number;
      };

      return result;
    },
    emitWarning: (extra) => {
      logger.warn("inanalysis_void_warning", extra);
    },
  };
}


function resolvePlatformCompanyId(): string {
  const value = Deno.env.get("NETCRED_PLATFORM_COMPANY_ID")?.trim();
  if (!value) {
    throw new Error("NETCRED_PLATFORM_COMPANY_ID is not configured");
  }
  return value;
}

function resolvePlatformBankAccountId(): string {
  const value = Deno.env.get("NETCRED_PLATFORM_BANK_ACCOUNT_ID")?.trim();
  if (!value) {
    throw new Error("NETCRED_PLATFORM_BANK_ACCOUNT_ID is not configured");
  }
  return value;
}

function createDeps(): ReconcileInanalysisAutoCancelVoidsDeps {
  const supabase = createServiceRoleClient();

  configureAdapterRegistry({
    supabase,
    platformBankAccountId: resolvePlatformBankAccountId(),
    platformCompanyId: resolvePlatformCompanyId(),
    isProduction: resolveIsProduction(),
  });

  const processDeps = createProcessScheduleDeps(supabase);

  return {
    listPendingSchedules: async (batchSize) => {
      const { data, error } = await supabase.rpc(
        "payment_claim_inanalysis_auto_cancel_void_batch",
        { p_batch_size: batchSize ?? undefined },
      );

      if (error) {
        throw new Error(error.message);
      }

      return parseClaimedSchedules(data);
    },
    processSchedule: (schedule) => processInanalysisVoidSchedule(processDeps, schedule),
  };
}

servePaymentFunction("reconcile-inanalysis-auto-cancel-voids", (req) =>
  handleReconcileInanalysisAutoCancelVoidsRequest(req, createDeps()));

export type { VoidCommitOutcome };
