import type {
  ListProviderOpportunitiesBody,
  ListProviderOpportunitiesSortMode,
  ParsedListProviderOpportunitiesParams,
} from "./types.ts";

const SORT_MODES = new Set<ListProviderOpportunitiesSortMode>([
  "newest",
  "nearest",
  "least_competitive",
]);

export function clampLimit(limit: unknown): number {
  const value = typeof limit === "number" && Number.isFinite(limit) ? limit : 20;
  return Math.min(Math.max(Math.trunc(value), 1), 50);
}

export function normalizeSortMode(
  sortMode: unknown,
): ListProviderOpportunitiesSortMode {
  if (typeof sortMode === "string" && SORT_MODES.has(sortMode as ListProviderOpportunitiesSortMode)) {
    return sortMode as ListProviderOpportunitiesSortMode;
  }
  return "newest";
}

export function parseOptionalCoordinate(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function parseListProviderOpportunitiesBody(
  body: ListProviderOpportunitiesBody,
): ParsedListProviderOpportunitiesParams {
  const cursor = typeof body.cursor === "string" && body.cursor.trim().length > 0
    ? body.cursor.trim()
    : null;

  return {
    sortMode: normalizeSortMode(body.sort_mode),
    cursor,
    limit: clampLimit(body.limit),
    lat: parseOptionalCoordinate(body.lat),
    lng: parseOptionalCoordinate(body.lng),
  };
}

export function validateCoordinates(
  lat: number | null,
  lng: number | null,
): string | null {
  if (lat === null && lng === null) return null;
  if (lat === null || lng === null) {
    return "lat and lng must both be provided when either is set";
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return "Valid lat (-90..90) and lng (-180..180) are required";
  }
  return null;
}

export function validateNearestSortRequiresCoordinates(
  sortMode: ListProviderOpportunitiesSortMode,
  lat: number | null,
  lng: number | null,
): string | null {
  if (sortMode !== "nearest") return null;
  if (lat === null || lng === null) {
    return "nearest sort requires lat and lng";
  }
  return null;
}
