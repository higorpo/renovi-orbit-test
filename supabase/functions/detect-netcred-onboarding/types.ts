export type PendingProviderAccount = {
  id: string;
  provider_id: string;
  document: string;
  onboarding_status: string;
};

export type CompanyBankAccountNode = {
  id?: string | null;
  isActive?: boolean | null;
};

export type CompanyNode = {
  id?: string | null;
  document?: string | null;
  companyState?: string | null;
  bankAccounts?: {
    edges?: Array<{ node?: CompanyBankAccountNode | null } | null> | null;
  } | null;
};

export type CompanyQueryResult = {
  edges?: Array<{ node?: CompanyNode | null } | null> | null;
};

export type OnboardingProcessAction =
  | "noop"
  | "activated"
  | "under_review"
  | "warning_multiple_edges"
  | "warning_active_without_bank";

export type OnboardingRunSummary = {
  batches: number;
  processed: number;
  activated: number;
  under_review: number;
  warnings: number;
  skipped: number;
};

export function providerAliasKey(document: string): string {
  return `provider_${document.replace(/\D/g, "")}`;
}
