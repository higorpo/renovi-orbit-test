import "xhr";
import { servePaymentFunction } from "../_shared/observability/sentry.ts";
import type { Json } from "../_shared/database.types.ts";
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

function resolvePlatformBankAccountId(): string {
  const value = Deno.env.get("NETCRED_PLATFORM_BANK_ACCOUNT_ID")?.trim();
  if (!value) {
    throw new Error("NETCRED_PLATFORM_BANK_ACCOUNT_ID is not configured");
  }
  return value;
}

function createDeps(): ProcessRefundDeps {
  const supabase = createServiceRoleClient();

  configureAdapterRegistry({
    supabase,
    platformBankAccountId: resolvePlatformBankAccountId(),
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
          "id, state, base_amount, paid_amount, gateway_transaction_id",
        )
        .eq("contracted_service_id", serviceId)
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
    submitRefundRequest: async (input) => {
      const { data, error } = await supabase.rpc("payment_begin_refund_request", {
        p_service_id: input.serviceId,
        p_actor_id: input.actorId,
        p_cancellation_reason: input.cancellationReason ?? undefined,
        p_initiator: input.initiator,
      });

      if (error) {
        return mapRpcErrorCode(error.message) ?? "INVALID_SCHEDULE_STATE";
      }

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
      } satisfies RefundSubmitResult;
    },
    refundTransaction: (input) => AdapterRegistry.get("netcred").refundTransaction(input),
    recordRefundFailed: async (input) => {
      const { error } = await supabase.rpc("payment_write_audit", {
        p_event_type: "REFUND_FAILED",
        p_entity_type: "payment_schedule",
        p_entity_id: input.scheduleId,
        p_service_id: input.serviceId,
        p_schedule_id: input.scheduleId,
        p_actor: input.initiator === "client" ? "client" : "provider",
        p_actor_id: input.actorId,
        p_metadata: { error_message: input.errorMessage } as Json,
      });

      if (error) {
        throw new Error(error.message);
      }
    },
    captureCriticalError: (error, extra) => {
      console.error(JSON.stringify({
        level: "critical",
        scope: "process-refund",
        event: "refund_gateway_failed",
        error: error instanceof Error ? error.message : String(error),
        ...extra,
      }));
    },
    getSupportUrl: () =>
      Deno.env.get("PAYMENT_SUPPORT_URL")?.trim() ?? "https://renovi.com.br/suporte",
    checkRateLimit,
  };
}

servePaymentFunction("process-refund", (req) =>
  handleProcessRefundRequest(req, createDeps()));
