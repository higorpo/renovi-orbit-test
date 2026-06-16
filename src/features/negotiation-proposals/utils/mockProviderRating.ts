/** Deterministic mock rating until provider reputation is available in compare API. */
export function mockProviderRating(providerId: string): string {
  let hash = 0;
  for (const char of providerId) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  const rating = 4.0 + (Math.abs(hash) % 10) / 10;
  return rating.toFixed(1);
}

/** Deterministic mock completed services count for layout preview. */
export function mockProviderCompletedServices(providerId: string): number {
  let hash = 0;
  for (const char of providerId) {
    hash = (hash * 17 + char.charCodeAt(0)) | 0;
  }
  return 12 + (Math.abs(hash) % 140);
}
