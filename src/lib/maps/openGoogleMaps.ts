export interface MapCoordinates {
  latitude: number;
  longitude: number;
}

export function buildGoogleMapsUrl({ latitude, longitude }: MapCoordinates): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

export function openGoogleMaps(coordinates: MapCoordinates): void {
  const url = buildGoogleMapsUrl(coordinates);
  window.open(url, "_blank", "noopener,noreferrer");
}
