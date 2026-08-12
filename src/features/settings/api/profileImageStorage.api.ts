/**
 * Profile image storage: upload, remove, and resolve path to signed URL.
 * Only storage path is stored in DB; never store full URL.
 */

import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase/client";
import {
  PROFILE_IMAGES_BUCKET,
  profileImagePath,
  PROFILE_IMAGE_SIGNED_URL_EXPIRY_SEC,
  PROFILE_IMAGE_MAX_BYTES,
  PROFILE_IMAGE_ALLOWED_TYPES,
} from "../constants";

export interface UploadProfileImageResult {
  path: string | null;
  error: string | null;
}

export interface RemoveProfileImageResult {
  error: string | null;
}

export function validateProfileImageFile(file: File): string | null {
  if (!PROFILE_IMAGE_ALLOWED_TYPES.includes(file.type as (typeof PROFILE_IMAGE_ALLOWED_TYPES)[number])) {
    return "Formato não permitido. Use JPEG, PNG, WebP, HEIC ou HEIF.";
  }
  if (file.size > PROFILE_IMAGE_MAX_BYTES) {
    return "A imagem deve ter no máximo 2 MB.";
  }
  return null;
}

/**
 * Upload a profile image to storage. Returns the path to store in profiles.profile_image_path.
 * Caller must then update the profile row with this path.
 */
export async function uploadProfileImage(
  userId: string,
  file: File
): Promise<UploadProfileImageResult> {
  const err = validateProfileImageFile(file);
  if (err) return { path: null, error: err };

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = ["jpeg", "jpg", "png", "webp", "heic", "heif"].includes(ext) ? ext : "jpg";
  const filename = `avatar.${safeExt}`;
  const path = profileImagePath(userId, filename);

  const { error } = await supabase.storage
    .from(PROFILE_IMAGES_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) {
    logger.error("profile_image_upload_error", { userId, error: error.message });
    return { path: null, error: error.message };
  }
  return { path, error: null };
}

/**
 * Remove profile image from storage. Caller must clear profile_image_path in DB.
 */
export async function removeProfileImageFromStorage(
  path: string
): Promise<RemoveProfileImageResult> {
  const { error } = await supabase.storage
    .from(PROFILE_IMAGES_BUCKET)
    .remove([path]);

  if (error) {
    logger.error("profile_image_remove_error", { path, error: error.message });
    return { error: error.message };
  }
  return { error: null };
}

/**
 * Get a signed URL for displaying a profile image from its storage path.
 */
export async function getProfileImageSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(PROFILE_IMAGES_BUCKET)
    .createSignedUrl(path, PROFILE_IMAGE_SIGNED_URL_EXPIRY_SEC);
  if (error) return "";
  return data?.signedUrl ?? "";
}
