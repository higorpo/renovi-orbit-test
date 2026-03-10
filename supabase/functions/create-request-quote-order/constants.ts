/**
 * Constants for create-request-quote-order Edge Function.
 * Contract: multipart/form-data; validation with session (auth.uid) or without (user exists + email).
 */

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export const SERVICE_REQUESTS_BUCKET = "service-requests";
export const MAX_PHOTOS = 10;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB per file
export const ALLOWED_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];
export const RATE_LIMIT_PER_MINUTE = 10;
