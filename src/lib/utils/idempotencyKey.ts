/**
 * UUID v7 for idempotency keys and other client-generated correlation ids.
 * Uses getRandomValues (works without a secure context; crypto.randomUUID does not).
 */
export function generateIdempotencyKeyV7(): string {
  const unixMs = BigInt(Date.now());
  const bytes = new Uint8Array(16);

  for (let i = 0; i < 6; i++) {
    bytes[i] = Number((unixMs >> BigInt(40 - 8 * i)) & 0xffn);
  }

  crypto.getRandomValues(bytes.subarray(6));
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = (index: number) => bytes[index]!.toString(16).padStart(2, "0");
  return [
    [0, 1, 2, 3].map(hex).join(""),
    [4, 5].map(hex).join(""),
    [6, 7].map(hex).join(""),
    [8, 9].map(hex).join(""),
    [10, 11, 12, 13, 14, 15].map(hex).join(""),
  ].join("-");
}
