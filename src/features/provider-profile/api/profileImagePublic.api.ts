import { supabase } from "@/lib/supabase/client";

const PROFILE_IMAGES_BUCKET = "profile-images";
const PORTFOLIO_IMAGES_BUCKET = "provider-portfolio-images";
const SIGNED_URL_EXPIRY_SEC = 3600;

/**
 * Get a signed URL for a profile image path (e.g. for public profile page).
 * Returns empty string on error or when bucket policy denies access (e.g. anonymous).
 */
export async function getProfileImageSignedUrlForPublic(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(PROFILE_IMAGES_BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SEC);
  if (error) return "";
  return data?.signedUrl ?? "";
}

/**
 * Get a signed URL for a portfolio image path. Returns empty string when policy denies (e.g. anonymous).
 */
export async function getPortfolioImageSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(PORTFOLIO_IMAGES_BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SEC);
  if (error) return "";
  return data?.signedUrl ?? "";
}
