import "xhr";
import { servePaymentFunction } from "../_shared/observability/sentry.ts";
import {
  captureCriticalAlertSync,
  capturePaymentExceptionSync,
  CRITICAL_ALERTS,
  emitFailedPermanentTransitionWarning,
} from "../_shared/observability/payment-sentry-matrix.ts";
import {
  createPaymentLogger,
  PAYMENT_LOG_EVENTS,
} from "../_shared/observability/payment-logger.ts";
import type { Json } from "../_shared/database.types.ts";
import {
  AdapterRegistry,
  configureAdapterRegistry,
} from "../_shared/payment/registry.ts";
import { resolveIsProduction } from "../_shared/payment/netcred-auth.ts";
import {
  loadPaymentPlatformConstants,
} from "../_shared/payment/constants.ts";
import { enrichSchedulesWithServiceRequestIds } from "../_shared/payment/serviceDeepLink.ts";
import { createServiceRoleClient } from "../_shared/serviceRoleClient.ts";
import {
  handleScheduleNetcredChargesRequest,
  type ProcessScheduleDeps,
  type ScheduleNetcredChargesDeps,
} from "./handleRequest.ts";
import { processSchedule } from "./processSchedule.ts";
import type { CronChargeSchedule } from "./types.ts";

const logger = createPaymentLogger("schedule-netcred-charges");


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

function parseClaimedSchedules(data: unknown): CronChargeSchedule[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((row) => {
    const schedule = row as Record<string, unknown>;
    return {
      id: String(schedule.id),
      contracted_service_id: String(schedule.contracted_service_id),
      client_id: String(schedule.client_id),
      provider_id: String(schedule.provider_id),
      gateway_slug: String(schedule.gateway_slug ?? "netcred"),
      client_card_token_id: String(schedule.client_card_token_id),
      installment_number: Number(schedule.installment_number),
      base_amount: Number(schedule.base_amount),
      provider_payout: Number(schedule.provider_payout ?? schedule.base_amount),
      charge_amount: schedule.charge_amount != null
        ? Number(schedule.charge_amount)
        : null,
      netcred_company_id: schedule.netcred_company_id != null
        ? String(schedule.netcred_company_id)
        : null,
      automatic_attempt_count: Number(schedule.automatic_attempt_count),
      max_attempts: Number(schedule.max_attempts),
      clearsale_session_id: schedule.clearsale_session_id
        ? String(schedule.clearsale_session_id)
        : null,
      client_ip_address: schedule.client_ip_address
        ? String(schedule.client_ip_address)
        : null,
      gateway_reference_code: schedule.gateway_reference_code
        ? String(schedule.gateway_reference_code)
        : null,
      service_request_id: schedule.service_request_id
        ? String(schedule.service_request_id)
        : null,
      service_request_title: schedule.service_request_title
        ? String(schedule.service_request_title)
        : null,
    };
  });
}

function createProcessScheduleDeps(
  supabase: ReturnType<typeof createServiceRoleClient>,
  maxAttempts: number,
): ProcessScheduleDeps {
  return {
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
        .select("gateway_payment_profile_id, gateway_card_token, netcred_company_id")
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
        .select("netcred_company_id, netcred_bank_account_id, onboarding_status")
        .eq("provider_id", providerId)
        .eq("gateway_slug", "netcred")
        .maybeSingle();

      if (error || !data || data.onboarding_status !== "ACTIVE") {
        return null;
      }

      return data;
    },
    getTransaction: (input) => AdapterRegistry.get("netcred").getTransaction(input),
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
        p_undo_attempt_increment: input.undoAttemptIncrement,
      });

      if (error) {
        const detail = error.details ? ` details=${error.details}` : "";
        throw new Error(
          `payment_commit_charge_outcome failed: ${error.message} (code=${error.code}${detail})`,
        );
      }

      if (!data) {
        throw new Error("payment_commit_charge_outcome returned no schedule id");
      }

      return String(data);
    },
    loadHistoricalFailureCodes: async (scheduleId) => {
      const { data, error } = await supabase
        .from("payment_attempts")
        .select("failure_code")
        .eq("schedule_id", scheduleId)
        .order("attempt_number");

      if (error || !data) {
        return [];
      }

      return data
        .map((row) => row.failure_code)
        .filter((code): code is string => Boolean(code));
    },
    emitFailedPermanentWarning: (input) => {
      void emitFailedPermanentTransitionWarning(input);
    },
    emitCommitAfterSuccessCritical: (input) => {
      captureCriticalAlertSync(CRITICAL_ALERTS.CHARGE_COMMIT_AFTER_SUCCESS_FAILED, {
        gateway_slug: input.gateway_slug,
        error_type: "CHARGE_COMMIT_AFTER_SUCCESS_FAILED",
        schedule_id: input.schedule_id,
        service_id: input.service_id,
        gateway_charge_id: input.gateway_charge_id,
        gateway_reference_code: input.gateway_reference_code,
        error: input.error,
        current_state: "PROCESSING",
      });
    },
    ingestNotification: async (scheduleId, notificationEvent, metadata) => {
      const { error } = await supabase.rpc("payment_enqueue_notifications", {
        p_schedule_id: scheduleId,
        p_notification_event: notificationEvent,
        p_metadata: metadata as Json,
      });

      if (error) {
        throw new Error(error.message);
      }
    },
    maxAttempts,
    platformCompanyId: resolvePlatformCompanyId(),
    isProduction: resolveIsProduction(),
  };
}

function createDeps(): ScheduleNetcredChargesDeps {
  const supabase = createServiceRoleClient();
  let maxAttempts = 3;

  configureAdapterRegistry({
    supabase,
    platformBankAccountId: resolvePlatformBankAccountId(),
    platformCompanyId: resolvePlatformCompanyId(),
    isProduction: resolveIsProduction(),
  });

  const processDeps = createProcessScheduleDeps(supabase, maxAttempts);

  return {
    dequeueSchedules: async (batchSize) => {
      const constants = await loadPaymentPlatformConstants(supabase);
      maxAttempts = constants.max_charge_attempts;
      processDeps.maxAttempts = maxAttempts;

      // Orphan recovery before claim in the same EF tick (CHK-022 / design §4.6).
      const { error: orphanError } = await supabase.rpc(
        "payment_recover_orphaned_schedules",
      );
      if (orphanError) {
        logger.warn(PAYMENT_LOG_EVENTS.ORPHAN_RECOVERED, {
          phase: "pre_claim_failed",
          error: orphanError.message,
        });
      }

      const { data, error } = await supabase.rpc("payment_claim_charge_batch", {
        p_batch_size: batchSize ?? undefined,
      });

      if (error || !data) {
        return [];
      }

      const schedules = parseClaimedSchedules(data);
      return enrichSchedulesWithServiceRequestIds(supabase, schedules);
    },
    processSchedule: (schedule) => processSchedule(processDeps, schedule),
    captureException: (error, extra) => {
      capturePaymentExceptionSync(error, {
        schedule_id: typeof extra.schedule_id === "string" ? extra.schedule_id : undefined,
        contracted_service_id:
          typeof extra.contracted_service_id === "string"
            ? extra.contracted_service_id
            : undefined,
        automatic_attempt_count:
          typeof extra.automatic_attempt_count === "number"
            ? extra.automatic_attempt_count
            : undefined,
        gateway_slug: typeof extra.gateway_slug === "string" ? extra.gateway_slug : "netcred",
        error_code: typeof extra.error_code === "string" ? extra.error_code : undefined,
        current_state: typeof extra.current_state === "string" ? extra.current_state : undefined,
      });
    },
    maxAttempts,
  };
}

servePaymentFunction("schedule-netcred-charges", (req) =>
  handleScheduleNetcredChargesRequest(req, createDeps()));
