import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import {
  KYC_DOCUMENT_ALLOWED_TYPES,
  KYC_DOCUMENT_MAX_BYTES,
  KYC_DOCUMENT_SIGNED_URL_EXPIRY_SEC,
  PROVIDER_KYC_DOCUMENTS_BUCKET,
  providerKycDocumentPath,
} from "../constants/kyc.constants";
import { normalizeCNPJ } from "@/lib/cnpj";
import { unmask } from "@/lib/masks";
import {
  fromRpcEntityType,
  toRpcEntityType,
  type KycEntityType,
} from "../types/providerKyc.validation";
import {
  invokeProviderKycEdgeFunction,
  invokeProviderKycRpc,
  mapEdgeErrorPayload,
  providerKycApiErrorToMessage,
} from "./providerKycApiClient";
import { PROVIDER_KYC_EDGE, PROVIDER_KYC_RPC } from "./providerKyc.rpc";

export type DispatchKycRequest = {
  entityType: KycEntityType;
  fullName: string;
  document: string;
  phone: string;
  email: string;
  bankInstitutionCode: string;
  bankBranch: string;
  bankAccount: string;
  pixKey?: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  legalRepFullName?: string;
  legalRepCpf?: string;
  legalRepPhone?: string;
  identityDocStoragePath: string;
  addressProofStoragePath: string;
  corporateCharterStoragePath?: string;
  legalRepDocStoragePath?: string;
  identityDocUrl: string;
  addressProofUrl: string;
  corporateCharterUrl?: string;
  legalRepDocUrl?: string;
};

export type SubmitProviderKycRequest = {
  entityType: KycEntityType;
  document: string;
  fullName?: string;
  bankInstitutionCode: string;
  bankBranch: string;
  bankAccount: string;
  identityDocStoragePath: string;
  addressProofStoragePath: string;
  pixKey?: string;
  phone?: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  legalRepresentativeName?: string;
  legalRepresentativeCpf?: string;
  legalRepresentativePhone?: string;
  corporateCharterStoragePath?: string;
  legalRepDocStoragePath?: string;
};

export type SubmitProviderKycResult = {
  data: {
    providerGatewayAccountId: string;
    onboardingStatus: string;
    dispatchKycEmailRequired: boolean;
  } | null;
  error: string | null;
  errorCode?: string;
};

export type DispatchKycResult = {
  data: {
    submissionId: string;
    emailDispatched: boolean;
    emailPending?: boolean;
  } | null;
  error: string | null;
  errorCode?: string;
  field?: string;
};

export type UploadKycDocumentResult = {
  path: string | null;
  signedUrl: string | null;
  sessionId: string | null;
  error: string | null;
};

export type CreateKycUploadSessionResult = {
  uploadSessionId: string | null;
  storagePathPrefix: string | null;
  error: string | null;
};

export type RegisterKycUploadPathResult = {
  storagePath: string | null;
  error: string | null;
};

export type ProviderPaymentAccount = {
  id: string;
  onboardingStatus: string;
  emailDispatchedAt: string | null;
  onboardingSubmittedAt: string | null;
};

export type FetchProviderPaymentAccountResult = {
  data: ProviderPaymentAccount | null;
  error: string | null;
};

export type ProviderPrivateProfileForKyc = {
  entityType: KycEntityType | null;
  document: string | null;
  bankInstitutionCode: string | null;
  bankBranch: string | null;
  bankAccount: string | null;
  pixKey: string | null;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  legalRepFullName: string | null;
  legalRepCpf: string | null;
  legalRepPhone: string | null;
};

export type FetchProviderPrivateProfileForKycResult = {
  data: ProviderPrivateProfileForKyc | null;
  error: string | null;
};

type ProviderAccountRow = {
  id: string;
  onboarding_status: string;
  email_dispatched_at: string | null;
  onboarding_submitted_at: string | null;
};

type ProviderPrivateRow = {
  entity_type: string;
  cpf: string | null;
  cnpj: string | null;
  bank_institution_code: string | null;
  bank_branch: string | null;
  bank_account: string | null;
  pix_key: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  legal_representative_name: string | null;
  legal_representative_cpf: string | null;
  legal_representative_phone: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

export function validateKycDocumentFile(file: File): string | null {
  if (!KYC_DOCUMENT_ALLOWED_TYPES.includes(file.type as (typeof KYC_DOCUMENT_ALLOWED_TYPES)[number])) {
    return "Formato não permitido. Use PDF, JPEG, PNG, WebP, HEIC ou HEIF.";
  }
  if (file.size > KYC_DOCUMENT_MAX_BYTES) {
    return `O arquivo deve ter no máximo ${KYC_DOCUMENT_MAX_BYTES / (1024 * 1024)} MB.`;
  }
  return null;
}

export async function createKycUploadSession(
  documentKey: string,
): Promise<CreateKycUploadSessionResult> {
  const result = await invokeProviderKycRpc(
    PROVIDER_KYC_RPC.createUploadSession,
    { p_document_key: documentKey },
    isRecord,
    "payment_create_provider_kyc_upload_session_invalid_response",
  );

  if (result.error) {
    return {
      uploadSessionId: null,
      storagePathPrefix: null,
      error: providerKycApiErrorToMessage(result.error),
    };
  }

  const uploadSessionId = result.data?.upload_session_id;
  const storagePathPrefix = result.data?.storage_path_prefix;

  if (typeof uploadSessionId !== "string" || typeof storagePathPrefix !== "string") {
    return {
      uploadSessionId: null,
      storagePathPrefix: null,
      error: "Resposta inválida ao criar sessão de upload",
    };
  }

  return { uploadSessionId, storagePathPrefix, error: null };
}

export async function registerKycUploadPath(
  uploadSessionId: string,
  storagePath: string,
): Promise<RegisterKycUploadPathResult> {
  const result = await invokeProviderKycRpc(
    PROVIDER_KYC_RPC.registerUploadPath,
    {
      p_upload_session_id: uploadSessionId,
      p_storage_path: storagePath,
    },
    isRecord,
    "payment_register_provider_kyc_upload_path_invalid_response",
  );

  if (result.error) {
    return {
      storagePath: null,
      error: providerKycApiErrorToMessage(result.error),
    };
  }

  const registeredPath = result.data?.storage_path;
  if (typeof registeredPath !== "string") {
    return {
      storagePath: null,
      error: "Resposta inválida ao registrar caminho do documento",
    };
  }

  return { storagePath: registeredPath, error: null };
}

export async function uploadKycDocument(
  providerId: string,
  documentKey: string,
  file: File,
): Promise<UploadKycDocumentResult> {
  const validationError = validateKycDocumentFile(file);
  if (validationError) {
    return { path: null, signedUrl: null, sessionId: null, error: validationError };
  }

  const session = await createKycUploadSession(documentKey);
  if (session.error || !session.uploadSessionId) {
    return {
      path: null,
      signedUrl: null,
      sessionId: null,
      error: session.error ?? "Falha ao criar sessão de upload",
    };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
  const safeExt = ["pdf", "jpeg", "jpg", "png", "webp", "heic", "heif"].includes(ext) ? ext : "pdf";
  const path = providerKycDocumentPath(providerId, documentKey, `document.${safeExt}`);

  const { error } = await supabase.storage
    .from(PROVIDER_KYC_DOCUMENTS_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) {
    logger.error("kyc_document_upload_error", {
      providerId,
      documentKey,
      error: error.message,
    });
    return {
      path: null,
      signedUrl: null,
      sessionId: session.uploadSessionId,
      error: error.message,
    };
  }

  const registered = await registerKycUploadPath(session.uploadSessionId, path);
  if (registered.error) {
    return {
      path: null,
      signedUrl: null,
      sessionId: session.uploadSessionId,
      error: registered.error,
    };
  }

  const { data: signedData, error: signedError } = await supabase.storage
    .from(PROVIDER_KYC_DOCUMENTS_BUCKET)
    .createSignedUrl(path, KYC_DOCUMENT_SIGNED_URL_EXPIRY_SEC);

  if (signedError || !signedData?.signedUrl) {
    return {
      path,
      signedUrl: null,
      sessionId: session.uploadSessionId,
      error: signedError?.message ?? "Falha ao gerar URL do documento",
    };
  }

  return {
    path,
    signedUrl: signedData.signedUrl,
    sessionId: session.uploadSessionId,
    error: null,
  };
}

function isSubmitProviderKycPayload(value: unknown): value is Record<string, unknown> {
  return isRecord(value);
}

function parseSubmitProviderKycResponse(
  data: unknown,
): SubmitProviderKycResult["data"] {
  if (!isSubmitProviderKycPayload(data)) {
    return null;
  }

  const accountId = data.provider_gateway_account_id;
  const onboardingStatus = data.onboarding_status;
  if (typeof accountId !== "string" || typeof onboardingStatus !== "string") {
    return null;
  }

  return {
    providerGatewayAccountId: accountId,
    onboardingStatus,
    dispatchKycEmailRequired: Boolean(data.dispatch_kyc_email_required),
  };
}

function normalizeDocumentDigits(entityType: KycEntityType, document: string): string {
  return entityType === "CPF" ? unmask(document) : normalizeCNPJ(document);
}

export async function submitProviderKyc(
  request: SubmitProviderKycRequest,
): Promise<SubmitProviderKycResult> {
  const result = await invokeProviderKycRpc(
    PROVIDER_KYC_RPC.submitProviderKyc,
    {
      p_bank_institution_code: request.bankInstitutionCode,
      p_bank_branch: request.bankBranch,
      p_bank_account: request.bankAccount,
      p_identity_doc_storage_path: request.identityDocStoragePath,
      p_address_proof_storage_path: request.addressProofStoragePath,
      p_entity_type: toRpcEntityType(request.entityType),
      p_document: normalizeDocumentDigits(request.entityType, request.document),
      p_pix_key: request.pixKey,
      p_phone: request.phone,
      p_full_name: request.fullName,
      p_legal_representative_phone: request.legalRepresentativePhone,
      p_corporate_charter_storage_path: request.corporateCharterStoragePath,
      p_legal_rep_doc_storage_path: request.legalRepDocStoragePath,
      p_razao_social: request.razaoSocial,
      p_nome_fantasia: request.nomeFantasia,
      p_legal_representative_name: request.legalRepresentativeName,
      p_legal_representative_cpf: request.legalRepresentativeCpf
        ? unmask(request.legalRepresentativeCpf)
        : undefined,
    },
    isSubmitProviderKycPayload,
    "payment_submit_provider_kyc_invalid_response",
  );

  if (result.error) {
    logger.warn("submit_provider_kyc_failed", {
      errorCode: result.error.code,
      error: result.error.message,
    });

    return {
      data: null,
      error: providerKycApiErrorToMessage(result.error),
      errorCode: result.error.code,
    };
  }

  const parsed = parseSubmitProviderKycResponse(result.data);
  if (!parsed) {
    return { data: null, error: "invalid_submit_provider_kyc_response" };
  }

  return { data: parsed, error: null };
}

export async function retryProviderKycEmailDispatch(): Promise<DispatchKycResult> {
  const { ok, status, payload } = await invokeProviderKycEdgeFunction(
    PROVIDER_KYC_EDGE.dispatchKycEmail,
    { retry_only: true },
  );

  if (!ok) {
    const { message, errorCode, field } = mapEdgeErrorPayload(
      payload,
      "Falha ao enviar credenciamento",
    );

    logger.warn("retry_dispatch_kyc_email_failed", {
      status,
      errorCode,
      field,
    });

    return { data: null, error: message, errorCode, field };
  }

  return {
    data: {
      submissionId: String(payload.submission_id),
      emailDispatched: Boolean(payload.email_dispatched),
      emailPending: Boolean(payload.email_pending),
    },
    error: null,
  };
}

export async function dispatchKycEmail(
  request: DispatchKycRequest,
): Promise<DispatchKycResult> {
  const { ok, status, payload } = await invokeProviderKycEdgeFunction(
    PROVIDER_KYC_EDGE.dispatchKycEmail,
    {
      entity_type: request.entityType,
      full_name: request.fullName,
      document: normalizeDocumentDigits(request.entityType, request.document),
      phone: request.phone.replace(/\D/g, ""),
      email: request.email.trim(),
      bank_institution_code: request.bankInstitutionCode.trim(),
      bank_branch: request.bankBranch.trim(),
      bank_account: request.bankAccount.trim(),
      pix_key: request.pixKey?.trim() || undefined,
      razao_social: request.razaoSocial?.trim(),
      nome_fantasia: request.nomeFantasia?.trim(),
      legal_rep_full_name: request.legalRepFullName?.trim(),
      legal_rep_cpf: request.legalRepCpf
        ? unmask(request.legalRepCpf)
        : undefined,
      legal_rep_phone: request.legalRepPhone?.replace(/\D/g, ""),
      identity_doc_url: request.identityDocUrl,
      address_proof_url: request.addressProofUrl,
      corporate_charter_url: request.corporateCharterUrl,
      legal_rep_doc_url: request.legalRepDocUrl,
    },
  );

  if (!ok) {
    const { message, errorCode, field } = mapEdgeErrorPayload(
      payload,
      "Falha ao enviar credenciamento",
    );

    logger.warn("dispatch_kyc_email_failed", {
      status,
      errorCode,
      field,
    });

    return { data: null, error: message, errorCode, field };
  }

  return {
    data: {
      submissionId: String(payload.submission_id),
      emailDispatched: Boolean(payload.email_dispatched),
      emailPending: Boolean(payload.email_pending),
    },
    error: null,
  };
}

export async function fetchProviderPaymentAccount(
  providerId: string,
): Promise<FetchProviderPaymentAccountResult> {
  const { data, error } = await supabase
    .from("provider_gateway_accounts")
    .select("id, onboarding_status, email_dispatched_at, onboarding_submitted_at")
    .eq("provider_id", providerId)
    .eq("gateway_slug", "netcred")
    .maybeSingle();

  if (error) {
    logger.error("provider_payment_account_fetch_error", {
      providerId,
      error: error.message,
    });
    return { data: null, error: error.message };
  }

  if (!data) {
    return { data: null, error: null };
  }

  const row = data as ProviderAccountRow;

  return {
    data: {
      id: row.id,
      onboardingStatus: row.onboarding_status,
      emailDispatchedAt: row.email_dispatched_at,
      onboardingSubmittedAt: row.onboarding_submitted_at,
    },
    error: null,
  };
}

export async function fetchProviderPrivateProfileForKyc(
  providerId: string,
): Promise<FetchProviderPrivateProfileForKycResult> {
  const { data, error } = await supabase
    .from("provider_profiles_private")
    .select(
      "entity_type, cpf, cnpj, bank_institution_code, bank_branch, bank_account, pix_key, razao_social, nome_fantasia, legal_representative_name, legal_representative_cpf, legal_representative_phone",
    )
    .eq("provider_id", providerId)
    .maybeSingle();

  if (error) {
    logger.error("provider_private_profile_kyc_fetch_error", {
      providerId,
      error: error.message,
    });
    return { data: null, error: error.message };
  }

  if (!data) {
    return { data: null, error: null };
  }

  const row = data as ProviderPrivateRow;
  const entityType = fromRpcEntityType(row.entity_type);
  const document = entityType === "CNPJ"
    ? row.cnpj
    : entityType === "CPF"
      ? row.cpf
      : (row.cpf ?? row.cnpj);

  return {
    data: {
      entityType,
      document,
      bankInstitutionCode: row.bank_institution_code,
      bankBranch: row.bank_branch,
      bankAccount: row.bank_account,
      pixKey: row.pix_key,
      razaoSocial: row.razao_social,
      nomeFantasia: row.nome_fantasia,
      legalRepFullName: row.legal_representative_name,
      legalRepCpf: row.legal_representative_cpf,
      legalRepPhone: row.legal_representative_phone,
    },
    error: null,
  };
}

/** Block operational shell unless onboarding is ACTIVE (conta allowlist is Gate-level). */
export function shouldBlockProviderForKyc(account: ProviderPaymentAccount | null): boolean {
  return !account || account.onboardingStatus !== "ACTIVE";
}

export function isProviderCredentialed(account: ProviderPaymentAccount | null): boolean {
  return account?.onboardingStatus === "ACTIVE";
}

export function isProviderKycPending(account: ProviderPaymentAccount | null): boolean {
  return !account || account.onboardingStatus === "PENDING_DOCUMENTS";
}

export function isProviderKycSubmitting(account: ProviderPaymentAccount | null): boolean {
  return Boolean(
    account?.onboardingStatus === "DOCUMENTS_SUBMITTED"
    && !account.emailDispatchedAt,
  );
}

export function isProviderKycDocumentsSubmitted(
  account: ProviderPaymentAccount | null,
): boolean {
  return Boolean(
    account?.onboardingStatus === "DOCUMENTS_SUBMITTED"
    && account.emailDispatchedAt,
  );
}

export function isProviderKycAwaitingReview(
  account: ProviderPaymentAccount | null,
): boolean {
  return account?.onboardingStatus === "UNDER_NETCRED_REVIEW";
}

export function isProviderKycRejected(account: ProviderPaymentAccount | null): boolean {
  return account?.onboardingStatus === "REJECTED";
}

export function isProviderKycSuspended(account: ProviderPaymentAccount | null): boolean {
  return account?.onboardingStatus === "SUSPENDED";
}
