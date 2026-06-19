/**
 * Signed URLs for service request photos stored in the private bucket.
 */

import { supabase } from "@/lib/supabase/client";
import { isStoragePath } from "../utils/serviceRequestPhotos";

export const SERVICE_REQUESTS_BUCKET = "service-requests";

/** Default signed URL expiry in seconds (1 hour). */
const SIGNED_URL_EXPIRY_SEC = 3600;

/**
 * Resolve a single photo entry to a display URL.
 * Legacy full URLs are returned as-is; storage paths get a signed URL.
 */
export async function getServiceRequestPhotoDisplayUrl(item: string): Promise<string> {
  if (!isStoragePath(item)) return item;
  const { data, error } = await supabase.storage
    .from(SERVICE_REQUESTS_BUCKET)
    .createSignedUrl(item, SIGNED_URL_EXPIRY_SEC);
  if (error) return "";
  return data?.signedUrl ?? "";
}
