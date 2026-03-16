/**
 * Geocoding abstraction — provider-agnostic types.
 * Allows swapping Nominatim for Google Maps / Mapbox later.
 */

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  displayName?: string;
}

export interface ReverseGeocodingResult {
  latitude: number;
  longitude: number;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  displayName?: string;
}

export interface GeocodingService {
  /** Resolve an address string to coordinates. */
  geocode(address: string): Promise<GeocodingResult | null>;
  /** Resolve coordinates to address components. */
  reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodingResult | null>;
}
