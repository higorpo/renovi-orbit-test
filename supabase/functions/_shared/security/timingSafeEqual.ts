function timingSafeEqualBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const subtle = crypto.subtle as SubtleCrypto & {
    timingSafeEqual?: (a: BufferSource, b: BufferSource) => boolean;
  };

  if (typeof subtle.timingSafeEqual === "function") {
    return subtle.timingSafeEqual(
      left as BufferSource,
      right as BufferSource,
    );
  }

  let diff = 0;
  for (let i = 0; i < left.length; i++) {
    diff |= left[i] ^ right[i];
  }

  return diff === 0;
}

export function timingSafeEqualStrings(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);

  if (leftBytes.length !== rightBytes.length) {
    return false;
  }

  return timingSafeEqualBytes(leftBytes, rightBytes);
}
