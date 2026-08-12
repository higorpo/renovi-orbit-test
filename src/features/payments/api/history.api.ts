import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import type { ClientPaymentTransaction, ProviderPaymentReceivable } from "../types/paymentHistory.types";

export type ListClientPaymentTransactionsResult = {
  data: ClientPaymentTransaction[];
  error: string | null;
};

export type ListProviderPaymentReceivablesResult = {
  data: ProviderPaymentReceivable[];
  error: string | null;
};

type ClientPaymentTransactionRow = {
  schedule_id: string;
  contracted_service_id: string;
  amount_paid: number;
  service_amount: number;
  installment_number: number;
  paid_at: string;
  refunded_amount: number | null;
  refunded_at: string | null;
  state: string;
  is_disputed: boolean;
  created_at: string;
};

type ProviderPaymentReceivableRow = {
  schedule_id: string;
  contracted_service_id: string;
  amount_received_at_capture: number;
  net_amount_received: number;
  received_at: string;
  refunded_amount: number | null;
  refunded_at: string | null;
  state: string;
  is_disputed: boolean;
  created_at: string;
};

function mapClientPaymentTransaction(row: ClientPaymentTransactionRow): ClientPaymentTransaction {
  return {
    scheduleId: row.schedule_id,
    contractedServiceId: row.contracted_service_id,
    amountPaid: row.amount_paid,
    serviceAmount: row.service_amount,
    installmentNumber: row.installment_number,
    paidAt: row.paid_at,
    refundedAmount: row.refunded_amount,
    refundedAt: row.refunded_at,
    state: row.state as ClientPaymentTransaction["state"],
    isDisputed: row.is_disputed,
    createdAt: row.created_at,
  };
}

function mapProviderPaymentReceivable(row: ProviderPaymentReceivableRow): ProviderPaymentReceivable {
  return {
    scheduleId: row.schedule_id,
    contractedServiceId: row.contracted_service_id,
    amountReceivedAtCapture: row.amount_received_at_capture,
    netAmountReceived: row.net_amount_received,
    receivedAt: row.received_at,
    refundedAmount: row.refunded_amount,
    refundedAt: row.refunded_at,
    state: row.state as ProviderPaymentReceivable["state"],
    isDisputed: row.is_disputed,
    createdAt: row.created_at,
  };
}

export async function listClientPaymentTransactions(): Promise<ListClientPaymentTransactionsResult> {
  const { data, error } = await supabase
    .from("client_payment_transactions_v")
    .select(
      "schedule_id, contracted_service_id, amount_paid, service_amount, installment_number, paid_at, refunded_amount, refunded_at, state, is_disputed, created_at",
    )
    .order("paid_at", { ascending: false });

  if (error) {
    logger.error("client_payment_history_fetch_error", { error: error.message });
    return { data: [], error: error.message };
  }

  return {
    data: (data ?? []).map((row) => mapClientPaymentTransaction(row as ClientPaymentTransactionRow)),
    error: null,
  };
}

export type ListProviderPaymentReceivablesParams = {
  receivedFrom?: string | null;
  receivedTo?: string | null;
};

export async function listProviderPaymentReceivables(
  params: ListProviderPaymentReceivablesParams = {},
): Promise<ListProviderPaymentReceivablesResult> {
  let query = supabase
    .from("provider_payment_receivables_v")
    .select(
      "schedule_id, contracted_service_id, amount_received_at_capture, net_amount_received, received_at, refunded_amount, refunded_at, state, is_disputed, created_at",
    );

  if (params.receivedFrom) {
    query = query.gte("received_at", params.receivedFrom);
  }
  if (params.receivedTo) {
    query = query.lt("received_at", `${params.receivedTo}T23:59:59.999-03:00`);
  }

  const { data, error } = await query.order("received_at", { ascending: false });

  if (error) {
    logger.error("provider_payment_history_fetch_error", { error: error.message });
    return { data: [], error: error.message };
  }

  return {
    data: (data ?? []).map((row) => mapProviderPaymentReceivable(row as ProviderPaymentReceivableRow)),
    error: null,
  };
}
