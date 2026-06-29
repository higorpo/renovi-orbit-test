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
import type { KycEntityType } from "../types/providerKyc.validation";
import { invokePaymentEdgeFunction, mapEdgeErrorPayload } from "./paymentApiClient";
import { PAYMENT_EDGE } from "./payments.edge";

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
  identityDocUrl: string;
  addressProofUrl: string;
  corporateCharterUrl?: string;
  legalRepDocUrl?: string;
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

type ProviderAccountRow = {
  id: string;
  onboarding_status: string;
  email_dispatched_at: string | null;
  onboarding_submitted_at: string | null;
};

export function validateKycDocumentFile(file: File): string | null {
  if (!KYC_DOCUMENT_ALLOWED_TYPES.includes(file.type as (typeof KYC_DOCUMENT_ALLOWED_TYPES)[number])) {
    return "Formato não permitido. Use PDF, JPEG, PNG, WebP, HEIC ou HEIF.";
  }
  if (file.size > KYC_DOCUMENT_MAX_BYTES) {
    return `O arquivo deve ter no máximo ${KYC_DOCUMENT_MAX_BYTES / (1024 * 1024)} MB.`;
  }
  return null;
}

export async function uploadKycDocument(
  providerId: string,
  documentKey: string,
  file: File,
): Promise<UploadKycDocumentResult> {
  const validationError = validateKycDocumentFile(file);
  if (validationError) {
    return { path: null, signedUrl: null, error: validationError };
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
    return { path: null, signedUrl: null, error: error.message };
  }

  const { data: signedData, error: signedError } = await supabase.storage
    .from(PROVIDER_KYC_DOCUMENTS_BUCKET)
    .createSignedUrl(path, KYC_DOCUMENT_SIGNED_URL_EXPIRY_SEC);

  if (signedError || !signedData?.signedUrl) {
    return { path, signedUrl: null, error: signedError?.message ?? "Falha ao gerar URL do documento" };
  }

  return { path, signedUrl: signedData.signedUrl, error: null };
}

export async function dispatchKycEmail(
  request: DispatchKycRequest,
): Promise<DispatchKycResult> {
  const { ok, status, payload } = await invokePaymentEdgeFunction(
    PAYMENT_EDGE.dispatchKycEmail,
    {
      entity_type: request.entityType,
      full_name: request.fullName,
      document: request.entityType === "CPF"
        ? unmask(request.document)
        : normalizeCNPJ(request.document),
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

export function shouldBlockProviderForKyc(account: ProviderPaymentAccount | null): boolean {
  if (!account) {
    return true;
  }

  if (account.onboardingStatus === "PENDING_DOCUMENTS") {
    return true;
  }

  if (
    account.onboardingStatus === "DOCUMENTS_SUBMITTED"
    && !account.emailDispatchedAt
  ) {
    return true;
  }

  return false;
}

export function isProviderKycPending(account: ProviderPaymentAccount | null): boolean {
  return account?.onboardingStatus === "PENDING_DOCUMENTS";
}

export function isProviderKycSubmitting(account: ProviderPaymentAccount | null): boolean {
  return Boolean(
    account?.onboardingStatus === "DOCUMENTS_SUBMITTED"
    && !account.emailDispatchedAt,
  );
}
