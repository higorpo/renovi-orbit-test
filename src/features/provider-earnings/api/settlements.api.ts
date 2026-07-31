import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import type {
  ListProviderSettlementsParams,
  ListProviderSettlementsResult,
  PaginatedSettlementMovements,
  SettlementMovement,
  SettlementRecordType,
} from "../types/settlements.types";
import { PROVIDER_EARNINGS_RPC } from "./settlements.rpc";

type RpcSettlementMovementRow = {
  id: string;
  payment_schedule_id: string | null;
  provider_id: string;
  gateway_slug: string;
  gateway_payout_id: string;
  gateway_movement_id: string;
  gateway_transaction_id: string;
  payout_status: string | null;
  movement_status: string;
  movement_type: string | null;
  movement_source: string | null;
  record_type: string;
  installment: number | null;
  gross_amount: number | string;
  net_amount: number | string;
  base_settle_date: string | null;
  settling_at: string | null;
  settled_at: string | null;
  is_advance: boolean;
  is_refund_clawback: boolean;
  brand: string | null;
  bank_account_mask: string | null;
  sync_source: string;
  synced_at: string;
  created_at: string;
  updated_at: string;
};

type RpcListSettlementsResponse = {
  items?: RpcSettlementMovementRow[];
  total_count?: number;
  page?: number;
  page_size?: number;
};

function toNumber(value: number | string): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toRecordType(value: string): SettlementRecordType {
  return value === "DEBIT" ? "DEBIT" : "CREDIT";
}

/** Maps RPC snake_case rows to camelCase domain model (JS convention). */
function mapSettlementMovementRow(row: RpcSettlementMovementRow): SettlementMovement {
  return {
    id: row.id,
    paymentScheduleId: row.payment_schedule_id,
    providerId: row.provider_id,
    gatewaySlug: row.gateway_slug,
    gatewayPayoutId: row.gateway_payout_id,
    gatewayMovementId: row.gateway_movement_id,
    gatewayTransactionId: row.gateway_transaction_id,
    payoutStatus: row.payout_status,
    movementStatus: row.movement_status,
    movementType: row.movement_type,
    movementSource: row.movement_source,
    recordType: toRecordType(row.record_type),
    installment: row.installment,
    grossAmount: toNumber(row.gross_amount),
    netAmount: toNumber(row.net_amount),
    baseSettleDate: row.base_settle_date,
    settlingAt: row.settling_at,
    settledAt: row.settled_at,
    isAdvance: row.is_advance,
    isRefundClawback: row.is_refund_clawback,
    brand: row.brand,
    bankAccountMask: row.bank_account_mask,
    syncSource: row.sync_source,
    syncedAt: row.synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseRpcListResponse(
  data: unknown,
  fallbackPage: number,
  fallbackPageSize: number,
): PaginatedSettlementMovements | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const payload = data as RpcListSettlementsResponse;
  const items = Array.isArray(payload.items)
    ? payload.items.map(mapSettlementMovementRow)
    : [];
  return {
    items,
    total_count: payload.total_count ?? items.length,
    page: payload.page ?? fallbackPage,
    page_size: payload.page_size ?? fallbackPageSize,
  };
}

export async function listProviderSettlements(
  params: ListProviderSettlementsParams,
): Promise<ListProviderSettlementsResult> {
  const page = Math.max(1, params.page);
  const pageSize = Math.max(1, Math.min(params.pageSize, 100));

  const { data, error } = await supabase.rpc(PROVIDER_EARNINGS_RPC.listSettlementMovements, {
    p_page: page,
    p_page_size: pageSize,
    p_movement_status: params.movementStatus ?? undefined,
    p_record_type: params.recordType ?? undefined,
    p_settling_from: params.settlingFrom ?? undefined,
    p_settling_to: params.settlingTo ?? undefined,
    p_settled_from: params.settledFrom ?? undefined,
    p_settled_to: params.settledTo ?? undefined,
  });

  if (error) {
    logger.error("provider_earnings_list_settlements_error", { error: error.message });
    return { data: null, error: error.message };
  }

  const parsed = parseRpcListResponse(data, page, pageSize);
  if (!parsed) {
    return { data: null, error: "Resposta inválida do servidor" };
  }

  return { data: parsed, error: null };
}
