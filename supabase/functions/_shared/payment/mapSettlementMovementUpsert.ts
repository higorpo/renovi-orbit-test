/**
 * Maps Netcred GraphQL / webhook movement fields into payment_upsert_settlement_movements items.
 */

export type SettlementSyncSource = "webhook" | "graphql_reconcile";

export type SettlementMovementUpsertItem = {
  gateway_slug: "netcred";
  gateway_payout_id: string;
  gateway_movement_id: string;
  gateway_transaction_id: string;
  holder_company_id: string | null;
  company_id: string | null;
  payout_status: string | null;
  movement_status: string;
  movement_type: string | null;
  movement_source: string | null;
  record_type: string;
  installment: number | null;
  gross_amount: string;
  net_amount: string;
  base_settle_date: string | null;
  settling_at: string | null;
  settled_at: string | null;
  is_advance: boolean;
  is_refund_clawback: boolean;
  brand: string | null;
  bank_account_mask: string | null;
  sync_source: SettlementSyncSource;
  raw_snapshot: Record<string, unknown>;
};

export type SettlementMovementSource = {
  id: string;
  amount: string;
  netAmount: string;
  movementStatus: string;
  movementType?: string | null;
  movementSource?: string | null;
  recordType: string;
  installment?: number | null;
  baseSettleDate?: string | null;
  settlingAt?: string | null;
  settledAt?: string | null;
  isAdvance?: boolean | null;
  brand?: string | null;
  bankAccountNumber?: string | null;
  bankCompe?: string | null;
  bankName?: string | null;
  holderCompanyId?: string | null;
  companyId?: string | null;
  payoutId?: string | null;
  payoutStatus?: string | null;
  payoutBrand?: string | null;
  payoutIsAdvance?: boolean | null;
  /** Fallback when movement.transaction is absent. */
  transactionId?: string | null;
  rawSnapshot?: Record<string, unknown>;
};

/** CLS-safe mask: bank name/compe + last account digits (no full number / document). */
export function maskBankAccount(input: {
  bankName?: string | null;
  bankCompe?: string | null;
  accountNumber?: string | null;
}): string | null {
  const bankLabel =
    nullifTrim(input.bankName) ??
    nullifTrim(input.bankCompe);
  const digits = (input.accountNumber ?? "").replace(/\D/g, "");
  const last = digits.length > 0 ? digits.slice(-4) : null;

  if (!bankLabel && !last) return null;
  if (bankLabel && last) return `${bankLabel} ****${last}`;
  if (bankLabel) return bankLabel;
  return `****${last}`;
}

function nullifTrim(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asDateOnly(value: string | null | undefined): string | null {
  const trimmed = nullifTrim(value);
  if (!trimmed) return null;
  // GraphQL Date is YYYY-MM-DD; DateTime → take date prefix.
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  return trimmed;
}

/**
 * Builds one upsert RPC item. Caller must set sync_source.
 * gateway_payout_id falls back to pre_payout:{transactionId} when payout is unset.
 */
export function mapSettlementMovementToUpsertItem(
  source: SettlementMovementSource,
  syncSource: SettlementSyncSource,
): SettlementMovementUpsertItem | null {
  const gatewayMovementId = nullifTrim(String(source.id ?? ""));
  const gatewayTransactionId = nullifTrim(
    String(source.transactionId ?? ""),
  );
  const recordType = nullifTrim(source.recordType)?.toUpperCase() ?? null;
  const movementStatus = nullifTrim(source.movementStatus);
  const grossAmount = nullifTrim(source.amount);
  const netAmount = nullifTrim(source.netAmount);

  if (
    !gatewayMovementId ||
    !gatewayTransactionId ||
    !recordType ||
    (recordType !== "CREDIT" && recordType !== "DEBIT") ||
    !movementStatus ||
    !grossAmount ||
    !netAmount
  ) {
    return null;
  }

  const payoutId = nullifTrim(source.payoutId);
  const gatewayPayoutId = payoutId ?? `pre_payout:${gatewayTransactionId}`;
  const installment =
    typeof source.installment === "number" && Number.isFinite(source.installment)
      ? source.installment
      : null;

  return {
    gateway_slug: "netcred",
    gateway_payout_id: gatewayPayoutId,
    gateway_movement_id: gatewayMovementId,
    gateway_transaction_id: gatewayTransactionId,
    holder_company_id: nullifTrim(source.holderCompanyId),
    company_id: nullifTrim(source.companyId),
    payout_status: nullifTrim(source.payoutStatus),
    movement_status: movementStatus,
    movement_type: nullifTrim(source.movementType ?? null),
    movement_source: nullifTrim(source.movementSource ?? null),
    record_type: recordType,
    installment,
    gross_amount: grossAmount,
    net_amount: netAmount,
    base_settle_date: asDateOnly(source.baseSettleDate),
    settling_at: asDateOnly(source.settlingAt),
    settled_at: nullifTrim(source.settledAt),
    is_advance: Boolean(source.isAdvance) || Boolean(source.payoutIsAdvance),
    is_refund_clawback: recordType === "DEBIT",
    brand: nullifTrim(source.brand) ?? nullifTrim(source.payoutBrand),
    bank_account_mask: maskBankAccount({
      bankName: source.bankName,
      bankCompe: source.bankCompe,
      accountNumber: source.bankAccountNumber,
    }),
    sync_source: syncSource,
    raw_snapshot: source.rawSnapshot ?? { ...source },
  };
}
