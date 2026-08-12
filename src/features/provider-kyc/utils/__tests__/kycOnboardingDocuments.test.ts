import { describe, expect, it } from "vitest";
import { listKycOnboardingDocuments } from "../kycOnboardingDocuments";

describe("listKycOnboardingDocuments", () => {
  it("lists PF identity and address-proof slots from onboarding", () => {
    const documents = listKycOnboardingDocuments({
      entityType: "pf",
      identityDocStoragePath: "providers/p1/kyc/identity/document.pdf",
      addressProofStoragePath: "providers/p1/kyc/address-proof/document.jpg",
      corporateCharterStoragePath: "providers/p1/kyc/corporate-charter/document.pdf",
      legalRepDocStoragePath: "providers/p1/kyc/legal-rep-id/document.pdf",
    });

    expect(documents.map((doc) => doc.key)).toEqual(["identity", "address-proof"]);
    expect(documents[0]).toMatchObject({
      label: "Documento de identidade (CPF/CNH)",
      helper: "Comprova sua identidade para uso da plataforma.",
      storagePath: "providers/p1/kyc/identity/document.pdf",
      fileName: "document.pdf",
    });
    expect(documents[1]).toMatchObject({
      label: "Comprovante de endereço",
      helper: "Conta de luz, água ou extrato recente em seu nome.",
      storagePath: "providers/p1/kyc/address-proof/document.jpg",
      fileName: "document.jpg",
    });
  });

  it("lists PJ legal-rep, company address and corporate charter without duplicating identity", () => {
    const sharedIdentity = "providers/p1/kyc/legal-rep-id/document.pdf";
    const documents = listKycOnboardingDocuments({
      entityType: "pj",
      identityDocStoragePath: sharedIdentity,
      addressProofStoragePath: "providers/p1/kyc/address-proof/document.pdf",
      corporateCharterStoragePath: "providers/p1/kyc/corporate-charter/document.pdf",
      legalRepDocStoragePath: sharedIdentity,
    });

    expect(documents.map((doc) => doc.key)).toEqual([
      "legal-rep-id",
      "address-proof",
      "corporate-charter",
    ]);
    expect(documents.map((doc) => doc.label)).toEqual([
      "Documento do representante legal",
      "Comprovante de endereço da empresa",
      "Contrato social",
    ]);
    expect(documents[0]?.storagePath).toBe(sharedIdentity);
  });

  it("keeps expected PJ slots even when a file was not sent", () => {
    const documents = listKycOnboardingDocuments({
      entityType: "pj",
      identityDocStoragePath: null,
      addressProofStoragePath: null,
      corporateCharterStoragePath: null,
      legalRepDocStoragePath: null,
    });

    expect(documents).toHaveLength(3);
    expect(documents.every((doc) => doc.storagePath === null && doc.fileName === null)).toBe(
      true,
    );
  });

  it("uses the identity path for PJ legal-rep when only identity was stored", () => {
    const documents = listKycOnboardingDocuments({
      entityType: "pj",
      identityDocStoragePath: "providers/p1/kyc/legal-rep-id/document.pdf",
      addressProofStoragePath: null,
      corporateCharterStoragePath: null,
      legalRepDocStoragePath: null,
    });

    expect(documents[0]?.key).toBe("legal-rep-id");
    expect(documents[0]?.storagePath).toBe("providers/p1/kyc/legal-rep-id/document.pdf");
  });

  it("treats a missing entity type as PF", () => {
    const documents = listKycOnboardingDocuments({
      entityType: null,
      identityDocStoragePath: "providers/p1/kyc/identity/document.pdf",
      addressProofStoragePath: null,
      corporateCharterStoragePath: null,
      legalRepDocStoragePath: null,
    });

    expect(documents.map((doc) => doc.key)).toEqual(["identity", "address-proof"]);
  });
});
