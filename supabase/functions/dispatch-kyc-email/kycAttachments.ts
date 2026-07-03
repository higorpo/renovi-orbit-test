export const PROVIDER_KYC_DOCUMENTS_BUCKET = "provider-kyc-documents";
export const PROVIDER_KYC_DEEP_LINK_PATH = "/dashboard";

export function attachmentFilenameFromPath(storagePath: string): string {
  const parts = storagePath.split("/");
  return parts[parts.length - 1] || "document.pdf";
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export type DownloadStorageObject = (
  bucket: string,
  path: string,
) => Promise<{ data: Blob | null; error: string | null }>;

export type KycAttachmentSpec = {
  label: string;
  storagePath: string;
};

export async function downloadKycAttachments(
  specs: KycAttachmentSpec[],
  downloadObject: DownloadStorageObject,
): Promise<
  | { ok: true; attachments: Array<{ filename: string; contentBase64: string }> }
  | { ok: false; errorCode: "STORAGE_DOWNLOAD_FAILED"; errorMessage: string }
> {
  const attachments: Array<{ filename: string; contentBase64: string }> = [];

  for (const spec of specs) {
    const { data, error } = await downloadObject(
      PROVIDER_KYC_DOCUMENTS_BUCKET,
      spec.storagePath,
    );

    if (error || !data) {
      return {
        ok: false,
        errorCode: "STORAGE_DOWNLOAD_FAILED",
        errorMessage: error ?? `Failed to download ${spec.label}`,
      };
    }

    attachments.push({
      filename: attachmentFilenameFromPath(spec.storagePath),
      contentBase64: await blobToBase64(data),
    });
  }

  return { ok: true, attachments };
}

export function buildKycAttachmentSpecs(input: {
  entityType: "pf" | "pj";
  identityDocStoragePath: string;
  addressProofStoragePath: string;
  corporateCharterStoragePath: string | null;
  legalRepDocStoragePath: string | null;
}): KycAttachmentSpec[] {
  const specs: KycAttachmentSpec[] = [
    { label: "identity", storagePath: input.identityDocStoragePath },
    { label: "address-proof", storagePath: input.addressProofStoragePath },
  ];

  if (input.entityType === "pj") {
    if (input.corporateCharterStoragePath) {
      specs.push({
        label: "corporate-charter",
        storagePath: input.corporateCharterStoragePath,
      });
    }
    if (input.legalRepDocStoragePath) {
      specs.push({
        label: "legal-rep-id",
        storagePath: input.legalRepDocStoragePath,
      });
    }
  }

  return specs;
}
