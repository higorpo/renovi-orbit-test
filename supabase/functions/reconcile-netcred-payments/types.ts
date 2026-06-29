export type ReconcileSchedule = {
  id: string;
  contracted_service_id: string;
  service_request_id: string | null;
  client_id: string;
  provider_id: string;
  state: string;
  installment_number: number;
  base_amount: number;
  payment_token_id: string | null;
  netcred_company_id: string | null;
  automatic_attempt_count: number;
  manual_attempt_count: number;
  max_attempts: number;
  reconciliation_failure_count: number;
};

export type ReconcileApplyResult = {
  applied: boolean;
  reason?: string;
  from_state?: string;
  to_state?: string;
  reconciliation_failure_count?: number;
  service_id?: string;
  client_id?: string;
  provider_id?: string;
  installment_number?: number;
  charge_amount?: number | string | null;
};

export type ReconcileRunSummary = {
  processed: number;
  applied: number;
  skipped: number;
  failures: number;
  warnings_emitted: number;
};

export type ReconcileOutcome =
  | "PAID"
  | "FAILED_PERMANENT"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED"
  | "IN_ANALYSIS"
  | "SKIPPED"
  | "FAILURE";

export type ProcessedReconcileResult = {
  scheduleId: string;
  outcome: ReconcileOutcome;
  failureCount?: number;
  chargeAmount?: string;
};
