/** Storage bucket for profile photos (private; use signed URLs). */
export const PROFILE_IMAGES_BUCKET = "profile-images";

/** Path prefix for a user's profile image: users/{userId}/profile/{filename}. */
export function profileImagePath(userId: string, filename: string): string {
  return `users/${userId}/profile/${filename}`;
}

/** Signed URL expiry in seconds (1 hour). */
export const PROFILE_IMAGE_SIGNED_URL_EXPIRY_SEC = 3600;

/** Storage bucket for provider portfolio images (private; use signed URLs). */
export const PROVIDER_PORTFOLIO_IMAGES_BUCKET = "provider-portfolio-images";

/** Path prefix for a portfolio image: providers/{providerId}/portfolio/{itemId}/{filename}. */
export function providerPortfolioImagePath(
  providerId: string,
  itemId: string,
  filename: string
): string {
  return `providers/${providerId}/portfolio/${itemId}/${filename}`;
}

/** Signed URL expiry in seconds (1 hour). */
export const PROVIDER_PORTFOLIO_IMAGE_SIGNED_URL_EXPIRY_SEC = 3600;

/** Max portfolio image file size in bytes (5 MB). */
export const PROVIDER_PORTFOLIO_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** Allowed MIME types for portfolio image upload. */
export const PROVIDER_PORTFOLIO_IMAGE_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export const DPO_EMAIL = "dpo@prestway.com";

/** Main marketing site origin. Null when VITE_MAIN_SITE_URL is not set. */
const MAIN_SITE_BASE = (import.meta.env.VITE_MAIN_SITE_URL ?? "").replace(/\/$/, "");

function mainSiteLegalUrl(slug: string): string | null {
  return MAIN_SITE_BASE ? `${MAIN_SITE_BASE}/juridico/${slug}` : null;
}

/** Privacy policy URL (main site + path). Null when VITE_MAIN_SITE_URL is not set. */
export const PRIVACY_POLICY_URL: string | null = mainSiteLegalUrl("politica-de-privacidade");

/** Terms of use URL. Null when VITE_MAIN_SITE_URL is not set. */
export const TERMS_OF_USE_URL: string | null = mainSiteLegalUrl("termos-de-uso");

/** Provider platform adhesion contract. Null when VITE_MAIN_SITE_URL is not set. */
export const PROVIDER_PLATFORM_CONTRACT_URL: string | null = mainSiteLegalUrl("adesao-prestador");

/** Max profile image file size in bytes (2 MB). */
export const PROFILE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

/** Allowed MIME types for profile image upload. */
export const PROFILE_IMAGE_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;
