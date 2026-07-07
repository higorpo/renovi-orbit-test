export const NETCRED_CHARGE_TEXT_MAX_LENGTH = 150;

export function truncateNetCredChargeText(
  value: string,
  maxLength = NETCRED_CHARGE_TEXT_MAX_LENGTH,
): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return trimmed.slice(0, maxLength);
}

export function resolveNetCredServiceTitle(
  serviceTitle: string | null | undefined,
): string {
  const normalized = (serviceTitle ?? "").trim();
  return normalized.length > 0 ? normalized : "Serviço";
}

export function buildNetCredChargeExtraInfo(
  serviceTitle: string | null | undefined,
): string {
  return truncateNetCredChargeText(
    `Renovi — ${resolveNetCredServiceTitle(serviceTitle)}`,
  );
}
