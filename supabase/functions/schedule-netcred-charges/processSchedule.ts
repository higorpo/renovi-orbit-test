import {
  createPaymentLogger,
  PAYMENT_LOG_EVENTS,
} from "../_shared/observability/payment-logger.ts";
import { emitMissingClearSaleSessionWarning } from "../_shared/observability/payment-sentry-matrix.ts";
import { ProviderAuthError } from "../_shared/payment/errors.ts";
import { resolveIsProduction } from "../_shared/payment/netcred-auth.ts";
import type {
  CreateChargeInput,
  CreateChargeResult,
  GetTransactionResult,
  PaymentProvider,
} from "../_shared/payment/types.ts";
import { resolveChargeReferenceCode } from "../_shared/payment/chargeReferenceCode.ts";
import { buildPayoutRule } from "../_shared/payment/buildPayoutRule.ts";
import { resolveRejectedTransactionFailureCode } from "../_shared/payment/map-rejected-reason.ts";
import {
  buildChargeAttemptCompletedFields,
  buildProviderResponseSummary,
  chargeResultLogFields,
  resolveGatewayReferenceCode,
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
    gateway_reference_code: resolveGatewayReferenceCode(schedule),
  };
}

export type CommitChargeResultInput = {
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
};

export type ProcessScheduleDeps = {
  calculateChargeAmount: (input: {
    clientCardTokenId: string;
    baseAmount: number;
    installmentNumber: number;
  }) => Promise<string | null>;
  loadPaymentToken: (tokenId: string) => Promise<{
    gateway_payment_profile_id: string;
    gateway_card_token: string;
    netcred_company_id: string;
  } | null>;
  loadProviderAccount: (providerId: string) => Promise<{
    netcred_company_id: string | null;
    netcred_bank_account_id: string | null;
    onboarding_status: string;
  } | null>;
  getTransaction: PaymentProvider["getTransaction"];
  createCharge: PaymentProvider["createCharge"];
  commitResult: (input: CommitChargeResultInput) => Promise<string>;
  loadHistoricalFailureCodes: (scheduleId: string) => Promise<string[]>;
  emitFailedPermanentWarning: (input: {
    service_id: string;
    schedule_id: string;
    gateway_slug: string;
    failure_codes: string[];
  }) => void;
  /** CRITICAL when gateway success/reconcile confirmed but commit still fails. */
  emitCommitAfterSuccessCritical?: (input: {
    service_id: string;
    schedule_id: string;
    gateway_slug: string;
    error: string;
    gateway_charge_id?: string;
    gateway_reference_code?: string;
  }) => void;
  ingestNotification: (
    scheduleId: string,
    notificationEvent: string,
    metadata: Record<string, unknown>,
  ) => Promise<void>;
  maxAttempts: number;
  /** Renovi platform NetCred company — card profiles and chargeCreate scope. */
  platformCompanyId: string;
  /** When true (production), missing ClearSale session fails closed without createCharge. */
  isProduction?: boolean;
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

function buildCommitInput(
  schedule: CronChargeSchedule,
  chargeResult: CreateChargeResult,
  chargeAmount: string,
  gatewayLatencyMs: number,
  maxAttempts: number,
): CommitChargeResultInput {
  const { outcome, undoAttemptIncrement } = resolveCronChargeOutcome(
    chargeResult,
    schedule.automatic_attempt_count,
    maxAttempts,
  );

  return {
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
  };
}

function resolveCompanyIdForReconcile(schedule: CronChargeSchedule): string {
  const companyId = schedule.netcred_company_id?.trim();
  if (!companyId) {
    throw new Error("NETCRED_COMPANY_ID_REQUIRED");
  }
  return companyId;
}

/**
 * After gateway success, commit failure must not leave money state untracked:
 * getTransaction + retry commit once. If still failing → CRITICAL and rethrow
 * (schedule stays PROCESSING until lease orphan / reconcile).
 */
async function commitResultWithSuccessRetry(
  deps: ProcessScheduleDeps,
  schedule: CronChargeSchedule,
  chargeResult: CreateChargeResult,
  chargeAmount: string,
  gatewayLatencyMs: number,
): Promise<{ outcome: ReturnType<typeof resolveCronChargeOutcome>["outcome"]; chargeAmount: string }> {
  const primary = buildCommitInput(
    schedule,
    chargeResult,
    chargeAmount,
    gatewayLatencyMs,
    deps.maxAttempts,
  );

  try {
    await deps.commitResult(primary);
    return { outcome: primary.outcome, chargeAmount };
  } catch (commitError) {
    if (!chargeResult.success) {
      throw commitError;
    }

    const referenceCode = resolveChargeReferenceCode({
      gatewayReferenceCode: schedule.gateway_reference_code,
      contractedServiceId: schedule.contracted_service_id,
    });

    logger.warn(PAYMENT_LOG_EVENTS.CHARGE_COMMIT_RETRY, {
      ...scheduleContext(schedule),
      gateway_reference_code: referenceCode,
      gateway_charge_id: chargeResult.chargeId,
      error: commitError instanceof Error ? commitError.message : String(commitError),
    });

    let retryChargeResult = chargeResult;
    let retryAmount = chargeAmount;

    try {
      const existing = await deps.getTransaction({
        referenceCode,
        companyId: resolveCompanyIdForReconcile(schedule),
      });

      if (existing?.transactionState === "PAID") {
        if (existing.paidAmount != null && String(existing.paidAmount).trim() !== "") {
          const gatewayAmount = Number(existing.paidAmount).toFixed(2);
          if (Math.abs(Number(gatewayAmount) - Number(chargeAmount)) > 0.01) {
            logger.warn("reconcile_charge_amount_mismatch", {
              ...scheduleContext(schedule),
              gateway_amount: gatewayAmount,
              expected_amount: chargeAmount,
            });
            retryChargeResult = {
              success: true,
              transactionState: "IN_ANALYSIS",
              chargeId: existing.chargeId ?? chargeResult.chargeId,
              transactionId: existing.transactionId ?? chargeResult.transactionId,
            };
          } else {
            retryAmount = gatewayAmount;
            retryChargeResult = {
              success: true,
              transactionState: "PAID",
              chargeId: existing.chargeId ?? chargeResult.chargeId,
              transactionId: existing.transactionId ?? chargeResult.transactionId,
            };
          }
        } else {
          retryChargeResult = {
            success: true,
            transactionState: "PAID",
            chargeId: existing.chargeId ?? chargeResult.chargeId,
            transactionId: existing.transactionId ?? chargeResult.transactionId,
          };
        }
      } else if (existing?.transactionState === "IN_ANALYSIS") {
        retryChargeResult = {
          success: true,
          transactionState: "IN_ANALYSIS",
          chargeId: existing.chargeId ?? chargeResult.chargeId,
          transactionId: existing.transactionId ?? chargeResult.transactionId,
        };
      }
    } catch (lookupError) {
      logger.warn(PAYMENT_LOG_EVENTS.CHARGE_COMMIT_RETRY, {
        ...scheduleContext(schedule),
        phase: "get_transaction_failed",
        error: lookupError instanceof Error ? lookupError.message : String(lookupError),
      });
    }

    const retry = buildCommitInput(
      schedule,
      retryChargeResult,
      retryAmount,
      gatewayLatencyMs,
      deps.maxAttempts,
    );

    try {
      await deps.commitResult(retry);
      return { outcome: retry.outcome, chargeAmount: retryAmount };
    } catch (retryError) {
      deps.emitCommitAfterSuccessCritical?.({
        service_id: schedule.contracted_service_id,
        schedule_id: schedule.id,
        gateway_slug: schedule.gateway_slug,
        error: retryError instanceof Error ? retryError.message : String(retryError),
        gateway_charge_id: retryChargeResult.chargeId,
        gateway_reference_code: referenceCode,
      });
      throw retryError;
    }
  }
}

async function enqueueNotificationsNonFatal(
  deps: ProcessScheduleDeps,
  schedule: CronChargeSchedule,
  outcome: ReturnType<typeof resolveCronChargeOutcome>["outcome"],
  chargeAmount: string,
): Promise<void> {
  try {
    await enqueueCronChargeNotifications(
      deps.ingestNotification,
      schedule,
      outcome,
      chargeAmount,
    );
  } catch (error) {
    // Money path already committed — never fail the charge outcome on MMD enqueue.
    logger.warn(PAYMENT_LOG_EVENTS.NOTIFICATION_ENQUEUE_FAILED, {
      ...scheduleContext(schedule),
      outcome,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function commitFromChargeResult(
  deps: ProcessScheduleDeps,
  schedule: CronChargeSchedule,
  chargeResult: CreateChargeResult,
  chargeAmount: string,
  gatewayLatencyMs: number,
  reconciled: boolean,
): Promise<ProcessedScheduleResult> {
  const committed = await commitResultWithSuccessRetry(
    deps,
    schedule,
    chargeResult,
    chargeAmount,
    gatewayLatencyMs,
  );

  await enqueueNotificationsNonFatal(
    deps,
    schedule,
    committed.outcome,
    committed.chargeAmount,
  );

  if (committed.outcome === "FAILED_PERMANENT") {
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
    outcome: committed.outcome,
    chargeAmount: committed.chargeAmount,
    reconciled,
  };
}

async function resolveExpectedChargeAmount(
  deps: ProcessScheduleDeps,
  schedule: CronChargeSchedule,
): Promise<string> {
  if (schedule.charge_amount != null) {
    return Number(schedule.charge_amount).toFixed(2);
  }

  const calculated = await deps.calculateChargeAmount({
    clientCardTokenId: schedule.client_card_token_id,
    baseAmount: schedule.base_amount,
    installmentNumber: schedule.installment_number,
  });

  if (!calculated) {
    throw new Error("CHARGE_AMOUNT_CALCULATION_FAILED");
  }

  return calculated;
}

async function commitFromExistingTransaction(
  deps: ProcessScheduleDeps,
  schedule: CronChargeSchedule,
  existing: GetTransactionResult,
): Promise<ProcessedScheduleResult> {
  const expectedAmount = await resolveExpectedChargeAmount(deps, schedule);

  if (existing.paidAmount != null && String(existing.paidAmount).trim() !== "") {
    const gatewayAmount = Number(existing.paidAmount).toFixed(2);
    if (Math.abs(Number(gatewayAmount) - Number(expectedAmount)) > 0.01) {
      logger.warn("reconcile_charge_amount_mismatch", {
        ...scheduleContext(schedule),
        gateway_amount: gatewayAmount,
        expected_amount: expectedAmount,
      });

      // Fail closed: gateway PAID with unexpected amount → hold for ops review.
      const mismatchResult: CreateChargeResult = {
        success: true,
        transactionState: "IN_ANALYSIS",
        chargeId: existing.chargeId,
        transactionId: existing.transactionId,
      };
      return commitFromChargeResult(
        deps,
        schedule,
        mismatchResult,
        expectedAmount,
        0,
        true,
      );
    }

    const paidResult: CreateChargeResult = {
      success: true,
      transactionState: "PAID",
      chargeId: existing.chargeId,
      transactionId: existing.transactionId,
    };
    return commitFromChargeResult(deps, schedule, paidResult, gatewayAmount, 0, true);
  }

  // Never commit charge_amount 0.00 when gateway omits paidAmount.
  const chargeResult: CreateChargeResult = {
    success: true,
    transactionState: "PAID",
    chargeId: existing.chargeId,
    transactionId: existing.transactionId,
  };

  return commitFromChargeResult(deps, schedule, chargeResult, expectedAmount, 0, true);
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

  const platformCompanyId = deps.platformCompanyId.trim();
  if (!platformCompanyId) {
    throw new Error("PLATFORM_COMPANY_NOT_CONFIGURED");
  }

  // Token must be platform-scoped (marketplace tokenize model).
  if (paymentToken.netcred_company_id.trim() !== platformCompanyId) {
    throw new Error("PAYMENT_TOKEN_COMPANY_MISMATCH");
  }

  const chargeAmount = await resolveExpectedChargeAmount(deps, schedule);

  const clearsaleSessionId = schedule.clearsale_session_id?.trim() || null;
  if (!clearsaleSessionId) {
    logger.warn("missing_clearsale_session_id", { schedule_id: schedule.id });
    void emitMissingClearSaleSessionWarning({
      schedule_id: schedule.id,
      service_id: schedule.contracted_service_id,
    });

    // Production fail-closed: never createCharge without ClearSale sessionId (CHK-012).
    if (resolveIsProduction(deps.isProduction)) {
      await deps.commitResult({
        scheduleId: schedule.id,
        outcome: "FAILED",
        chargeAmount,
        failureCode: "MISSING_CLEARSALE_SESSION_ID",
        failureReason: "clearsale_session_id is required for chargeCreate in production",
        gatewayLatencyMs: 0,
        providerResponseSummary: {
          error_code: "MISSING_CLEARSALE_SESSION_ID",
          retryable: true,
        },
        undoAttemptIncrement: true,
      });

      logChargeAttemptCompleted(schedule, {
        outcome: "FAILED",
        failure_code: "MISSING_CLEARSALE_SESSION_ID",
        retryable: true,
      });

      return {
        scheduleId: schedule.id,
        outcome: "FAILED",
        chargeAmount,
        reconciled: false,
      };
    }
  }

  // Apply null fallback before toFixed — Number(null) is 0 → FIXED "0.00".
  const providerPayoutAmount = Number(
    schedule.provider_payout ?? schedule.base_amount,
  ).toFixed(2);

  const payoutRule = buildPayoutRule(
    {
      netcredCompanyId: providerAccount.netcred_company_id,
      netcredBankAccountId: providerAccount.netcred_bank_account_id,
    },
    providerPayoutAmount,
    chargeAmount,
  );

  const chargeInput: CreateChargeInput = {
    referenceCode: resolveChargeReferenceCode({
      gatewayReferenceCode: schedule.gateway_reference_code,
      contractedServiceId: schedule.contracted_service_id,
    }),
    serviceTitle: schedule.service_request_title ?? undefined,
    amount: chargeAmount,
    paymentMethod: {
      type: "CREDIT_CARD",
      installmentNumber: schedule.installment_number,
      paymentProfileId: paymentToken.gateway_payment_profile_id,
      paymentToken: paymentToken.gateway_card_token,
    },
    payoutRule,
    sessionId: clearsaleSessionId ?? undefined,
    customerIpAddress: schedule.client_ip_address ?? undefined,
  };

  // Charge/getTransaction scope = provider merchant; token stays platform-scoped.
  const scheduleForCharge: CronChargeSchedule = {
    ...schedule,
    netcred_company_id:
      schedule.netcred_company_id?.trim() ||
      providerAccount.netcred_company_id.trim(),
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
        message: execution.existing.rejectedReason?.trim() ||
          "Existing transaction is REJECTED",
        originalCode: resolveRejectedTransactionFailureCode(
          execution.existing.rejectedReason,
        ),
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
