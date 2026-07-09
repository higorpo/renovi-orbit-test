import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import type {
  ContractedServicePaymentContext,
  PaymentScheduleLifecycle,
  PaymentScheduleSummary,
} from "../types/paymentSchedule.types";
import { invokePaymentEdgeFunction, mapEdgeErrorPayload } from "./paymentApiClient";
import { mapPaymentUserMessage } from "../utils/mapPaymentUserMessage";
import { PAYMENT_EDGE } from "./payments.edge";

const PAYMENT_SCHEDULE_TABLE = "payment_schedules" as const;

// Column-level SELECT allowlist for authenticated participants (§3.5).
const PAYMENT_SCHEDULE_PARTICIPANT_COLUMNS =
  "id, contracted_service_id, state, installment_number, failure_reason, failure_code, is_disputed, paid_at" as const;

const PAYMENT_SCHEDULE_LIFECYCLE_COLUMNS =
  "contracted_service_id, state, charge_scheduled_at" as const;

export type ManualChargePaymentRequest = {
  scheduleId: string;
  clearsaleSessionId: string;
};

export type ManualChargeOutcome = "PAID" | "IN_ANALYSIS" | "FAILED" | "FAILED_PERMANENT";

export type ManualChargePaymentSuccess = {
  scheduleId: string;
  outcome: ManualChargeOutcome;
  chargeAmount: string;
};

export type ManualChargePaymentResult = {
  data: ManualChargePaymentSuccess | null;
  error: string | null;
  errorCode?: string;
  status?: number;
};

export type FetchPaymentScheduleResult = {
  data: PaymentScheduleSummary | null;
  error: string | null;
};

export type FetchContractedServicePaymentContextResult = {
  data: ContractedServicePaymentContext | null;
  error: string | null;
};

type PaymentScheduleRow = {
  id: string;
  contracted_service_id: string;
  state: string;
  installment_number: number;
  failure_reason: string | null;
  failure_code: string | null;
  is_disputed: boolean;
  paid_at: string | null;
};

type PaymentScheduleLifecycleRow = {
  contracted_service_id: string;
  state: string;
  charge_scheduled_at: string | null;
};

type ClientPaymentAmountsRow = {
  amount_paid: number;
  service_amount: number;
};

type ContractedServiceRow = {
  accepted_proposal_id: string;
  service_request_id: string;
};

function mapPaymentSchedule(row: PaymentScheduleRow): PaymentScheduleSummary {
  return {
    id: row.id,
    contractedServiceId: row.contracted_service_id,
    state: row.state,
    paymentTokenId: null,
    installmentNumber: row.installment_number,
    baseAmount: null,
    failureReason: row.failure_reason,
    failureCode: row.failure_code,
    isDisputed: row.is_disputed,
    paidAt: row.paid_at,
  };
}

function mapPaymentScheduleLifecycle(
  row: PaymentScheduleLifecycleRow,
  amounts?: ClientPaymentAmountsRow | null,
): PaymentScheduleLifecycle {
  return {
    contractedServiceId: row.contracted_service_id,
    state: row.state,
    chargeScheduledAt: row.charge_scheduled_at,
    // Amounts come from client_payment_transactions_v (column allowlist hides them on the table).
    baseAmount: amounts != null ? Number(amounts.service_amount) : null,
    paidAmount: amounts != null ? Number(amounts.amount_paid) : null,
  };
}

export type FetchPaymentScheduleLifecycleResult = {
  data: PaymentScheduleLifecycle | null;
  error: string | null;
};

export async function manualChargePayment(
  request: ManualChargePaymentRequest,
): Promise<ManualChargePaymentResult> {
  const { ok, status, payload } = await invokePaymentEdgeFunction(
    PAYMENT_EDGE.manualChargePayment,
    {
      schedule_id: request.scheduleId,
      clearsale_session_id: request.clearsaleSessionId,
    },
  );

  if (!ok) {
    const { message, errorCode } = mapEdgeErrorPayload(payload, "Falha ao processar pagamento");

    logger.warn("manual_charge_payment_failed", {
      status,
      errorCode,
      error: message,
    });

    return {
      data: null,
      error: mapPaymentUserMessage(errorCode ?? message, {
        fallback: "Não foi possível processar o pagamento. Tente novamente.",
      }),
      errorCode,
      status,
    };
  }

  return {
    data: {
      scheduleId: String(payload.schedule_id),
      outcome: payload.outcome as ManualChargeOutcome,
      chargeAmount: String(payload.charge_amount),
    },
    error: null,
  };
}

export async function fetchPaymentScheduleLifecycleByContractedService(
  contractedServiceId: string,
): Promise<FetchPaymentScheduleLifecycleResult> {
  const { data, error } = await supabase
    .from(PAYMENT_SCHEDULE_TABLE)
    .select(PAYMENT_SCHEDULE_LIFECYCLE_COLUMNS)
    .eq("contracted_service_id", contractedServiceId)
    .maybeSingle();

  if (error) {
    logger.error("payment_schedule_lifecycle_fetch_error", {
      contractedServiceId,
      error: error.message,
    });
    return { data: null, error: error.message };
  }

  if (!data) {
    return { data: null, error: null };
  }

  const row = data as PaymentScheduleLifecycleRow;
  let amounts: ClientPaymentAmountsRow | null = null;

  // Client history view exposes base/paid amounts; providers get null (RLS).
  if (row.state === "PAID") {
    const { data: tx, error: txError } = await supabase
      .from("client_payment_transactions_v")
      .select("amount_paid, service_amount")
      .eq("contracted_service_id", contractedServiceId)
      .maybeSingle();

    if (txError) {
      logger.warn("payment_schedule_lifecycle_amounts_fetch_error", {
        contractedServiceId,
        error: txError.message,
      });
    } else if (tx) {
      amounts = tx as ClientPaymentAmountsRow;
    }
  }

  return {
    data: mapPaymentScheduleLifecycle(row, amounts),
    error: null,
  };
}

export async function fetchPaymentScheduleByContractedService(
  contractedServiceId: string,
): Promise<FetchPaymentScheduleResult> {
  const { data, error } = await supabase
    .from(PAYMENT_SCHEDULE_TABLE)
    .select(PAYMENT_SCHEDULE_PARTICIPANT_COLUMNS)
    .eq("contracted_service_id", contractedServiceId)
    .maybeSingle();

  if (error) {
    logger.error("payment_schedule_fetch_error", {
      contractedServiceId,
      error: error.message,
    });
    return { data: null, error: error.message };
  }

  if (!data) {
    return { data: null, error: null };
  }

  return {
    data: mapPaymentSchedule(data as PaymentScheduleRow),
    error: null,
  };
}

export async function fetchContractedServicePaymentContext(
  contractedServiceId: string,
): Promise<FetchContractedServicePaymentContextResult> {
  const { data, error } = await supabase
    .from("contracted_services")
    .select("accepted_proposal_id, service_request_id")
    .eq("id", contractedServiceId)
    .maybeSingle();

  if (error) {
    logger.error("contracted_service_payment_context_error", {
      contractedServiceId,
      error: error.message,
    });
    return { data: null, error: error.message };
  }

  const row = data as ContractedServiceRow | null;
  if (!row?.accepted_proposal_id || !row.service_request_id) {
    return { data: null, error: null };
  }

  return {
    data: {
      acceptedProposalId: row.accepted_proposal_id,
      serviceRequestId: row.service_request_id,
    },
    error: null,
  };
}
