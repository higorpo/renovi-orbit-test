import {
  createPaymentLogger,
  PAYMENT_LOG_EVENTS,
} from "../_shared/observability/payment-logger.ts";
import type {
  CreateChargeInput,
  CreateChargeResult,
  GetTransactionResult,
  PaymentProvider,
} from "../_shared/payment/types.ts";
import { buildPayoutRule } from "../_shared/payment/buildPayoutRule.ts";
import { executeCharge } from "./executeCharge.ts";
import { enqueueCronChargeNotifications } from "./enqueueNotifications.ts";
import { resolveCronChargeOutcome } from "./resolveCronChargeOutcome.ts";
import type {
  CronChargeSchedule,
  ProcessedScheduleResult,
} from "./types.ts";

const logger = createPaymentLogger("schedule-netcred-charges");

function scheduleContext(schedule: CronChargeSchedule) {
  return {
    service_id: schedule.contracted_service_id,
    schedule_id: schedule.id,
    gateway_slug: schedule.gateway_slug,
  };
}

export type ProcessScheduleDeps = {
  calculateChargeAmount: (input: {
    clientCardTokenId: string;
    baseAmount: number;
    installmentNumber: number;
  }) => Promise<string | null>;
  loadPaymentToken: (tokenId: string) => Promise<{
    gateway_payment_profile_id: string;
    gateway_card_token: string;
  } | null>;
  loadProviderAccount: (providerId: string) => Promise<{
    netcred_company_id: string | null;
    netcred_bank_account_id: string | null;
    onboarding_status: string;
  } | null>;
  getTransaction: PaymentProvider["getTransaction"];
  createCharge: PaymentProvider["createCharge"];
  commitResult: (input: {
    scheduleId: string;
    outcome: ReturnType<typeof resolveCronChargeOutcome>["outcome"];
    chargeAmount: string;
    providerChargeId?: string;
    providerTransactionId?: string;
    failureCode?: string;
    failureReason?: string;
    gatewayLatencyMs: number;
    providerResponseSummary: Record<string, unknown>;
    undoAttemptIncrement: boolean;
  }) => Promise<string | null>;
  loadHistoricalFailureCodes: (scheduleId: string) => Promise<string[]>;
  emitFailedPermanentWarning: (input: {
    service_id: string;
    schedule_id: string;
    gateway_slug: string;
    failure_codes: string[];
  }) => void;
  ingestNotification: (
    scheduleId: string,
    notificationEvent: string,
    metadata: Record<string, unknown>,
  ) => Promise<void>;
  maxAttempts: number;
  now?: () => number;
};

function buildProviderResponseSummary(
  result: CreateChargeResult,
): Record<string, unknown> {
  return {
    success: result.success,
    transactionState: result.transactionState ?? null,
    chargeId: result.chargeId ?? null,
    transactionId: result.transactionId ?? null,
    errorCode: result.error?.code ?? null,
    originalCode: result.error?.originalCode ?? null,
  };
}

async function commitFromChargeResult(
  deps: ProcessScheduleDeps,
  schedule: CronChargeSchedule,
  chargeResult: CreateChargeResult,
  chargeAmount: string,
  gatewayLatencyMs: number,
  reconciled: boolean,
): Promise<ProcessedScheduleResult> {
  const { outcome, undoAttemptIncrement } = resolveCronChargeOutcome(
    chargeResult,
    schedule.automatic_attempt_count,
    deps.maxAttempts,
  );

  await deps.commitResult({
    scheduleId: schedule.id,
    outcome,
    chargeAmount,
    providerChargeId: chargeResult.chargeId,
    providerTransactionId: chargeResult.transactionId,
    failureCode: chargeResult.error?.originalCode ?? chargeResult.error?.code,
    failureReason: chargeResult.error?.message,
    gatewayLatencyMs,
    providerResponseSummary: buildProviderResponseSummary(chargeResult),
    undoAttemptIncrement,
  });

  await enqueueCronChargeNotifications(
    deps.ingestNotification,
    schedule,
    outcome,
    chargeAmount,
  );

  if (outcome === "FAILED_PERMANENT") {
    const historicalCodes = await deps.loadHistoricalFailureCodes(schedule.id);
    const failureCodes = [
      ...new Set([
        ...historicalCodes,
        chargeResult.error?.originalCode,
        chargeResult.error?.code,
      ].filter((code): code is string => Boolean(code))),
    ];

    deps.emitFailedPermanentWarning({
      service_id: schedule.contracted_service_id,
      schedule_id: schedule.id,
      gateway_slug: schedule.gateway_slug,
      failure_codes: failureCodes,
    });
  }

  return {
    scheduleId: schedule.id,
    outcome,
    chargeAmount,
    reconciled,
  };
}

async function commitFromExistingTransaction(
  deps: ProcessScheduleDeps,
  schedule: CronChargeSchedule,
  existing: GetTransactionResult,
): Promise<ProcessedScheduleResult> {
  const chargeAmount = existing.paidAmount ?? "0.00";
  const chargeResult: CreateChargeResult = {
    success: true,
    transactionState: "PAID",
    chargeId: existing.chargeId,
    transactionId: existing.transactionId,
  };

  return commitFromChargeResult(deps, schedule, chargeResult, chargeAmount, 0, true);
}

export async function processSchedule(
  deps: ProcessScheduleDeps,
  schedule: CronChargeSchedule,
): Promise<ProcessedScheduleResult> {
  logger.info(PAYMENT_LOG_EVENTS.CHARGE_ATTEMPT_STARTED, {
    ...scheduleContext(schedule),
    attempt_number: schedule.automatic_attempt_count,
    initiator: "cron",
  });

  const paymentToken = await deps.loadPaymentToken(schedule.client_card_token_id);
  if (!paymentToken) {
    throw new Error("PAYMENT_TOKEN_NOT_FOUND");
  }

  const providerAccount = await deps.loadProviderAccount(schedule.provider_id);
  if (!providerAccount?.netcred_company_id || !providerAccount.netcred_bank_account_id) {
    throw new Error("PROVIDER_NOT_CREDENTIALED");
  }

  const chargeAmount = schedule.charge_amount != null
    ? Number(schedule.charge_amount).toFixed(2)
    : await deps.calculateChargeAmount({
      clientCardTokenId: schedule.client_card_token_id,
      baseAmount: schedule.base_amount,
      installmentNumber: schedule.installment_number,
    });

  if (!chargeAmount) {
    throw new Error("CHARGE_AMOUNT_CALCULATION_FAILED");
  }

  if (!schedule.clearsale_session_id) {
    logger.warn("missing_clearsale_session_id", { schedule_id: schedule.id });
  }

  const payoutRule = buildPayoutRule(
    {
      netcredCompanyId: providerAccount.netcred_company_id,
      netcredBankAccountId: providerAccount.netcred_bank_account_id,
    },
    Number(schedule.provider_payout).toFixed(2),
    chargeAmount,
  );

  const chargeInput: CreateChargeInput = {
    referenceCode: schedule.contracted_service_id,
    amount: chargeAmount,
    paymentMethod: {
      type: "CREDIT_CARD",
      installmentNumber: schedule.installment_number,
      paymentProfileId: paymentToken.gateway_payment_profile_id,
      paymentToken: paymentToken.gateway_card_token,
    },
    payoutRule,
    sessionId: schedule.clearsale_session_id ?? undefined,
    customerIpAddress: schedule.client_ip_address ?? undefined,
  };

  const execution = await executeCharge(deps, schedule, chargeInput);

  if (execution.kind === "reconciled") {
    if (execution.existing.transactionState === "PAID") {
      const result = await commitFromExistingTransaction(
        deps,
        schedule,
        execution.existing,
      );
      logger.info(PAYMENT_LOG_EVENTS.CHARGE_ATTEMPT_COMPLETED, {
        ...scheduleContext(schedule),
        outcome: result.outcome,
        reconciled: true,
        attempt_number: schedule.automatic_attempt_count,
        initiator: "cron",
      });
      return result;
    }

    const result = await commitFromChargeResult(
      deps,
      schedule,
      {
        success: false,
        transactionState: "REJECTED",
        chargeId: execution.existing.chargeId,
        transactionId: execution.existing.transactionId,
        error: {
          code: "TERMINAL",
          message: "Existing transaction is REJECTED",
          originalCode: "REJECTED",
        },
      },
      chargeAmount,
      0,
      true,
    );
    logger.info(PAYMENT_LOG_EVENTS.CHARGE_ATTEMPT_COMPLETED, {
      ...scheduleContext(schedule),
      outcome: result.outcome,
      reconciled: true,
      attempt_number: schedule.automatic_attempt_count,
      initiator: "cron",
    });
    return result;
  }

  const result = await commitFromChargeResult(
    deps,
    schedule,
    execution.chargeResult,
    chargeAmount,
    execution.gatewayLatencyMs,
    false,
  );

  logger.info(PAYMENT_LOG_EVENTS.CHARGE_ATTEMPT_COMPLETED, {
    ...scheduleContext(schedule),
    outcome: result.outcome,
    gateway_latency_ms: execution.gatewayLatencyMs,
    charge_amount: chargeAmount,
    attempt_number: schedule.automatic_attempt_count,
    initiator: "cron",
  });

  return result;
}
