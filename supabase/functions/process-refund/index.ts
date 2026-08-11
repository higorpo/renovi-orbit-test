import "xhr";
import { servePaymentFunction } from "../_shared/observability/sentry.ts";
import { checkRateLimit } from "../_shared/rateLimiter.ts";
import {
  AdapterRegistry,
  configureAdapterRegistry,
} from "../_shared/payment/registry.ts";
import { resolveIsProduction } from "../_shared/payment/netcred-auth.ts";
import { createServiceRoleClient } from "../_shared/serviceRoleClient.ts";
import {
  handleProcessRefundRequest,
  mapRpcErrorCode,
  type ProcessRefundDeps,
} from "./handleRequest.ts";
import type { RefundContext, RefundSubmitResult } from "./types.ts";

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

function mapRefundRpcPayload(data: unknown): RefundSubmitResult {
  const payload = data as Record<string, unknown>;
  return {
    scheduleId: String(payload.schedule_id),
    providerTransactionId: String(payload.gateway_transaction_id ?? ""),
    paidAmount: String(payload.paid_amount ?? "0.00"),
    baseAmount: String(payload.base_amount ?? "0.00"),
    refundAmount: String(payload.refund_amount ?? "0.00"),
    penaltyTier: payload.penalty_tier != null
      ? String(payload.penalty_tier)
      : null,
    alreadySubmitted: Boolean(payload.already_submitted),
    refundSubmitStatus: payload.refund_submit_status != null
      ? String(payload.refund_submit_status)
      : null,
    path: payload.path != null ? String(payload.path) : null,
  };
}

function createDeps(): ProcessRefundDeps {
  const supabase = createServiceRoleClient();

  configureAdapterRegistry({
    supabase,
    platformBankAccountId: resolvePlatformBankAccountId(),
    platformCompanyId: resolvePlatformCompanyId(),
    isProduction: resolveIsProduction(),
  });

  return {
    getUser: async (token) => {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      return { user, error: error ?? null };
    },
    loadRefundContext: async (serviceId) => {
      const { data: service, error: serviceError } = await supabase
        .from("contracted_services")
        .select("id, client_id, provider_id, status, service_execution_at")
        .eq("id", serviceId)
        .maybeSingle();

      if (serviceError || !service) {
        return null;
      }

      const { data: schedule, error: scheduleError } = await supabase
        .from("payment_schedules")
        .select(
          "id, state, base_amount, paid_amount, gateway_transaction_id, refund_submit_status",
        )
        .eq("contracted_service_id", serviceId)
        .not("state", "in", "(REFUNDED,PARTIALLY_REFUNDED,CANCELLED,VOIDED,EXPIRED)")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (scheduleError || !schedule) {
        return null;
      }

      return {
        serviceId: service.id,
        clientId: service.client_id,
        providerId: service.provider_id,
        status: service.status,
        serviceScheduledAt: service.service_execution_at,
        scheduleId: schedule.id,
        scheduleState: schedule.state,
        baseAmount: schedule.base_amount,
        paidAmount: schedule.paid_amount,
        providerTransactionId: schedule.gateway_transaction_id,
        refundSubmitStatus: schedule.refund_submit_status ?? null,
      } satisfies RefundContext;
    },
    preChargeCancel: async (input) => {
      const { data, error } = await supabase.rpc("payment_pre_charge_cancel", {
        p_service_id: input.serviceId,
        p_actor_id: input.actorId,
        p_cancellation_reason: input.cancellationReason ?? undefined,
        p_initiator: input.initiator,
      });

      if (error) {
        return mapRpcErrorCode(error.message) ?? "INVALID_SCHEDULE_STATE";
      }

      return String(data);
    },
    prepareRefundRequest: async (input) => {
      const { data, error } = await supabase.rpc("payment_prepare_refund_request", {
        p_service_id: input.serviceId,
        p_actor_id: input.actorId,
        p_cancellation_reason: input.cancellationReason ?? undefined,
        p_initiator: input.initiator,
      });

      if (error) {
        return mapRpcErrorCode(error.message) ?? "INVALID_SCHEDULE_STATE";
      }

      return mapRefundRpcPayload(data);
    },
    commitRefundAfterGateway: async (input) => {
      const { data, error } = await supabase.rpc("payment_commit_refund_after_gateway", {
        p_service_id: input.serviceId,
        p_actor_id: input.actorId,
        p_cancellation_reason: input.cancellationReason ?? undefined,
        p_initiator: input.initiator,
        p_expected_refund_amount: input.expectedRefundAmount != null
          ? Number(input.expectedRefundAmount)
          : undefined,
      });

      if (error) {
        return mapRpcErrorCode(error.message) ?? "INVALID_SCHEDULE_STATE";
      }

      return mapRefundRpcPayload(data);
    },
    markRefundGatewayAcked: async (input) => {
      const { error } = await supabase.rpc("payment_mark_refund_gateway_acked", {
        p_schedule_id: input.scheduleId,
        p_actor_id: input.actorId,
        p_refunded_amount: input.refundedAmount != null
          ? Number(input.refundedAmount)
          : undefined,
      });

      if (error) {
        throw new Error(error.message);
      }
    },
    refundTransaction: (input) => AdapterRegistry.get("netcred").refundTransaction(input),
    captureCriticalError: (error, extra) => {
      console.error(JSON.stringify({
        level: "critical",
        scope: "process-refund",
        event: "refund_critical",
        error: error instanceof Error ? error.message : String(error),
        ...extra,
      }));
    },
    getSupportUrl: () =>
      Deno.env.get("PAYMENT_SUPPORT_URL")?.trim() ?? "https://prestway.com/suporte",
    checkRateLimit,
  };
}

servePaymentFunction("process-refund", (req) =>
  handleProcessRefundRequest(req, createDeps()));
