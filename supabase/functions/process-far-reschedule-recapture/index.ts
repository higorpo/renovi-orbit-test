import "xhr";
import { servePaymentFunction } from "../_shared/observability/sentry.ts";
import {
  AdapterRegistry,
  configureAdapterRegistry,
} from "../_shared/payment/registry.ts";
import { resolveIsProduction } from "../_shared/payment/netcred-auth.ts";
import { createServiceRoleClient } from "../_shared/serviceRoleClient.ts";
import {
  handleProcessFarRescheduleRecaptureRequest,
  type ProcessFarRecaptureDeps,
} from "./handleRequest.ts";
import type {
  FarRecaptureCommitResult,
  FarRecapturePrepareResult,
} from "./types.ts";
import { mapFarRecaptureRpcError } from "./types.ts";

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

function mapPrepare(data: unknown): FarRecapturePrepareResult {
  const payload = data as Record<string, unknown>;
  return {
    outcome: String(payload.outcome ?? "ready"),
    scheduleId: String(payload.schedule_id),
    contractedServiceId: String(payload.contracted_service_id),
    providerTransactionId: String(payload.gateway_transaction_id ?? ""),
    gatewayReferenceCode: payload.gateway_reference_code != null
      ? String(payload.gateway_reference_code)
      : null,
    refundAmount: String(payload.refund_amount ?? "0.00"),
    alreadySubmitted: Boolean(payload.already_submitted),
    refundSubmitStatus: payload.refund_submit_status != null
      ? String(payload.refund_submit_status)
      : null,
    newScheduleId: payload.new_schedule_id != null
      ? String(payload.new_schedule_id)
      : null,
  };
}

function mapCommit(data: unknown): FarRecaptureCommitResult {
  const payload = data as Record<string, unknown>;
  return {
    outcome: String(payload.outcome ?? "committed"),
    scheduleId: String(payload.schedule_id),
    newScheduleId: String(payload.new_schedule_id),
    contractedServiceId: String(payload.contracted_service_id),
    refundAmount: String(payload.refund_amount ?? "0.00"),
  };
}

function createDeps(): ProcessFarRecaptureDeps {
  const supabase = createServiceRoleClient();

  configureAdapterRegistry({
    supabase,
    platformBankAccountId: resolvePlatformBankAccountId(),
    platformCompanyId: resolvePlatformCompanyId(),
    isProduction: resolveIsProduction(),
  });

  return {
    prepare: async (input) => {
      const { data, error } = await supabase.rpc(
        "payment_prepare_far_reschedule_recapture",
        {
          p_schedule_id: input.scheduleId ?? undefined,
          p_contracted_service_id: input.contractedServiceId ?? undefined,
        },
      );

      if (error) {
        return mapFarRecaptureRpcError(error.message) ?? "INVALID_SCHEDULE_STATE";
      }

      return mapPrepare(data);
    },
    commitAfterGateway: async (input) => {
      const { data, error } = await supabase.rpc(
        "payment_commit_far_reschedule_after_gateway",
        {
          p_schedule_id: input.scheduleId,
          p_expected_refund_amount: input.expectedRefundAmount != null
            ? Number(input.expectedRefundAmount)
            : undefined,
        },
      );

      if (error) {
        return mapFarRecaptureRpcError(error.message) ?? "INVALID_SCHEDULE_STATE";
      }

      return mapCommit(data);
    },
    markGatewayAcked: async (input) => {
      const { error } = await supabase.rpc(
        "payment_mark_far_recapture_gateway_acked",
        {
          p_schedule_id: input.scheduleId,
          p_refunded_amount: input.refundedAmount != null
            ? Number(input.refundedAmount)
            : undefined,
        },
      );

      if (error) {
        throw new Error(error.message);
      }
    },
    refundTransaction: (input) =>
      AdapterRegistry.get("netcred").refundTransaction(input),
    captureCriticalError: (error, extra) => {
      console.error(JSON.stringify({
        level: "critical",
        scope: "process-far-reschedule-recapture",
        event: "far_recapture_critical",
        error: error instanceof Error ? error.message : String(error),
        ...extra,
      }));
    },
  };
}

servePaymentFunction("process-far-reschedule-recapture", (req) =>
  handleProcessFarRescheduleRecaptureRequest(req, createDeps()));
