import {
  createPaymentLogger,
  PAYMENT_LOG_EVENTS,
} from "../_shared/observability/payment-logger.ts";
import { emitMissingClearSaleSessionWarning } from "../_shared/observability/payment-sentry-matrix.ts";
import { ProviderAuthError } from "../_shared/payment/errors.ts";
import type {
  CreateChargeInput,
  CreateChargeResult,
  GetTransactionResult,
  PaymentProvider,
} from "../_shared/payment/types.ts";
import { buildPayoutRule } from "../_shared/payment/buildPayoutRule.ts";
import {
  buildChargeAttemptCompletedFields,
  buildProviderResponseSummary,
  chargeResultLogFields,
} from "./chargeAttemptLogging.ts";
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
  }) => Promise<string>;
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

function logChargeAttemptCompleted(
  schedule: CronChargeSchedule,
  extra: Record<string, unknown>,
  chargeResult?: CreateChargeResult,
): void {
  const fields = buildChargeAttemptCompletedFields(schedule, extra, chargeResult);

  if (chargeResult && !chargeResult.success) {
    logger.warn(PAYMENT_LOG_EVENTS.CHARGE_ATTEMPT_COMPLETED, fields);
    return;
  }

  logger.info(PAYMENT_LOG_EVENTS.CHARGE_ATTEMPT_COMPLETED, fields);
}

function logGatewayChargeRejected(
  schedule: CronChargeSchedule,
  chargeAmount: string,
  paymentProfileId: string,
  chargeResult: CreateChargeResult,
): void {
  logger.warn("gateway_charge_create_rejected", {
    ...scheduleContext(schedule),
    attempt_number: schedule.automatic_attempt_count,
    netcred_company_id: schedule.netcred_company_id,
    payment_profile_id: paymentProfileId,
    charge_amount: chargeAmount,
    ...chargeResultLogFields(chargeResult),
  });
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

async function commitAuthFailure(
  deps: ProcessScheduleDeps,
  schedule: CronChargeSchedule,
  chargeAmount: string,
  error: ProviderAuthError,
): Promise<ProcessedScheduleResult> {
  await deps.commitResult({
    scheduleId: schedule.id,
    outcome: "FAILED",
    chargeAmount,
    failureCode: "NETCRED_AUTH_FAILURE",
    failureReason: error.message,
    gatewayLatencyMs: 0,
    providerResponseSummary: {
      auth_failure: true,
      error_code: "NETCRED_AUTH_FAILURE",
      errorMessage: error.message,
    },
    undoAttemptIncrement: true,
  });

  logChargeAttemptCompleted(schedule, {
    outcome: "FAILED",
    auth_failure: true,
  });

  return {
    scheduleId: schedule.id,
    outcome: "FAILED",
    chargeAmount,
    reconciled: false,
  };
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
    void emitMissingClearSaleSessionWarning({
      schedule_id: schedule.id,
      service_id: schedule.contracted_service_id,
    });
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

  const scheduleForCharge: CronChargeSchedule = {
    ...schedule,
    netcred_company_id:
      schedule.netcred_company_id?.trim() || providerAccount.netcred_company_id?.trim() || null,
    provider_payout: schedule.provider_payout ?? schedule.base_amount,
  };

  let execution: Awaited<ReturnType<typeof executeCharge>>;
  try {
    execution = await executeCharge(deps, scheduleForCharge, chargeInput);
  } catch (error) {
    if (error instanceof ProviderAuthError) {
      return commitAuthFailure(deps, schedule, chargeAmount, error);
    }
    throw error;
  }

  if (execution.kind === "reconciled") {
    if (execution.existing.transactionState === "PAID") {
      const result = await commitFromExistingTransaction(
        deps,
        schedule,
        execution.existing,
      );
      logChargeAttemptCompleted(schedule, {
        outcome: result.outcome,
        reconciled: true,
      });
      return result;
    }

    const rejectedResult: CreateChargeResult = {
      success: false,
      transactionState: "REJECTED",
      chargeId: execution.existing.chargeId,
      transactionId: execution.existing.transactionId,
      error: {
        code: "TERMINAL",
        message: "Existing transaction is REJECTED",
        originalCode: "REJECTED",
      },
    };

    const result = await commitFromChargeResult(
      deps,
      schedule,
      rejectedResult,
      chargeAmount,
      0,
      true,
    );
    logChargeAttemptCompleted(
      schedule,
      { outcome: result.outcome, reconciled: true },
      rejectedResult,
    );
    return result;
  }

  if (!execution.chargeResult.success) {
    logGatewayChargeRejected(
      scheduleForCharge,
      chargeAmount,
      paymentToken.gateway_payment_profile_id,
      execution.chargeResult,
    );
  }

  const result = await commitFromChargeResult(
    deps,
    schedule,
    execution.chargeResult,
    chargeAmount,
    execution.gatewayLatencyMs,
    false,
  );

  logChargeAttemptCompleted(
    schedule,
    {
      outcome: result.outcome,
      gateway_latency_ms: execution.gatewayLatencyMs,
      charge_amount: chargeAmount,
      reconciled: false,
    },
    execution.chargeResult,
  );

  return result;
}
