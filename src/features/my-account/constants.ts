/** Storage bucket for profile photos (private; use signed URLs). */
export const PROFILE_IMAGES_BUCKET = "profile-images";

/** Path prefix for a user's profile image: users/{userId}/profile/{filename}. */
export function profileImagePath(userId: string, filename: string): string {
  return `users/${userId}/profile/${filename}`;
}

/** Signed URL expiry in seconds (1 hour). */
export const PROFILE_IMAGE_SIGNED_URL_EXPIRY_SEC = 3600;

export const DPO_EMAIL = "dpo@renovi.com.br";

/** Privacy policy URL (main site + path). Null when VITE_MAIN_SITE_URL is not set. */
const MAIN_SITE_BASE = (import.meta.env.VITE_MAIN_SITE_URL ?? "").replace(/\/$/, "");
export const PRIVACY_POLICY_URL: string | null = MAIN_SITE_BASE
  ? `${MAIN_SITE_BASE}/juridico/politica-de-privacidade`
  : null;

/** Max profile image file size in bytes (2 MB). */
export const PROFILE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

/** Allowed MIME types for profile image upload. */
export const PROFILE_IMAGE_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
