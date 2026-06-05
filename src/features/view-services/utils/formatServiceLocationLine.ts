import type { AddressSummary } from "../types/service.types";

export function formatServiceLocationLine(address: AddressSummary | null): string {
  if (!address) return "";

  const locality = [address.neighborhood, address.cityName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");

  const state = address.stateAbbreviation?.trim();
  if (!locality && !state) return "";
  if (locality && state) return `${locality} (${state})`;
  return locality || state || "";
}
