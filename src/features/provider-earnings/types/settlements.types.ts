export type SettlementMovementStatus = "PENDING" | "PAID_OUT";

export type SettlementRecordType = "CREDIT" | "DEBIT";

export type SettlementFilterId = "all" | "pending" | "paid_out" | "debit";

export type SettlementFilterConfig = {
  id: SettlementFilterId;
  label: string;
  movementStatus: SettlementMovementStatus | null;
  recordType: SettlementRecordType | null;
};

export type SettlementMovement = {
  id: string;
  paymentScheduleId: string | null;
  providerId: string;
  gatewaySlug: string;
  gatewayPayoutId: string;
  gatewayMovementId: string;
  gatewayTransactionId: string;
  payoutStatus: string | null;
  movementStatus: string;
  movementType: string | null;
  movementSource: string | null;
  recordType: SettlementRecordType;
  installment: number | null;
  grossAmount: number;
  netAmount: number;
  baseSettleDate: string | null;
  settlingAt: string | null;
  settledAt: string | null;
  isAdvance: boolean;
  isRefundClawback: boolean;
  brand: string | null;
  bankAccountMask: string | null;
  syncSource: string;
  syncedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ListProviderSettlementsParams = {
  page: number;
  pageSize: number;
  movementStatus?: SettlementMovementStatus | null;
  recordType?: SettlementRecordType | null;
  settlingFrom?: string | null;
  settlingTo?: string | null;
  settledFrom?: string | null;
  settledTo?: string | null;
};

/** Paginated envelope keys match the RPC jsonb (`total_count`, `page`, `page_size`). */
export type PaginatedSettlementMovements = {
  items: SettlementMovement[];
  total_count: number;
  page: number;
  page_size: number;
};

export type ListProviderSettlementsResult = {
  data: PaginatedSettlementMovements | null;
  error: string | null;
};

export type SettlementScheduleGroup = {
  paymentScheduleId: string | null;
  items: SettlementMovement[];
};
