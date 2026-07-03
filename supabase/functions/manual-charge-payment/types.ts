export type ManualChargePaymentBody = {
  schedule_id?: string;
  clearsale_session_id?: string;
};

export type ManualChargeSchedule = {
  id: string;
  contracted_service_id: string;
  service_request_id: string | null;
  client_id: string;
  provider_id: string;
  gateway_slug: string;
  client_card_token_id: string | null;
  provider_payout: number;
  installment_number: number;
  base_amount: number;
  state: string;
  manual_attempt_count: number;
  automatic_attempt_count: number;
  max_attempts: number;
  clearsale_session_id: string | null;
  client_ip_address: string | null;
};

export type PaymentTokenRecord = {
  id: string;
  gateway_payment_profile_id: string;
  gateway_card_token: string;
  state: string;
};

export type ProviderAccountRecord = {
  provider_id: string;
  netcred_company_id: string | null;
  netcred_bank_account_id: string | null;
  onboarding_status: string;
};

export type ManualChargeAcquireErrorCode =
  | "PAYMENT_ALREADY_IN_PROGRESS"
  | "SERVICE_AUTO_CANCELLED"
  | "INVALID_SCHEDULE_STATE"
  | "SCHEDULE_NOT_FOUND"
  | "SERVICE_CANCELLED"
  | "CLEARSALE_SESSION_REQUIRED"
  | "PAYMENT_TOKEN_INACTIVE"
  | "RATE_LIMIT_EXCEEDED";

export type ManualChargeOutcome =
  | "PAID"
  | "IN_ANALYSIS"
  | "FAILED"
  | "FAILED_PERMANENT";
