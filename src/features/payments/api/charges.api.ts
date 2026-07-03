import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import type {
  ContractedServicePaymentContext,
  PaymentScheduleSummary,
} from "../types/paymentSchedule.types";
import { invokePaymentEdgeFunction, mapEdgeErrorPayload } from "./paymentApiClient";
import { PAYMENT_EDGE } from "./payments.edge";

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
  client_card_token_id: string | null;
  installment_number: number;
  base_amount: number;
  failure_reason: string | null;
  failure_code: string | null;
  is_disputed: boolean;
  paid_at: string | null;
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
    paymentTokenId: row.client_card_token_id,
    installmentNumber: row.installment_number,
    baseAmount: row.base_amount,
    failureReason: row.failure_reason,
    failureCode: row.failure_code,
    isDisputed: row.is_disputed,
    paidAt: row.paid_at,
  };
}

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
      error: message,
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

export async function fetchPaymentScheduleByContractedService(
  contractedServiceId: string,
): Promise<FetchPaymentScheduleResult> {
  const { data, error } = await supabase
    .from("payment_schedules")
    .select(
      "id, contracted_service_id, state, client_card_token_id, installment_number, base_amount, failure_reason, failure_code, is_disputed, paid_at",
    )
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
