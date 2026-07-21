import "xhr";
import { servePaymentFunction } from "../_shared/observability/sentry.ts";
import {
  AdapterRegistry,
  configureAdapterRegistry,
} from "../_shared/payment/registry.ts";
import { resolveIsProduction } from "../_shared/payment/netcred-auth.ts";
import { emitReconciliationFailureWarning } from "../_shared/observability/payment-sentry-matrix.ts";
import { createPaymentLogger } from "../_shared/observability/payment-logger.ts";
import { enrichSchedulesWithServiceRequestIds } from "../_shared/payment/serviceDeepLink.ts";
import { createServiceRoleClient } from "../_shared/serviceRoleClient.ts";
import {
  handleReconcileNetcredPaymentsRequest,
  type ProcessReconcileScheduleDeps,
  type ReconcileNetcredPaymentsDeps,
} from "./handleRequest.ts";
import { processReconcileSchedule } from "./processSchedule.ts";
import type { ReconcileApplyResult, ReconcileSchedule } from "./types.ts";

const logger = createPaymentLogger("reconcile-netcred-payments");

function parseOptionalAmount(value: string | undefined): number | undefined {
  if (value == null || value.trim() === "") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseClaimedSchedules(data: unknown): ReconcileSchedule[] {
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
      state: String(schedule.state),
      installment_number: Number(schedule.installment_number),
      base_amount: Number(schedule.base_amount),
      payment_token_id: schedule.client_card_token_id != null
        ? String(schedule.client_card_token_id)
        : null,
      netcred_company_id: schedule.netcred_company_id != null
        ? String(schedule.netcred_company_id)
        : null,
      automatic_attempt_count: Number(schedule.automatic_attempt_count ?? 0),
      manual_attempt_count: Number(schedule.manual_attempt_count ?? 0),
      max_attempts: Number(schedule.max_attempts ?? 0),
      reconciliation_failure_count: Number(schedule.reconciliation_failure_count ?? 0),
      service_request_id: null,
    };
  });
}

function createProcessScheduleDeps(
  supabase: ReturnType<typeof createServiceRoleClient>,
): ProcessReconcileScheduleDeps {
  return {
    getTransaction: (input) => AdapterRegistry.get("netcred").getTransaction(input),
    applyGatewayState: async (input) => {
      const { data, error } = await supabase.rpc("payment_process_reconciliation_outcome", {
        p_schedule_id: input.scheduleId,
        p_gateway_state: input.gatewayState,
        p_paid_amount: parseOptionalAmount(input.paidAmount),
        p_refunded_amount: parseOptionalAmount(input.refundedAmount),
        p_gateway_charge_id: input.providerChargeId ?? undefined,
        p_gateway_transaction_id: input.providerTransactionId ?? undefined,
      });

      if (error) {
        throw new Error(error.message);
      }

      return data as ReconcileApplyResult;
    },
    incrementFailureCount: async (scheduleId) => {
      const { data, error } = await supabase.rpc(
        "payment_increment_reconciliation_failure",
        { p_schedule_id: scheduleId },
      );

      if (error) {
        throw new Error(error.message);
      }

      return Number(data);
    },
    emitWarning: (extra) => {
      logger.warn("reconcile_warning", extra);
      if (
        typeof extra.schedule_id === "string" &&
        typeof extra.service_id === "string" &&
        typeof extra.reconciliation_failure_count === "number"
      ) {
        void emitReconciliationFailureWarning({
          schedule_id: extra.schedule_id,
          service_id: extra.service_id,
          reconciliation_failure_count: extra.reconciliation_failure_count,
        });
      }
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

function createDeps(): ReconcileNetcredPaymentsDeps {
  const supabase = createServiceRoleClient();

  configureAdapterRegistry({
    supabase,
    platformBankAccountId: resolvePlatformBankAccountId(),
    platformCompanyId: resolvePlatformCompanyId(),
    isProduction: resolveIsProduction(),
  });
  const processDeps = createProcessScheduleDeps(supabase);

  return {
    listStaleSchedules: async (batchSize) => {
      const { data, error } = await supabase.rpc(
        "payment_claim_stale_schedules_for_reconciliation",
        { p_batch_size: batchSize ?? undefined },
      );

      if (error) {
        throw new Error(error.message);
      }

      const schedules = parseClaimedSchedules(data);
      return enrichSchedulesWithServiceRequestIds(supabase, schedules);
    },
    processSchedule: (schedule) => processReconcileSchedule(processDeps, schedule),
  };
}

servePaymentFunction("reconcile-netcred-payments", (req) =>
  handleReconcileNetcredPaymentsRequest(req, createDeps()));
