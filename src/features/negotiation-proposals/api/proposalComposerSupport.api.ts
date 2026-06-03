import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase/client";
import { MAX_PROPOSAL_PHOTOS } from "../constants/proposalComposer";
import type { ProposalComposerPricing } from "../types/proposalComposer.types";

const PROVIDER_PROPOSALS_BUCKET = "provider-proposals";
const MAX_PROPOSAL_PHOTO_BYTES = 5 * 1024 * 1024;
const SIGNED_URL_EXPIRY_SEC = 3600;
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

function isPricingRow(value: unknown): value is ProposalComposerPricing {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.original_amount === "number" &&
    typeof candidate.tax_rate === "number" &&
    typeof candidate.tax_amount === "number" &&
    typeof candidate.final_amount === "number" &&
    typeof candidate.pricing_signature === "string"
  );
}

export async function calculateProposalPricing(
  originalAmount: number,
): Promise<{ data: ProposalComposerPricing | null; error: string | null }> {
  const { data, error } = await supabase.rpc("calculate_provider_service_pricing", {
    p_original_amount: originalAmount,
  });

  if (error) {
    logger.error("calculate_proposal_pricing_error", {
      error: error.message,
      originalAmount,
    });
    return { data: null, error: error.message };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!isPricingRow(row)) {
    logger.error("calculate_proposal_pricing_invalid_response", { data, originalAmount });
    return { data: null, error: "Resposta inesperada do servidor." };
  }

  return { data: row, error: null };
}

function validateProposalPhoto(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return "Formato não permitido. Use JPEG, PNG, WebP, HEIC ou HEIF.";
  }
  if (file.size > MAX_PROPOSAL_PHOTO_BYTES) {
    return "Cada imagem deve ter no máximo 5 MB.";
  }
  return null;
}

function isStoragePath(item: string): boolean {
  return item.length > 0 && !item.startsWith("http://") && !item.startsWith("https://");
}

export async function getProposalPhotoDisplayUrl(item: string): Promise<string> {
  if (!isStoragePath(item)) return item;
  const { data, error } = await supabase.storage
    .from(PROVIDER_PROPOSALS_BUCKET)
    .createSignedUrl(item, SIGNED_URL_EXPIRY_SEC);

  if (error) return "";
  return data?.signedUrl ?? "";
}

export async function uploadProposalPhotos(
  serviceRequestId: string,
  files: File[],
): Promise<{ paths: string[]; error: string | null }> {
  if (files.length === 0) return { paths: [], error: null };
  if (files.length > MAX_PROPOSAL_PHOTOS) {
    return { paths: [], error: `Você pode anexar no máximo ${MAX_PROPOSAL_PHOTOS} imagens.` };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    const message = authError?.message ?? "Usuário não autenticado";
    logger.error("upload_proposal_photos_auth_error", { error: message });
    return { paths: [], error: message };
  }

  const uploadedPaths: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const validationError = validateProposalPhoto(file);
    if (validationError) return { paths: uploadedPaths, error: validationError };

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const safeExt = ["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(ext) ? ext : "jpg";
    const filePath = `providers/${user.id}/proposals/${serviceRequestId}/${Date.now()}-${i}.${safeExt}`;
    const { error } = await supabase.storage
      .from(PROVIDER_PROPOSALS_BUCKET)
      .upload(filePath, file, { upsert: false, contentType: file.type });

    if (error) {
      logger.error("upload_proposal_photo_error", {
        providerId: user.id,
        serviceRequestId,
        error: error.message,
      });
      return { paths: uploadedPaths, error: error.message };
    }

    uploadedPaths.push(filePath);
  }

  return { paths: uploadedPaths, error: null };
}
