/**
 * Portfolio image storage: upload and remove images for provider work items.
 * Only the storage path is persisted in DB; signed URLs are resolved elsewhere.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import {
  PROVIDER_PORTFOLIO_IMAGES_BUCKET,
  providerPortfolioImagePath,
  PROVIDER_PORTFOLIO_IMAGE_ALLOWED_TYPES,
  PROVIDER_PORTFOLIO_IMAGE_MAX_BYTES,
} from "../constants";

export interface UploadPortfolioImageResult {
  path: string | null;
  error: string | null;
}

export interface RemovePortfolioImageResult {
  error: string | null;
}

export function validatePortfolioImageFile(file: File): string | null {
  if (
    !PROVIDER_PORTFOLIO_IMAGE_ALLOWED_TYPES.includes(
      file.type as (typeof PROVIDER_PORTFOLIO_IMAGE_ALLOWED_TYPES)[number]
    )
  ) {
    return "Formato não permitido. Use JPEG, PNG, WebP, HEIC ou HEIF.";
  }
  if (file.size > PROVIDER_PORTFOLIO_IMAGE_MAX_BYTES) {
    return "A imagem deve ter no máximo 5 MB.";
  }
  return null;
}

export async function uploadPortfolioImage(
  supabase: SupabaseClient,
  providerId: string,
  itemId: string,
  file: File,
  index: number
): Promise<UploadPortfolioImageResult> {
  const err = validatePortfolioImageFile(file);
  if (err) return { path: null, error: err };

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = ["jpeg", "jpg", "png", "webp", "heic", "heif"].includes(ext) ? ext : "jpg";
  const filename = `image-${index + 1}.${safeExt}`;
  const path = providerPortfolioImagePath(providerId, itemId, filename);

  const { error } = await supabase.storage
    .from(PROVIDER_PORTFOLIO_IMAGES_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) {
    logger.error("provider_portfolio_image_upload_error", {
      providerId,
      itemId,
      error: error.message,
    });
    return { path: null, error: error.message };
  }
  return { path, error: null };
}

export async function removePortfolioImageFromStorage(
  supabase: SupabaseClient,
  path: string
): Promise<RemovePortfolioImageResult> {
  const { error } = await supabase.storage
    .from(PROVIDER_PORTFOLIO_IMAGES_BUCKET)
    .remove([path]);

  if (error) {
    logger.error("provider_portfolio_image_remove_error", {
      path,
      error: error.message,
    });
    return { error: error.message };
  }
  return { error: null };
}
