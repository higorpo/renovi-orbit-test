export type SettlementSyncSchedule = {
  id: string;
  provider_id: string;
  state: string;
  gateway_transaction_id: string;
  gateway_slug: string;
  netcred_company_id: string | null;
  paid_at: string | null;
};

export type SettlementSyncUpsertResult = {
  upserted: number;
  skipped_platform: number;
  skipped_not_found: number;
  skipped_invalid: number;
  results?: unknown[];
};

export type SettlementSyncScheduleResult = {
  scheduleId: string;
  outcome: "upserted" | "empty" | "skipped" | "failure";
  movementCount: number;
  upserted: number;
  skippedPlatform: number;
  skippedNotFound: number;
  skippedInvalid: number;
  error?: string;
};

export type SettlementSyncRunSummary = {
  processed: number;
  upserted_schedules: number;
  empty: number;
  skipped: number;
  failures: number;
  movements_upserted: number;
  movements_skipped_platform: number;
  movements_skipped_not_found: number;
  movements_skipped_invalid: number;
};
