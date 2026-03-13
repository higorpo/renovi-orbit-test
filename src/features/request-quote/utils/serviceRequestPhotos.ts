/**
 * Helpers for service request photos (storage paths or legacy full URLs).
 * Bucket is private; paths must be resolved to signed URLs for display.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const SERVICE_REQUESTS_BUCKET = "service-requests";

/** Default signed URL expiry in seconds (1 hour). */
const SIGNED_URL_EXPIRY_SEC = 3600;

/** True if the value looks like a storage path (no scheme), not a full URL. */
export function isStoragePath(item: string): boolean {
  return (
    item.length > 0 &&
    !item.startsWith("http://") &&
    !item.startsWith("https://")
  );
}

/**
 * Resolve a single photo entry to a display URL.
 * If it's a legacy full URL, return as-is. If it's a path, get a signed URL.
 */
export async function getServiceRequestPhotoDisplayUrl(
  supabase: SupabaseClient,
  item: string
): Promise<string> {
  if (!isStoragePath(item)) return item;
  const { data, error } = await supabase.storage
    .from(SERVICE_REQUESTS_BUCKET)
    .createSignedUrl(item, SIGNED_URL_EXPIRY_SEC);
  if (error) return "";
  return data?.signedUrl ?? "";
}
