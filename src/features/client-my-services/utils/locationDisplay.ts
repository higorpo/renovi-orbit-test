import type { AddressSummary } from "../types/client-my-services.types";

/**
 * Format address for card/list display.
 * Format: "Rua X, 123 - Bairro, Cidade (UF)"
 */
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
