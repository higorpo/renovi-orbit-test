import { describe, expect, it } from "vitest";
import {
  KYC_DOCUMENT_ACCEPT,
  KYC_DOCUMENT_ALLOWED_TYPES,
  KYC_DOCUMENT_MAX_BYTES,
  KYC_DOCUMENT_SIGNED_URL_EXPIRY_SEC,
  PROVIDER_KYC_DOCUMENTS_BUCKET,
  providerKycDocumentPath,
} from "../kyc.constants";

describe("kyc.constants", () => {
  it("exposes expected bucket and limits", () => {
    expect(PROVIDER_KYC_DOCUMENTS_BUCKET).toBe("provider-kyc-documents");
    expect(KYC_DOCUMENT_MAX_BYTES).toBe(100 * 1024 * 1024);
    expect(KYC_DOCUMENT_SIGNED_URL_EXPIRY_SEC).toBe(7 * 24 * 3600);
    expect(KYC_DOCUMENT_ALLOWED_TYPES).toContain("application/pdf");
    expect(KYC_DOCUMENT_ACCEPT).toContain(".pdf");
  });

  it("builds storage path for provider KYC documents", () => {
    expect(providerKycDocumentPath("prov-1", "identity", "document.pdf")).toBe(
      "providers/prov-1/kyc/identity/document.pdf",
    );
  });
});
