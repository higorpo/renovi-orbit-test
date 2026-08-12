export type KycOnboardingDocumentKey =
  | "identity"
  | "legal-rep-id"
  | "address-proof"
  | "corporate-charter";

export type KycOnboardingDocumentSlot = {
  key: KycOnboardingDocumentKey;
  label: string;
  helper: string;
  storagePath: string | null;
  fileName: string | null;
};

export type ListKycOnboardingDocumentsInput = {
  entityType?: string | null;
  identityDocStoragePath?: string | null;
  addressProofStoragePath?: string | null;
  corporateCharterStoragePath?: string | null;
  legalRepDocStoragePath?: string | null;
};

function trimPath(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function kycDocumentFileName(storagePath: string | null): string | null {
  if (!storagePath) return null;
  const segment = storagePath.split("/").filter(Boolean).at(-1);
  return segment ?? null;
}

function slot(
  key: KycOnboardingDocumentKey,
  label: string,
  helper: string,
  storagePath: string | null,
): KycOnboardingDocumentSlot {
  return {
    key,
    label,
    helper,
    storagePath,
    fileName: kycDocumentFileName(storagePath),
  };
}

/** Expected onboarding attachments for the provider entity type (PF vs PJ). */
export function listKycOnboardingDocuments(
  input: ListKycOnboardingDocumentsInput,
): KycOnboardingDocumentSlot[] {
  const isPj = input.entityType === "pj";
  const identity = trimPath(input.identityDocStoragePath);
  const address = trimPath(input.addressProofStoragePath);
  const charter = trimPath(input.corporateCharterStoragePath);
  const legalRep = trimPath(input.legalRepDocStoragePath) ?? (isPj ? identity : null);

  if (isPj) {
    return [
      slot(
        "legal-rep-id",
        "Documento do representante legal",
        "RG ou CNH do responsável legal pela empresa.",
        legalRep,
      ),
      slot(
        "address-proof",
        "Comprovante de endereço da empresa",
        "Conta de luz, água ou extrato recente em nome da empresa.",
        address,
      ),
      slot(
        "corporate-charter",
        "Contrato social",
        "Documento que comprova a constituição da empresa.",
        charter,
      ),
    ];
  }

  return [
    slot(
      "identity",
      "Documento de identidade (CPF/CNH)",
      "Comprova sua identidade para uso da plataforma.",
      identity,
    ),
    slot(
      "address-proof",
      "Comprovante de endereço",
      "Conta de luz, água ou extrato recente em seu nome.",
      address,
    ),
  ];
}
