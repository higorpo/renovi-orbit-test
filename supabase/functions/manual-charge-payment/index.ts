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
  handleManualChargePaymentRequest,
  type ManualChargePaymentDeps,
} from "./handleRequest.ts";
import type { ManualChargeAcquireErrorCode, ManualChargeSchedule } from "./types.ts";

function resolvePlatformBankAccountId(): string {
  const value = Deno.env.get("NETCRED_PLATFORM_BANK_ACCOUNT_ID")?.trim();
  if (!value) {
    throw new Error("NETCRED_PLATFORM_BANK_ACCOUNT_ID is not configured");
  }
  return value;
}

function mapRpcError(message: string): ManualChargeAcquireErrorCode | null {
  const known: ManualChargeAcquireErrorCode[] = [
    "PAYMENT_ALREADY_IN_PROGRESS",
    "SERVICE_AUTO_CANCELLED",
    "INVALID_SCHEDULE_STATE",
    "SCHEDULE_NOT_FOUND",
    "SERVICE_CANCELLED",
    "CLEARSALE_SESSION_REQUIRED",
    "PAYMENT_TOKEN_INACTIVE",
    "RATE_LIMIT_EXCEEDED",
  ];

  return known.find((code) => message.includes(code)) ?? null;
}

function mapBeginManualAttemptResult(data: unknown): ManualChargeSchedule {
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    contracted_service_id: String(row.contracted_service_id),
    service_request_id: row.service_request_id
      ? String(row.service_request_id)
      : null,
    service_request_title: row.service_request_title
      ? String(row.service_request_title)
      : null,
    client_id: String(row.client_id),
    provider_id: String(row.provider_id),
    gateway_slug: String(row.gateway_slug ?? "netcred"),
    client_card_token_id: row.client_card_token_id
      ? String(row.client_card_token_id)
      : null,
    provider_payout: Number(row.provider_payout ?? row.base_amount),
    installment_number: Number(row.installment_number),
    base_amount: Number(row.base_amount),
    state: String(row.state),
    manual_attempt_count: Number(row.manual_attempt_count),
    automatic_attempt_count: Number(row.automatic_attempt_count),
    max_attempts: Number(row.max_attempts),
    clearsale_session_id: row.clearsale_session_id
      ? String(row.clearsale_session_id)
      : null,
    client_ip_address: row.client_ip_address
      ? String(row.client_ip_address)
      : null,
    gateway_reference_code: row.gateway_reference_code
      ? String(row.gateway_reference_code)
      : null,
  };
}

function createDeps(): ManualChargePaymentDeps {
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
    acquireLease: async (input) => {
      const { data, error } = await supabase.rpc("payment_begin_manual_attempt", {
        p_schedule_id: input.scheduleId,
        p_client_id: input.clientId,
        p_clearsale_session_id: input.clearsaleSessionId,
        p_client_ip_address: input.clientIpAddress ?? undefined,
        p_actor_id: input.actorId,
      });

      if (error) {
        const mapped = mapRpcError(error.message);
        if (mapped) {
          return { error: mapped };
        }
        return { error: "INVALID_SCHEDULE_STATE" };
      }

      const schedule = mapBeginManualAttemptResult(data);

      const { data: payoutRow } = await supabase
        .from("payment_schedules")
        .select("provider_payout")
        .eq("id", schedule.id)
        .maybeSingle();

      if (payoutRow?.provider_payout != null) {
        schedule.provider_payout = Number(payoutRow.provider_payout);
      }

      return { schedule };
    },
    calculateChargeAmount: async (input) => {
      const { data, error } = await supabase.rpc("payment_calculate_charge_amount", {
        p_client_card_token_id: input.clientCardTokenId,
        p_base_amount: input.baseAmount,
        p_installment_number: input.installmentNumber,
      });

      if (error || data === null) {
        return null;
      }

      return Number(data).toFixed(2);
    },
    loadPaymentToken: async (tokenId) => {
      const { data, error } = await supabase
        .from("client_card_tokens")
        .select("id, gateway_payment_profile_id, gateway_card_token, state")
        .eq("id", tokenId)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return data;
    },
    loadProviderAccount: async (providerId) => {
      const { data, error } = await supabase
        .from("provider_gateway_accounts")
        .select(
          "provider_id, netcred_company_id, netcred_bank_account_id, onboarding_status",
        )
        .eq("provider_id", providerId)
        .eq("gateway_slug", "netcred")
        .maybeSingle();

      if (error || !data || data.onboarding_status !== "ACTIVE") {
        return null;
      }

      return data;
    },
    createCharge: (input) => AdapterRegistry.get("netcred").createCharge(input),
    commitResult: async (input) => {
      const { data, error } = await supabase.rpc("payment_commit_charge_outcome", {
        p_schedule_id: input.scheduleId,
        p_outcome: input.outcome,
        p_charge_amount: Number.parseFloat(input.chargeAmount),
        p_gateway_charge_id: input.providerChargeId ?? undefined,
        p_gateway_transaction_id: input.providerTransactionId ?? undefined,
        p_failure_code: input.failureCode ?? undefined,
        p_failure_reason: input.failureReason ?? undefined,
        p_gateway_latency_ms: input.gatewayLatencyMs,
        p_provider_response_summary: input.providerResponseSummary as Json,
        p_initiator: "client",
        p_actor_id: input.actorId,
      });

      if (error || !data) {
        return null;
      }

      return String(data);
    },
    enqueueNotification: async (scheduleId, notificationEvent, metadata) => {
      const { error } = await supabase.rpc("payment_enqueue_notifications", {
        p_schedule_id: scheduleId,
        p_notification_event: notificationEvent,
        p_metadata: metadata as Json,
      });

      if (error) {
        throw new Error(error.message);
      }
    },
    checkRateLimit,
  };
}

servePaymentFunction("manual-charge-payment", (req) =>
  handleManualChargePaymentRequest(req, createDeps()));
