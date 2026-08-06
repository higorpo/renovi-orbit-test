/**
 * Signed URLs for completion-evidence photos (private bucket).
 */

import { supabase } from "@/lib/supabase/client";
import { COMPLETION_EVIDENCE_BUCKET } from "../utils/evidenceStoragePath";
import { logger } from "@/lib/logger";

/** Default signed URL expiry in seconds (1 hour). */
const SIGNED_URL_EXPIRY_SEC = 3600;

/**
 * Resolve a storage path to a short-lived display URL.
 * Returns empty string when signing fails.
 */
export async function getCompletionEvidenceDisplayUrl(
  path: string,
): Promise<string> {
  const trimmed = path.trim();
  if (!trimmed) return "";

  const { data, error } = await supabase.storage
    .from(COMPLETION_EVIDENCE_BUCKET)
    .createSignedUrl(trimmed, SIGNED_URL_EXPIRY_SEC);

  if (error) {
    logger.warn("completion_evidence_signed_url_failed", {
      path: trimmed,
      error: error.message,
    });
    return "";
  }

  return data?.signedUrl ?? "";
}
