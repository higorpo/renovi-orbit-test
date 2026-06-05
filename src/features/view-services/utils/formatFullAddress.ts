import type { ServiceModel } from "../types/service.types";

export function formatFullAddress(model: ServiceModel): string {
  const address = model.address;
  if (!address) return "Endereço não informado";

  const line1 = [address.street, address.number].filter(Boolean).join(", ");
  const line2Parts = [address.neighborhood, address.cityName]
    .map((part) => part?.trim())
    .filter(Boolean);
  const line2 = line2Parts.join(", ");
  const state = address.stateAbbreviation?.trim();
  const zip = address.zipCode?.trim();
  const complement = address.complement?.trim();

  const parts = [
    line1 || null,
    complement ? `Complemento: ${complement}` : null,
    line2 ? (state ? `${line2} - ${state}` : line2) : state ?? null,
    zip ? `CEP: ${zip}` : null,
  ].filter(Boolean);

  return parts.join(" | ");
}
