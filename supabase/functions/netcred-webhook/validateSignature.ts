import { computeHMACSHA256 } from "../_shared/crypto/hmac.ts";
import { timingSafeEqualStrings } from "../_shared/security/timingSafeEqual.ts";

export async function validateNetcredWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  const signature = signatureHeader.trim().toLowerCase();
  if (!signature) {
    return false;
  }

  const computed = await computeHMACSHA256(secret, rawBody);
  return timingSafeEqualStrings(computed.toLowerCase(), signature);
}
