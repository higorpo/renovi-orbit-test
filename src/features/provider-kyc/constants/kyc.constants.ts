export const PROVIDER_KYC_DOCUMENTS_BUCKET = "provider-kyc-documents";

/** Account/settings route allowed while KYC blocks the operational shell. */
export const PROVIDER_KYC_ALLOWED_PATH_PREFIX = "/dashboard/conta";

export const PROVIDER_KYC_SUPPORT_URL = `${(import.meta.env.VITE_MAIN_SITE_URL ?? "").replace(/\/$/, "")}/suporte`;

export const KYC_DOCUMENT_SIGNED_URL_EXPIRY_SEC = 7 * 24 * 3600;

export const KYC_DOCUMENT_MAX_BYTES = 100 * 1024 * 1024;

export const KYC_DOCUMENT_ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

/** Matches platform-wide image uploads (chat, proposals, request-quote, my-account). */
export const KYC_DOCUMENT_ACCEPT =
  ".pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";

export function providerKycDocumentPath(
  providerId: string,
  documentKey: string,
  filename: string,
): string {
  return `providers/${providerId}/kyc/${documentKey}/${filename}`;
}
