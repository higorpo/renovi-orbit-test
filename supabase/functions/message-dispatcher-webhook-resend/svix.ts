/** Resend webhook Svix signature verification (design §11.3, task 73). */

export const SVIX_ID_HEADER = "svix-id";
export const SVIX_TIMESTAMP_HEADER = "svix-timestamp";
export const SVIX_SIGNATURE_HEADER = "svix-signature";

const DEFAULT_TOLERANCE_SECONDS = 300;

export type WebhookVerifyFailure = {
  ok: false;
  status: number;
  code: string;
};

export type WebhookVerifySuccess = { ok: true };

export type WebhookVerifyResult = WebhookVerifySuccess | WebhookVerifyFailure;

export interface SvixHeaders {
  id: string;
  timestamp: string;
  signature: string;
}

export function decodeSvixSecret(secret: string): Uint8Array {
  const trimmed = secret.trim();
  const encoded = trimmed.startsWith("whsec_") ? trimmed.slice(6) : trimmed;
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function extractSvixHeaders(req: Request): SvixHeaders | null {
  const id = req.headers.get(SVIX_ID_HEADER);
  const timestamp = req.headers.get(SVIX_TIMESTAMP_HEADER);
  const signature = req.headers.get(SVIX_SIGNATURE_HEADER);
  if (!id || !timestamp || !signature) return null;
  return { id, timestamp, signature };
}

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const left = enc.encode(a);
  const right = enc.encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) {
    diff |= left[i] ^ right[i];
  }
  return diff === 0;
}

/** Computes v1 Svix HMAC-SHA256 signature (for tests and verification). */
export async function computeSvixSignature(
  secret: string,
  msgId: string,
  timestamp: string,
  payload: string,
): Promise<string> {
  const rawKey = decodeSvixSecret(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    rawKey.buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signedContent = `${msgId}.${timestamp}.${payload}`;
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signedContent),
  );
  const bytes = new Uint8Array(digest);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export async function verifySvixWebhook(
  rawBody: string,
  headers: SvixHeaders,
  secret: string,
  toleranceSeconds = DEFAULT_TOLERANCE_SECONDS,
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const timestamp = Number.parseInt(headers.timestamp, 10);
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > toleranceSeconds) {
    return false;
  }

  const expected = await computeSvixSignature(
    secret,
    headers.id,
    headers.timestamp,
    rawBody,
  );

  for (const part of headers.signature.split(" ")) {
    if (!part.startsWith("v1,")) continue;
    if (timingSafeEqual(part.slice(3), expected)) return true;
  }

  return false;
}

export async function verifyResendWebhookRequest(
  req: Request,
  rawBody: string,
): Promise<WebhookVerifyResult> {
  const secret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  if (!secret?.trim()) {
    return { ok: false, status: 500, code: "resend_webhook_secret_missing" };
  }

  const headers = extractSvixHeaders(req);
  if (!headers) {
    return { ok: false, status: 401, code: "svix_headers_missing" };
  }

  const valid = await verifySvixWebhook(rawBody, headers, secret);
  if (!valid) {
    return { ok: false, status: 401, code: "invalid_signature" };
  }

  return { ok: true };
}
