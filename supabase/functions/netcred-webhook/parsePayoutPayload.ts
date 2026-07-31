/**
 * Official Netcred PayoutPayload (snake_case HTTP) for PAYOUT_CREATE / PAYOUT_SETTLE.
 * Maps nested movements[] into payment_upsert_settlement_movements item shape.
 */

export const MOVEMENT_STATUS_ALLOWLIST = ["PENDING", "PAID_OUT"] as const;

export const MOVEMENT_SOURCE_ALLOWLIST = [
  "TRANSACTION",
  "REFUND",
  "DISPUTE",
  "LEASE",
  "ADVANCE",
  "PERIODIC_FEE",
  "MANUAL",
  "NEGATIVE_BALANCE",
  "OTHER",
] as const;

export const RECORD_TYPE_ALLOWLIST = ["CREDIT", "DEBIT"] as const;

export const MOVEMENT_TYPE_ALLOWLIST = [
  "CARD_PAYMENT",
  "PIX_PAYMENT",
  "BILLET_PAYMENT",
  "REFUND",
  "LEASE",
  "PERIODIC_FEE",
  "ADJUSTMENT",
  "CHARGEBACK",
] as const;

export const PAYOUT_STATUS_ALLOWLIST = [
  "PENDING",
  "APPROVED",
  "IN_QUEUE",
  "PROCESSING",
  "FAILED",
  "PAID_OUT",
] as const;

/** Inline process when movements length is at or below this; larger batches enqueue. */
export const PAYOUT_INLINE_MAX_MOVEMENTS = 20;

export type PayoutBank = {
  compe?: string | null;
  ispb?: string | null;
  name?: string | null;
};

export type PayoutBankAccount = {
  holder?: string | null;
  agency?: string | null;
  number?: string | null;
  account_type?: string | null;
  bank?: PayoutBank | null;
};

export type PayoutCompany = {
  id?: string | number | null;
  name?: string | null;
  legal_name?: string | null;
  document?: string | null;
  document_type?: string | null;
};

export type PayoutMovement = {
  id?: string | number | null;
  transaction_id?: string | number | null;
  movement_status?: string | null;
  movement_type?: string | null;
  movement_source?: string | null;
  record_type?: string | null;
  base_settle_date?: string | null;
  settling_at?: string | null;
  settled_at?: string | null;
  installment?: number | string | null;
  amount?: string | number | null;
  net_amount?: string | number | null;
  company_id?: string | number | null;
  holder_company_id?: string | number | null;
  holder_document?: string | null;
  original_holder_document?: string | null;
};

export type PayoutPayload = {
  id?: string | number | null;
  amount?: string | number | null;
  paid_amount?: string | number | null;
  payout_status?: string | null;
  brand?: string | null;
  is_advance?: boolean | null;
  settling_at?: string | null;
  settled_at?: string | null;
  bank_account?: PayoutBankAccount | null;
  company?: PayoutCompany | null;
  original_holder_company?: PayoutCompany | null;
  movements?: PayoutMovement[] | null;
};

export type SettlementUpsertItem = {
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
  record_type: "CREDIT" | "DEBIT";
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
  sync_source: "webhook";
  raw_snapshot: Record<string, unknown>;
};

export type ParsePayoutResult = {
  payload: PayoutPayload | null;
  upsertItems: SettlementUpsertItem[];
  warnings: string[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function toTrimmedString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function toDecimalString(value: unknown): string | null {
  const raw = toTrimmedString(value);
  if (raw === null) return null;
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return null;
  return raw;
}

function toInstallment(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 48) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.trim());
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 48) return parsed;
  }
  return null;
}

function upperOrNull(value: unknown): string | null {
  const raw = toTrimmedString(value);
  return raw ? raw.toUpperCase() : null;
}

function warnUnknown(
  warnings: string[],
  field: string,
  value: string,
  allowlist: readonly string[],
): void {
  if (!allowlist.includes(value)) {
    warnings.push(`unknown_${field}:${value}`);
  }
}

export function buildBankAccountMask(
  bankAccount: PayoutBankAccount | null | undefined,
): string | null {
  if (!bankAccount) return null;

  const bankLabel =
    toTrimmedString(bankAccount.bank?.name) ??
    toTrimmedString(bankAccount.bank?.compe) ??
    null;
  const number = toTrimmedString(bankAccount.number);
  if (!bankLabel && !number) return null;

  const lastDigits = number
    ? number.length <= 4
      ? number
      : number.slice(-4)
    : null;

  if (bankLabel && lastDigits) return `${bankLabel} ****${lastDigits}`;
  if (bankLabel) return bankLabel;
  return `****${lastDigits}`;
}

export function parsePayoutPayload(
  raw: Record<string, unknown>,
): ParsePayoutResult {
  const warnings: string[] = [];
  const payoutId = toTrimmedString(raw.id);
  if (!payoutId) {
    return { payload: null, upsertItems: [], warnings: ["missing_payout_id"] };
  }

  const bankAccountRaw = asRecord(raw.bank_account);
  const bankRaw = bankAccountRaw ? asRecord(bankAccountRaw.bank) : null;
  const companyRaw = asRecord(raw.company);
  const originalHolderRaw = asRecord(raw.original_holder_company);

  const payoutStatus = upperOrNull(raw.payout_status);
  if (payoutStatus) {
    warnUnknown(warnings, "payout_status", payoutStatus, PAYOUT_STATUS_ALLOWLIST);
  }

  const bankAccount: PayoutBankAccount | null = bankAccountRaw
    ? {
      holder: toTrimmedString(bankAccountRaw.holder),
      agency: toTrimmedString(bankAccountRaw.agency),
      number: toTrimmedString(bankAccountRaw.number),
      account_type: toTrimmedString(bankAccountRaw.account_type),
      bank: bankRaw
        ? {
          compe: toTrimmedString(bankRaw.compe),
          ispb: toTrimmedString(bankRaw.ispb),
          name: toTrimmedString(bankRaw.name),
        }
        : null,
    }
    : null;

  const payload: PayoutPayload = {
    id: payoutId,
    amount: toDecimalString(raw.amount) ?? toTrimmedString(raw.amount),
    paid_amount: toDecimalString(raw.paid_amount) ?? toTrimmedString(raw.paid_amount),
    payout_status: payoutStatus,
    brand: toTrimmedString(raw.brand),
    is_advance: typeof raw.is_advance === "boolean" ? raw.is_advance : false,
    settling_at: toTrimmedString(raw.settling_at),
    settled_at: toTrimmedString(raw.settled_at),
    bank_account: bankAccount,
    company: companyRaw
      ? {
        id: toTrimmedString(companyRaw.id),
        name: toTrimmedString(companyRaw.name),
        legal_name: toTrimmedString(companyRaw.legal_name),
        document: toTrimmedString(companyRaw.document),
        document_type: toTrimmedString(companyRaw.document_type),
      }
      : null,
    original_holder_company: originalHolderRaw
      ? {
        id: toTrimmedString(originalHolderRaw.id),
        name: toTrimmedString(originalHolderRaw.name),
        legal_name: toTrimmedString(originalHolderRaw.legal_name),
        document: toTrimmedString(originalHolderRaw.document),
        document_type: toTrimmedString(originalHolderRaw.document_type),
      }
      : null,
    movements: [],
  };

  const movementsRaw = Array.isArray(raw.movements) ? raw.movements : [];
  const bankAccountMask = buildBankAccountMask(bankAccount);
  const upsertItems: SettlementUpsertItem[] = [];
  const parsedMovements: PayoutMovement[] = [];

  for (const entry of movementsRaw) {
    const movement = asRecord(entry);
    if (!movement) {
      warnings.push("invalid_movement_entry");
      continue;
    }

    const movementId = toTrimmedString(movement.id);
    const transactionId = toTrimmedString(movement.transaction_id);
    const recordType = upperOrNull(movement.record_type);
    const movementStatus = upperOrNull(movement.movement_status);
    const grossAmount = toDecimalString(movement.amount);
    const netAmount = toDecimalString(movement.net_amount);

    const movementType = upperOrNull(movement.movement_type);
    const movementSource = upperOrNull(movement.movement_source);

    if (movementStatus) {
      warnUnknown(warnings, "movement_status", movementStatus, MOVEMENT_STATUS_ALLOWLIST);
    }
    if (movementSource) {
      warnUnknown(warnings, "movement_source", movementSource, MOVEMENT_SOURCE_ALLOWLIST);
    }
    if (recordType) {
      warnUnknown(warnings, "record_type", recordType, RECORD_TYPE_ALLOWLIST);
    }
    if (movementType) {
      warnUnknown(warnings, "movement_type", movementType, MOVEMENT_TYPE_ALLOWLIST);
    }

    const parsedMovement: PayoutMovement = {
      id: movementId,
      transaction_id: transactionId,
      movement_status: movementStatus,
      movement_type: movementType,
      movement_source: movementSource,
      record_type: recordType,
      base_settle_date: toTrimmedString(movement.base_settle_date),
      settling_at: toTrimmedString(movement.settling_at),
      settled_at: toTrimmedString(movement.settled_at),
      installment: toInstallment(movement.installment),
      amount: grossAmount,
      net_amount: netAmount,
      company_id: toTrimmedString(movement.company_id),
      holder_company_id: toTrimmedString(movement.holder_company_id),
      holder_document: toTrimmedString(movement.holder_document),
      original_holder_document: toTrimmedString(movement.original_holder_document),
    };
    parsedMovements.push(parsedMovement);

    // Skip incomplete rows here; SQL upsert also marks skipped_invalid.
    if (
      !movementId ||
      !transactionId ||
      !movementStatus ||
      (recordType !== "CREDIT" && recordType !== "DEBIT") ||
      grossAmount === null ||
      netAmount === null
    ) {
      warnings.push(`skipped_invalid_movement:${movementId ?? "unknown"}`);
      continue;
    }

    const holderCompanyId =
      toTrimmedString(movement.holder_company_id) ??
      toTrimmedString(movement.company_id);

    upsertItems.push({
      gateway_slug: "netcred",
      gateway_payout_id: payoutId,
      gateway_movement_id: movementId,
      gateway_transaction_id: transactionId,
      holder_company_id: holderCompanyId,
      company_id: toTrimmedString(movement.company_id),
      payout_status: payoutStatus,
      movement_status: movementStatus,
      movement_type: movementType,
      movement_source: movementSource,
      record_type: recordType,
      installment: toInstallment(movement.installment),
      gross_amount: grossAmount,
      net_amount: netAmount,
      base_settle_date: toTrimmedString(movement.base_settle_date),
      settling_at: toTrimmedString(movement.settling_at),
      settled_at: toTrimmedString(movement.settled_at),
      is_advance: payload.is_advance === true,
      is_refund_clawback: recordType === "DEBIT",
      brand: payload.brand ?? null,
      bank_account_mask: bankAccountMask,
      sync_source: "webhook",
      raw_snapshot: {
        payout_id: payoutId,
        payout_status: payoutStatus,
        movement,
      },
    });
  }

  payload.movements = parsedMovements;
  return { payload, upsertItems, warnings };
}

export function isPayoutEventType(eventType: string): boolean {
  const normalized = eventType.trim().toUpperCase();
  return normalized === "PAYOUT_CREATE" || normalized === "PAYOUT_SETTLE";
}
