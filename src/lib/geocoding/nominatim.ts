/**
 * Nominatim (OpenStreetMap) geocoding adapter.
 * Respects usage policy: https://operations.osmfoundation.org/policies/nominatim/
 * Use a descriptive User-Agent and avoid heavy requests (debounce in UI).
 */

import { logger } from "@/lib/logger";
import type { GeocodingService, GeocodingResult, ReverseGeocodingResult } from "./types";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const USER_AGENT = "RenoviOrbit/1.0 (contact@renovi.com.br)";

function getHeaders(): HeadersInit {
  return {
    "Accept": "application/json",
    "Accept-Language": "pt-BR,en",
    "User-Agent": USER_AGENT,
  };
}

interface NominatimSearchResult {
  lat: string;
  lon: string;
  display_name?: string;
}

interface NominatimAddress {
  road?: string;
  house_number?: string;
  suburb?: string;
  neighbourhood?: string;
  city?: string;
  town?: string;
  village?: string;
  state?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
}

interface NominatimReverseResult {
  lat: string;
  lon: string;
  display_name?: string;
  address?: NominatimAddress;
}

export class NominatimGeocodingAdapter implements GeocodingService {
  async geocode(address: string): Promise<GeocodingResult | null> {
    const q = address.trim();
    if (!q) return null;

    const params = new URLSearchParams({
      q,
      format: "json",
      limit: "1",
      addressdetails: "0",
    });
    const url = `${NOMINATIM_BASE}/search?${params.toString()}`;

    try {
      const res = await fetch(url, { headers: getHeaders() });
      if (!res.ok) {
        logger.warn("geocoding_nominatim_search_error", { status: res.status, q: q.slice(0, 50) });
        return null;
      }
      const data = (await res.json()) as NominatimSearchResult[];
      const first = Array.isArray(data) ? data[0] : null;
      if (!first || typeof first.lat !== "string" || typeof first.lon !== "string") return null;
      const lat = parseFloat(first.lat);
      const lng = parseFloat(first.lon);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
      return { latitude: lat, longitude: lng, displayName: first.display_name };
    } catch (err) {
      logger.error("geocoding_nominatim_search_error", { error: (err as Error).message, q: q.slice(0, 50) });
      return null;
    }
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodingResult | null> {
    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      Number.isNaN(latitude) ||
      Number.isNaN(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return null;
    }

    const params = new URLSearchParams({
      lat: String(latitude),
      lon: String(longitude),
      format: "json",
      addressdetails: "1",
    });
    const url = `${NOMINATIM_BASE}/reverse?${params.toString()}`;

    try {
      const res = await fetch(url, { headers: getHeaders() });
      if (!res.ok) {
        logger.warn("geocoding_nominatim_reverse_error", { status: res.status, lat: latitude, lon: longitude });
        return null;
      }
      const data = (await res.json()) as NominatimReverseResult;
      const addr = data?.address;
      const lat = parseFloat(data?.lat);
      const lon = parseFloat(data?.lon);
      if (Number.isNaN(lat) || Number.isNaN(lon)) return null;

      const city = addr?.city ?? addr?.town ?? addr?.village ?? undefined;
      const neighborhood = addr?.suburb ?? addr?.neighbourhood ?? undefined;

      return {
        latitude: lat,
        longitude: lon,
        street: addr?.road,
        number: addr?.house_number,
        neighborhood,
        city,
        state: addr?.state,
        postalCode: addr?.postcode,
        country: addr?.country,
        displayName: data.display_name,
      };
    } catch (err) {
      logger.error("geocoding_nominatim_reverse_error", {
        error: (err as Error).message,
        lat: latitude,
        lon: longitude,
      });
      return null;
    }
  }
}

export const nominatimGeocodingService: GeocodingService = new NominatimGeocodingAdapter();
