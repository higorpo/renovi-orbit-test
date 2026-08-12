import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  getKycDocumentSignedUrl,
  listKycOnboardingDocuments,
  type KycOnboardingDocumentKey,
} from "@/features/provider-kyc";
import { useProviderProfile } from "./useProviderProfile";

export function useProviderKycDocuments() {
  const { privateData, isLoading, error, refetch } = useProviderProfile();
  const [downloadingKey, setDownloadingKey] = useState<KycOnboardingDocumentKey | null>(
    null,
  );

  const documents = useMemo(
    () =>
      listKycOnboardingDocuments({
        entityType: privateData?.entity_type,
        identityDocStoragePath: privateData?.identity_doc_storage_path,
        addressProofStoragePath: privateData?.address_proof_storage_path,
        corporateCharterStoragePath: privateData?.corporate_charter_storage_path,
        legalRepDocStoragePath: privateData?.legal_rep_doc_storage_path,
      }),
    [privateData],
  );

  const downloadDocument = useCallback(
    async (key: KycOnboardingDocumentKey) => {
      const doc = documents.find((item) => item.key === key);
      if (!doc?.storagePath) return;

      setDownloadingKey(key);
      try {
        const { signedUrl, error: signError } = await getKycDocumentSignedUrl(
          doc.storagePath,
        );
        if (signError || !signedUrl) {
          toast.error("Não foi possível baixar o documento. Tente novamente.");
          return;
        }
        window.open(signedUrl, "_blank", "noopener,noreferrer");
      } finally {
        setDownloadingKey(null);
      }
    },
    [documents],
  );

  return {
    documents,
    downloadingKey,
    downloadDocument,
    isLoading,
    error,
    refetch,
  };
}
