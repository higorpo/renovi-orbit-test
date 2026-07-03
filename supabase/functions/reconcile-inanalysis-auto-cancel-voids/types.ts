export type InanalysisVoidSchedule = {
  id: string;
  contracted_service_id: string;
  client_id: string;
  provider_id: string;
  gateway_charge_id: string;
  gateway_transaction_id: string | null;
  netcred_company_id: string | null;
  reconciliation_failure_count: number;
};

export type VoidCommitOutcome =
  | "voided"
  | "deferred_captured"
  | "already_terminal"
  | "failed";

export type VoidCommitResult = {
  applied: boolean;
  outcome?: VoidCommitOutcome;
  reason?: string;
  reconciliation_failure_count?: number;
};

export type ProcessedVoidResult = {
  scheduleId: string;
  outcome: "VOIDED" | "DEFERRED" | "ALREADY_TERMINAL" | "FAILURE" | "SKIPPED";
  failureCount?: number;
};

export type VoidRunSummary = {
  processed: number;
  voided: number;
  deferred: number;
  already_terminal: number;
  failures: number;
  warnings_emitted: number;
};
