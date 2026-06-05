import type { AddressSummary } from "../types/service.types";

export function formatLocationDisplay(address: AddressSummary | null): string {
  if (!address) return "";
  const streetPart = address.streetSummary ?? "";
  const localityPart = [address.neighborhood, address.cityName]
    .filter(Boolean)
    .join(", ");
  const statePart = address.stateAbbreviation
    ? ` (${address.stateAbbreviation})`
    : "";

  const main =
    streetPart && localityPart
      ? `${streetPart} - ${localityPart}`
      : streetPart || localityPart;

  return main + statePart;
}
