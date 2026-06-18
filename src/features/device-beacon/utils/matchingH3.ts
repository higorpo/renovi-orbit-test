import { h3IndexToSplitLong, latLngToCell } from "h3-js";

/** H3 resolution for matching discovery (platform constant matching.h3_resolution). */
export const H3_RESOLUTION_MATCHING = 7;

export function h3HexToBigInt(hex: string): bigint | null {
  if (!/^[0-9a-fA-F]+$/.test(hex)) {
    return null;
  }
  const [lower, upper] = h3IndexToSplitLong(hex);
  return (BigInt(upper >>> 0) << 32n) | BigInt(lower >>> 0);
}

export function latLngToH3BigInt(
  latitude: number,
  longitude: number,
  resolution: number = H3_RESOLUTION_MATCHING,
): bigint | null {
  try {
    const hex = latLngToCell(latitude, longitude, resolution);
    return h3HexToBigInt(hex);
  } catch {
    return null;
  }
}
