/**
 * Format a distance in km to a human-readable PT-BR string.
 * Examples: "200 m", "1,4 km", "12 km"
 */
export function formatDistance(km: number): string {
  if (km < 0.1) return "< 100 m";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1).replace(".", ",")} km`;
  return `${Math.round(km)} km`;
}
