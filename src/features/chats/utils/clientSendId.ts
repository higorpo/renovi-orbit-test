import { generateIdempotencyKeyV7 } from "@/lib/utils/idempotencyKey";

/**
 * Stable client-side id for optimistic rows and send retries.
 * Uses UUID v7 via getRandomValues — works on Capacitor dev (HTTP LAN IP),
 * unlike crypto.randomUUID() which requires a secure context.
 */
export function createClientSendId(): string {
  return generateIdempotencyKeyV7();
}
