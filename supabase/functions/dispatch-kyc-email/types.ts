export type KycEntityType = "CPF" | "CNPJ";

export type DispatchKycEmailBody = {
  retry_only?: boolean;
  entity_type: KycEntityType;
  full_name: string;
  document: string;
  phone: string;
  email: string;
  bank_institution_code: string;
  bank_branch: string;
  bank_account: string;
  pix_key?: string;
  razao_social?: string;
  nome_fantasia?: string;
  legal_rep_full_name?: string;
  legal_rep_cpf?: string;
  legal_rep_phone?: string;
};

export type DispatchKycEmailSuccess = {
  submission_id: string;
  email_dispatched: boolean;
  email_pending?: boolean;
};

export type DispatchKycEmailErrorCode =
  | "INVALID_JSON"
  | "INVALID_DOCUMENT"
  | "KYC_REQUIRED_FIELDS_MISSING"
  | "FORBIDDEN"
  | "INVALID_ONBOARDING_STATE"
  | "PROVIDER_PROFILE_NOT_FOUND"
  | "DOCUMENT_MISMATCH"
  | "STORAGE_DOWNLOAD_FAILED"
  | "CREDENCIAMENTO_EMAIL_FAILED"
  | "MARK_DISPATCHED_FAILED";

export type ProviderGatewayAccountRow = {
  id: string;
  provider_id: string;
  document: string;
  onboarding_status: string;
  email_dispatched_at: string | null;
};

export type ProviderKycContext = {
  providerId: string;
  gatewayAccount: ProviderGatewayAccountRow;
  profile: {
    fullName: string;
    phone: string | null;
    email: string;
  };
  privateProfile: {
    entityType: "pf" | "pj";
    cpf: string | null;
    cnpj: string | null;
    razaoSocial: string | null;
    nomeFantasia: string | null;
    legalRepresentativeName: string | null;
    legalRepresentativeCpf: string | null;
    legalRepresentativePhone: string | null;
    bankInstitutionCode: string;
    bankBranch: string;
    bankAccount: string;
    pixKey: string | null;
    identityDocStoragePath: string;
    addressProofStoragePath: string;
    corporateCharterStoragePath: string | null;
    legalRepDocStoragePath: string | null;
  };
};

export type KycEmailAttachment = {
  filename: string;
  contentBase64: string;
};
