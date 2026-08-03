import { assertEquals } from "std/testing/asserts";
import {
  attachmentFilenameFromPath,
  blobToBase64,
  buildKycAttachmentSpecs,
  downloadKycAttachments,
  PROVIDER_KYC_DOCUMENTS_BUCKET,
} from "../kycAttachments.ts";

Deno.test("attachmentFilenameFromPath returns last path segment", () => {
  assertEquals(
    attachmentFilenameFromPath("providers/p1/kyc/identity/document.pdf"),
    "document.pdf",
  );
  assertEquals(attachmentFilenameFromPath(""), "document.pdf");
});

Deno.test("blobToBase64 encodes blob contents", async () => {
  const encoded = await blobToBase64(new Blob(["abc"]));
  assertEquals(encoded, btoa("abc"));
});

Deno.test("buildKycAttachmentSpecs includes PJ docs without duplicate identity", () => {
  const specs = buildKycAttachmentSpecs({
    entityType: "pj",
    identityDocStoragePath: "rep.pdf",
    addressProofStoragePath: "addr.pdf",
    corporateCharterStoragePath: "charter.pdf",
    legalRepDocStoragePath: "rep.pdf",
  });

  assertEquals(specs.map((s) => s.label), [
    "legal-rep-id",
    "address-proof",
    "corporate-charter",
  ]);
});

Deno.test("buildKycAttachmentSpecs omits PJ docs for pf", () => {
  const specs = buildKycAttachmentSpecs({
    entityType: "pf",
    identityDocStoragePath: "id.pdf",
    addressProofStoragePath: "addr.pdf",
    corporateCharterStoragePath: "charter.pdf",
    legalRepDocStoragePath: "rep.pdf",
  });
  assertEquals(specs.length, 2);
  assertEquals(specs.map((s) => s.label), ["identity", "address-proof"]);
});

Deno.test("downloadKycAttachments returns attachments on success", async () => {
  const result = await downloadKycAttachments(
    [{ label: "identity", storagePath: "path/id.pdf" }],
    async (bucket, path) => {
      assertEquals(bucket, PROVIDER_KYC_DOCUMENTS_BUCKET);
      assertEquals(path, "path/id.pdf");
      return { data: new Blob(["pdf"]), error: null };
    },
  );

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.attachments[0]?.filename, "id.pdf");
    assertEquals(result.attachments[0]?.contentBase64, btoa("pdf"));
  }
});

Deno.test("downloadKycAttachments fails when object is missing", async () => {
  const result = await downloadKycAttachments(
    [{ label: "identity", storagePath: "missing.pdf" }],
    async () => ({ data: null, error: "not found" }),
  );

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.errorCode, "STORAGE_DOWNLOAD_FAILED");
    assertEquals(result.errorMessage, "not found");
  }
});
