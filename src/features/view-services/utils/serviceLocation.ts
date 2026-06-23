import type { MapCoordinates } from "@/lib/maps/openGoogleMaps";
import type { AddressSummary } from "../types/service.types";

export function getServiceCoordinates(
  address: AddressSummary | null | undefined,
): MapCoordinates | null {
  if (!address) return null;

  const { latitude, longitude } = address;
  if (
    latitude == null ||
    longitude == null ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  return { latitude, longitude };
}
