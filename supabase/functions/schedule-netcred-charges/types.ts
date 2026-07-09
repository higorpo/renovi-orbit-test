export type CronChargeSchedule = {
  id: string;
  contracted_service_id: string;
  service_request_id: string | null;
  service_request_title: string | null;
  client_id: string;
  provider_id: string;
  gateway_slug: string;
  client_card_token_id: string;
  installment_number: number;
  base_amount: number;
  provider_payout: number;
  charge_amount?: number | null;
  netcred_company_id: string | null;
  automatic_attempt_count: number;
  max_attempts: number;
  clearsale_session_id: string | null;
  client_ip_address: string | null;
  gateway_reference_code?: string | null;
};

export type CronChargeOutcome =
  | "PAID"
  | "IN_ANALYSIS"
  | "FAILED"
  | "FAILED_PERMANENT";

export type ProcessedScheduleResult = {
  scheduleId: string;
  outcome: CronChargeOutcome;
  chargeAmount?: string;
  reconciled?: boolean;
};

export type CronRunSummary = {
  processed: number;
  paid: number;
  failed: number;
  failed_permanent: number;
  in_analysis: number;
  reconciled: number;
  errors: number;
};
