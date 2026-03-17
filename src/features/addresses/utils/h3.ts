import { latLngToCell } from "h3-js";

/** H3 resolution 9: ~0.1 km² hexagon, suitable for address-level indexing (similar to geohash precision 7). */
export const H3_RESOLUTION_ADDRESS = 9;

/**
 * Returns the H3 cell index for a WGS84 point at the default address resolution.
 * Returns null if coordinates are invalid or H3 throws.
 */
export function latLngToH3Index(
  latitude: number,
  longitude: number,
  resolution: number = H3_RESOLUTION_ADDRESS
): string | null {
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }
  try {
    return latLngToCell(latitude, longitude, resolution);
  } catch {
    return null;
  }
}
